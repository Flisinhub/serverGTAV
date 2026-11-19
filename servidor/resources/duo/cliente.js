const { base, motorPool, contracts } = Duo
let state
let routeBlips = []
let spawning = false
let deathAt = 0
let initialized = false
let configured = new Set()
let notice = { text: '', until: 0 }

const panelActions = new Set(['start', 'join', 'cancel', 'buy', 'eat', 'buyCar', 'pull', 'park', 'paint', 'locate', 'locateCar', 'recoverCar',
  'startWorld', 'retry', 'chooseRoute', 'locateHangar', 'locateHQ', 'confirmBriefing'])
let panelOpen = false
const hud = { heartbeat: -Infinity, visible: false, sampleAt: -Infinity, telemetry: '', prompt: '',
  control: null, key: '', keyAt: -Infinity, retryAt: 0, reportAt: 0 }
let cache
let cacheZone
onNet('duo:cache', next => {
  if (cacheZone) RemoveBlip(cacheZone)
  cacheZone = 0
  cache = next
  if (!cache) return
  cacheZone = AddBlipForRadius(...cache.area, cache.at[2], 30.0)
  SetBlipColour(cacheZone, 5)
  SetBlipAlpha(cacheZone, 145)
  SetNewWaypoint(...cache.area)
  closePanel()
})
let rallyEndsAt = 0
let passengerAttempt = 0
let towAttempt = 0
let escortAttempt = 0
let subtitleUntil = 0
let paintApplied = new Map()

function hudAvailable(now = GetGameTimer()) {
  return now - hud.heartbeat < 10000
}

function hudVisibility(visible) {
  if (visible === hud.visible) return
  hud.visible = visible
  if (visible) hud.telemetry = ''
  else hud.prompt = ''
  SendNuiMessage(JSON.stringify({ type: 'hud:visibility', visible }))
}

function closePanel() {
  if (!panelOpen) return
  panelOpen = false
  SetNuiFocus(false, false)
  SendNuiMessage(JSON.stringify({ type: 'visible', visible: false }))
}

function openPanel(section = 'hq') {
  if (!initialized || spawning || IsEntityDead(PlayerPedId()) || IsPauseMenuActive()) return
  if (!hudAvailable()) {
    notify('La central está cargando. Prueba de nuevo en unos segundos.')
    return
  }
  panelOpen = true
  hudVisibility(false)
  SetNuiFocus(true, true)
  SendNuiMessage(JSON.stringify({ type: 'visible', visible: true, section }))
  emitNet('duo:panel')
}

function nui(type, handle) {
  RegisterNuiCallbackType(type)
  on('__cfx_nui:' + type, (data, callback) => {
    let ok = true
    try {
      handle(data)
    } catch (error) {
      ok = false
      console.error('[duo:NUI] ' + type, error)
    }
    callback({ ok })
  })
}

nui('hudReady', () => hudHeartbeat(true))
nui('hudHeartbeat', () => hudHeartbeat(false))
nui('cierra', closePanel)
nui('accion', data => {
  if (!panelOpen || !panelActions.has(data?.operation)) return
  request(data.operation, data.value)
})

onNet('duo:panel', snapshot => {
  SendNuiMessage(JSON.stringify({ type: 'snapshot', snapshot }))
})
onNet('duo:crew', count => {
  if (panelOpen) SendNuiMessage(JSON.stringify({ type: 'crew', count }))
})
on('onClientResourceStop', resource => {
  if (resource !== GetCurrentResourceName()) return
  closePanel()
  hudVisibility(false)
})
RegisterCommand('central', () => openPanel(), false)
RegisterKeyMapping('central', 'Abrir la central de Los Santos a Dos', 'keyboard', 'F6')

const hqProps = new Map()
function unloadHQ() {
  for (const entity of hqProps.values()) if (entity) DeleteObject(entity)
  hqProps.clear()
}

function streamHQ() {
  if (distance(GetEntityCoords(PlayerPedId()), base) > 100) {
    if (hqProps.size) unloadHQ()
    return
  }
  for (const station of Duo.hq) {
    for (const placement of station.props) {
      if (hqProps.has(placement)) continue
      const [model, x, y, z, heading] = placement
      const hash = GetHashKey(model)
      if (!IsModelInCdimage(hash) || !IsModelValid(hash)) {
        hqProps.set(placement, 0)
        continue
      }
      if (!HasModelLoaded(hash)) {
        RequestModel(hash)
        continue
      }
      const object = CreateObjectNoOffset(hash, x, y, z, false, false, false)
      if (object) {
        SetEntityHeading(object, heading)
        FreezeEntityPosition(object, true)
        SetEntityCollision(object, false, false)
        hqProps.set(placement, object)
      }
      SetModelAsNoLongerNeeded(hash)
    }
  }
}
on('onClientResourceStop', resource => {
  if (resource === GetCurrentResourceName()) unloadHQ()
})

function updatePaint() {
  const seen = new Map()
  for (const vehicle of GetGamePool('CVehicle')) {
    if (!NetworkGetEntityIsNetworked(vehicle) || !NetworkHasControlOfEntity(vehicle)) continue
    const rgb = Entity(vehicle).state.duoPaint
    if (!Array.isArray(rgb) || rgb.length !== 3) continue
    const color = rgb.join(',')
    const identity = NetworkGetNetworkIdFromEntity(vehicle) + ':' + vehicle
    seen.set(identity, color)
    if (paintApplied.get(identity) === color) continue
    SetVehicleCustomPrimaryColour(vehicle, ...rgb)
    SetVehicleCustomSecondaryColour(vehicle, ...rgb)
  }
  paintApplied = seen
}

function notify(text) {
  if (panelOpen) SendNuiMessage(JSON.stringify({ type: 'notice', text }))
  notice = { text, until: GetGameTimer() + 6800 }
  if (!panelOpen && hudAvailable()) SendNuiMessage(JSON.stringify({ type: 'hud:toast', text }))
}

function missionHud() {
  if (!state) return null
  const objective = state.objectives[0] || state.stop.text
  const team = state.failed ? null : state.teamwork
  let detail = state.objectives[1]
  if (team?.stage === 'paired' || team?.stage === 'briefing') {
    detail = (team.confirmed ? 'Tú: confirmado' : 'Tú: pendiente') +
      (team.teammateConfirmed ? '  |  Compañero: confirmado' : '  |  Compañero: pendiente')
  } else if (team?.switching) detail = 'Relevo: intercambiad los asientos'
  if (detail?.startsWith('Equipo: ')) detail = ''
  const checkpoint = state.targets.find(target => target.air)?.text
  return {
    name: state.name, objective, detail, checkpoint,
    remaining: Math.max(0, (rallyEndsAt - GetGameTimer()) / 1000)
  }
}

function publishMission() {
  if (hudAvailable()) SendNuiMessage(JSON.stringify({ type: 'hud:mission', data: missionHud() }))
}

function hudHeartbeat(restart) {
  const now = GetGameTimer()
  const recovered = !hudAvailable(now)
  hud.heartbeat = now
  if (!recovered && !restart) return
  hud.visible = false
  hud.sampleAt = -Infinity
  hud.telemetry = ''
  hud.prompt = ''
  SendNuiMessage(JSON.stringify({ type: 'hud:visibility', visible: false }))
  publishMission()
}

function percent(value) {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function sampleTelemetry(ped, vehicle, position, now) {
  if (now - hud.sampleAt < (vehicle ? 100 : 250)) return
  hud.sampleAt = now
  const maxHealth = GetEntityMaxHealth(ped)
  const baseHealth = maxHealth > 100 ? 100 : 0
  const classId = vehicle ? GetVehicleClass(vehicle) : -1
  const mode = !vehicle ? 'foot' : (classId === 15 || classId === 16) ? 'air' : 'road'
  let clip = null
  let ammo = null
  if (IsPedArmed(ped, 4)) {
    const weapon = GetSelectedPedWeapon(ped)
    const [valid, loaded] = GetAmmoInClip(ped, weapon)
    const total = GetAmmoInPedWeapon(ped, weapon)
    clip = valid ? loaded : null
    ammo = Math.max(0, total - (clip || 0))
  }
  const roadGear = mode === 'road' && classId !== 13 && classId !== 14 && classId !== 21
  const gear = roadGear ? GetVehicleCurrentGear(vehicle) : null
  const data = {
    health: percent(100 * (GetEntityHealth(ped) - baseHealth) / (maxHealth - baseHealth || 1)),
    armor: percent(GetPedArmour(ped)), ammo, clip, mode,
    speed: vehicle ? Math.round(GetEntitySpeed(vehicle) * 3.6) : null,
    gear: gear === 0 && GetEntitySpeedVector(vehicle, true)[1] < -0.5 ? -1 : gear,
    damaged: !!vehicle && classId !== 13 && GetVehicleEngineHealth(vehicle) < 650,
    altitude: mode === 'air' ? Math.round(position[2]) : null,
    safeZone: Math.round(GetSafeZoneSize() * 100) / 100
  }
  const message = JSON.stringify({ type: 'hud:telemetry', data })
  if (hud.telemetry === message) return
  hud.telemetry = message
  SendNuiMessage(message)
}

const controlNames = {
  4: '↑', 5: '↓', 6: '←', 7: '→', 8: 'Cruceta',
  16: 'Stick izq.', 25: 'Stick der.', 30: 'A', 31: 'B', 32: 'X',
  33: 'Y', 34: 'LB', 35: 'LT', 36: 'RB', 37: 'RT', 38: 'Start', 39: 'Select'
}

function promptKey(control, now) {
  if (hud.control === control && now < hud.keyAt) return hud.key
  const binding = GetControlInstructionalButton(0, control, true) || ''
  hud.control = control
  hud.keyAt = now + 250
  hud.key = binding.startsWith('t_') ? binding.slice(2) :
    binding.startsWith('b_') ? controlNames[binding.slice(2)] || 'Acción' : binding || 'Acción'
  return hud.key
}

function showPrompt(prompt, available, now) {
  const key = prompt ? promptKey(prompt.control, now) : ''
  if (available) {
    const message = JSON.stringify({ type: 'hud:prompt', text: prompt?.text || '', key })
    if (hud.prompt !== message) {
      hud.prompt = message
      SendNuiMessage(message)
    }
  } else if (prompt) label(0.39, 0.89, '~y~' + key + '~s~  ' + prompt.text, 0.45)
}

function label(x, y, text, scale = 0.36) {
  SetTextFont(4)
  SetTextScale(0, scale)
  SetTextColour(255, 255, 255, 245)
  SetTextOutline()
  BeginTextCommandDisplayText('STRING')
  AddTextComponentSubstringPlayerName(text)
  EndTextCommandDisplayText(x, y)
}

function blip(at, title, sprite, color) {
  const pin = AddBlipForCoord(at[0], at[1], at[2])
  SetBlipSprite(pin, sprite)
  SetBlipColour(pin, color)
  BeginTextCommandSetBlipName('STRING')
  AddTextComponentSubstringPlayerName(title)
  EndTextCommandSetBlipName(pin)
  return pin
}

function distance(coords, at) {
  return Math.hypot(coords[0] - at[0], coords[1] - at[1], coords[2] - at[2])
}

function marker(at, color) {
  DrawMarker(1, at[0], at[1], at[2] - 1.0, 0, 0, 0, 0, 0, 0, 2.2, 2.2, 0.55,
    ...color, 155, false, false, 2, false, null, null, false)
}

function resolve(id) {
  if (!id || !NetworkDoesEntityExistWithNetworkId(id)) return 0
  return NetworkGetEntityFromNetworkId(id)
}

function request(action, value) {
  emitNet('duo:action', action, value)
}

onNet('duo:locateCar', at => {
  SetNewWaypoint(at[0], at[1])
  closePanel()
})
onNet('duo:notice', notify)
onNet('duo:state', next => {
  for (const pin of routeBlips) RemoveBlip(pin)
  routeBlips = []
  const reconfigured = state?.id !== next?.id || state?.step !== next?.step
  if (reconfigured) {
    configured.clear()
    passengerAttempt = 0
    towAttempt = 0
    escortAttempt = 0
    subtitleUntil = next?.dialogue ? GetGameTimer() + 9500 : 0
  }
  state = next && next.members.includes(GetPlayerServerId(PlayerId())) ? next : undefined
  if (panelOpen) emitNet('duo:panel')
  rallyEndsAt = state?.remaining ? GetGameTimer() + state.remaining * 1000 : 0
  publishMission()
  if (!state) return
  if (reconfigured && state.teamwork?.switching) notify('Relevo: intercambiad los asientos')
  const color = state.stop.gang ? 1 : 5
  routeBlips = state.targets.map(site => blip(site.at, site.text, site.air ? 423 : site.search ? 162 : 1, color))
  if (routeBlips.length && !state.targets[0].search) {
    SetBlipRoute(routeBlips[0], true)
    SetBlipRouteColour(routeBlips[0], color)
  }
})

function grantWeapon(item) {
  const supply = Duo.supplies[item]
  if (!supply?.weapon) return
  const ped = PlayerPedId()
  const hash = GetHashKey(supply.weapon)
  if (!HasPedGotWeapon(ped, hash, false)) GiveWeaponToPed(ped, hash, supply.ammo, false, false)
}

onNet('duo:loadout', weapons => weapons.forEach(grantWeapon))
onNet('duo:supply', item => {
  const ped = PlayerPedId()
  const heal = Duo.supplies[item]?.heal
  if (heal && !IsEntityDead(ped)) SetEntityHealth(ped, Math.min(GetEntityMaxHealth(ped), GetEntityHealth(ped) + heal))
  if (item === 'blindaje') SetPedArmour(ped, 100)
  if (item === 'botiquin') SetEntityHealth(ped, GetEntityMaxHealth(ped))
  grantWeapon(item)
})

RegisterCommand('contratos', (_source, args) => {
  if (args[0]) return request('start', args[0].toLowerCase())
  openPanel()
}, false)
RegisterCommand('unir', () => request('join'), false)
RegisterCommand('cancelar', () => request('cancel'), false)
RegisterCommand('saldo', () => request('balance'), false)
RegisterCommand('comprar', (_source, args) => request('buy', (args[0] || '').toLowerCase()), false)

for (const key of Object.keys(contracts)) {
  RegisterCommand(key, () => request('start', key), false)
}

function spawn() {
  spawning = true
  global.exports.spawnmanager.spawnPlayer({
    x: base[0], y: base[1], z: base[2], heading: base[3], model: GetHashKey('a_m_y_stwhi_02')
  }, () => {
    const ped = PlayerPedId()
    SetEntityHealth(ped, GetEntityMaxHealth(ped))
    SetCanAttackFriendly(ped, false, false)
    GiveWeaponToPed(ped, GetHashKey('WEAPON_PISTOL'), 100, false, false)
    spawning = false
    emitNet('duo:ready')
    notify('Los Santos a Dos | Elige un contrato en la central.')
  })
}

function updateTow(vehicle) {
  const wreck = resolve(state.tow)
  if (!wreck || !vehicle || !NetworkHasControlOfEntity(vehicle) ||
      GetEntityAttachedToTowTruck(vehicle) === wreck ||
      distance(GetEntityCoords(vehicle), GetEntityCoords(wreck)) > 10 ||
      GetGameTimer() < towAttempt) return
  towAttempt = GetGameTimer() + 1500
  if (!NetworkHasControlOfEntity(wreck)) {
    NetworkRequestControlOfEntity(wreck)
    return
  }
  SetVehicleUndriveable(wreck, true)
  AttachVehicleToTowTruck(vehicle, wreck, false, 0, 0, 0)
}

function updateEscort() {
  if (!state.escort) return
  const { at } = state.escort
  const vehicle = resolve(state.escort.vehicle)
  const driver = resolve(state.escort.driver)
  if (!vehicle || !driver || !NetworkHasControlOfEntity(driver) || GetGameTimer() < escortAttempt) return
  if (distance(GetEntityCoords(vehicle), at) < 11) return
  escortAttempt = GetGameTimer() + 3800
  SetBlockingOfNonTemporaryEvents(driver, true)
  if (GetPedInVehicleSeat(vehicle, -1) !== driver) {
    SetPedIntoVehicle(driver, vehicle, -1)
  }
  TaskVehicleDriveToCoordLongrange(driver, vehicle, at[0], at[1], at[2], 13.0, 786603, 7.0)
}

function updateNPCs() {
  if (!state || state.failed) return
  const vehicle = resolve(state.vehicle)
  updateTow(vehicle)
  updateEscort()
  const passenger = resolve(state.passenger)
  if (vehicle && passenger && state.step === 0 && NetworkHasControlOfEntity(passenger) &&
      distance(GetEntityCoords(vehicle), state.stop.at) < 18 &&
      GetEntitySpeed(vehicle) < 1 && !IsPedInVehicle(passenger, vehicle, false) &&
      GetGameTimer() >= passengerAttempt && IsVehicleSeatFree(vehicle, 1)) {
    passengerAttempt = GetGameTimer() + 5200
    TaskEnterVehicle(passenger, vehicle, 5000, 1, 1.5, 1, 0)
  }
  const targets = GetActivePlayers().filter(player => state.members.includes(GetPlayerServerId(player)))
    .map(GetPlayerPed).filter(ped => ped && !IsEntityDead(ped))
  for (const id of state.enemies) {
    const enemy = resolve(id)
    if (!enemy || IsEntityDead(enemy)) continue
    if (!NetworkHasControlOfEntity(enemy)) {
      configured.delete(id)
      continue
    }
    if (!configured.has(id)) {
      SetBlockingOfNonTemporaryEvents(enemy, true)
      SetPedDropsWeaponsWhenDead(enemy, false)
      SetPedAccuracy(enemy, 22)
      GiveWeaponToPed(enemy, GetHashKey('WEAPON_PISTOL'), 120, false, true)
      configured.add(id)
    }
    const coords = GetEntityCoords(enemy)
    const target = targets.reduce((best, ped) => {
      const dist = distance(coords, GetEntityCoords(ped))
      return dist < (best?.dist ?? 65) ? { ped, dist } : best
    }, undefined)
    if (target && !IsPedInCombat(enemy, target.ped)) TaskCombatPed(enemy, target.ped, 0, 16)
  }
}

setInterval(() => {
  if (!NetworkIsSessionStarted() || !NetworkIsPlayerActive(PlayerId())) return
  if (!initialized) {
    initialized = true
    NetworkSetFriendlyFireOption(false)
    SetCanAttackFriendly(PlayerPedId(), false, false)
    SetMaxWantedLevel(0)
    blip(base, 'Cuartel general · Tablón', 280, 3)
    blip(motorPool, 'Garaje personal', 357, 4)
    blip(Duo.hangar.at, 'Hangar de Sandy Shores', 423, 3)
    spawn()
    return
  }
  if (spawning) return
  if (IsEntityDead(PlayerPedId())) {
    if (panelOpen) closePanel()
    deathAt ||= GetGameTimer()
    if (GetGameTimer() - deathAt > 4500) {
      deathAt = 0
      spawn()
    }
  } else {
    deathAt = 0
    updateNPCs()
    updatePaint()
    streamHQ()
  }
}, 1100)

setTick(() => {
  const now = GetGameTimer()
  const connected = hudAvailable(now)
  let available = connected && now >= hud.retryAt
  const playable = initialized && !spawning && !IsPauseMenuActive() && !IsEntityDead(PlayerPedId())
  if (panelOpen && (!playable || !connected)) closePanel()
  hudVisibility(available && playable && !panelOpen)
  if (!playable || panelOpen) return
  const ped = PlayerPedId()
  const coords = GetEntityCoords(ped)
  const driving = GetVehiclePedIsIn(ped, false)
  if (available) {
    try {
      sampleTelemetry(ped, driving, coords, now)
    } catch (error) {
      available = false
      hud.retryAt = now + 3000
      hudVisibility(false)
      if (now >= hud.reportAt) {
        hud.reportAt = now + 30000
        console.error('[duo:HUD] Telemetría no disponible', error)
      }
    }
  }
  if (!available && driving && GetPedInVehicleSeat(driving, -1) === ped) {
    const speed = String(Math.round(GetEntitySpeed(driving) * 3.6)).padStart(3, '0')
    DrawRect(0.915, 0.82, 0.105, 0.065, 13, 22, 21, 218)
    label(0.873, 0.787, speed, 0.65)
    label(0.924, 0.819, 'KM/H', 0.35)
  }
  if (!available && now < notice.until) {
    DrawRect(0.28, 0.81, 0.49, 0.045, 10, 17, 25, 207)
    label(0.041, 0.798, notice.text)
  }
  let prompt
  if (state) {
    if (!available) {
      const { name, objective, detail, remaining } = missionHud()
      const seconds = Math.ceil(remaining)
      const clock = seconds ? '   ~y~' + Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0') + '~s~' : ''
      DrawRect(0.243, detail ? 0.078 : 0.067, 0.418, detail ? 0.103 : 0.08, 13, 20, 20, 217)
      label(0.045, 0.035, name + clock, 0.35)
      label(0.045, 0.061, objective, 0.39)
      if (detail) label(0.045, 0.097, detail, 0.31)
    }
    if (!state.failed && state.dialogue && GetGameTimer() < subtitleUntil) {
      DrawRect(0.5, 0.755, 0.71, 0.073, 10, 17, 25, 219)
      SetTextCentre(true)
      SetTextWrap(0.16, 0.84)
      label(0.5, 0.728, state.dialogue, 0.42)
      SetTextCentre(false)
      SetTextWrap(0.0, 1.0)
    }
    const reach = state.rally && state.step < state.total ? 14 : 6
    let canConfirm = false
    for (const site of state.targets) {
      const dist = distance(coords, site.at)
      if (site.air && dist < 420) {
        DrawMarker(28, ...site.at, 0, 0, 0, 0, 0, 0, 180, 180, 180, 85, 196, 255, 44,
          false, false, 2, false, null, null, false)
      } else if (dist < 65) marker(site.at, state.stop.gang ? [215, 55, 55] : [255, 190, 62])
      if (dist < (site.air ? 90 : reach)) canConfirm = true
    }
    if (canConfirm) prompt = {
      control: 38, text: 'Confirmar objetivo',
      run: () => request('step', { id: state.id, step: state.step })
    }
    const vehicle = resolve(state.vehicle)
    if (vehicle && distance(coords, GetEntityCoords(vehicle)) < 35) {
      const [x, y, z] = GetEntityCoords(vehicle)
      DrawMarker(2, x, y, z + 1.7, 0, 0, 0, 0, 0, 0, 0.45, 0.45, 0.45, 85, 196, 255, 190,
        true, false, 2, false, null, null, false)
    }
  }
  if (cache && distance(coords, cache.at) < 20) {
    marker(cache.at, [180, 240, 113])
    if (!prompt && distance(coords, cache.at) < 6) {
      prompt = { control: 47, text: 'Recoger alijo diario', run: () => request('claim') }
    }
  }
  for (const station of Duo.hq) {
    if (distance(coords, station.at) < 40) marker(station.at, station.color)
  }
  const hangarDistance = distance(coords, Duo.hangar.at)
  if (hangarDistance < 45) marker(Duo.hangar.at, [86, 197, 255])
  if (!prompt && hangarDistance < 4 && !state && !driving) {
    prompt = { control: 38, text: 'Hangar de Sandy Shores', run: () => openPanel('hangar') }
  }
  const station = Duo.hq.reduce((closest, point) => {
    const meters = distance(coords, point.at)
    return meters < (closest?.meters ?? 3.2) ? { point, meters } : closest
  }, null)?.point
  if (!prompt && station && !state && !driving) {
    prompt = { control: 38, text: station.name, run: () => openPanel(station.tab) }
  }
  showPrompt(prompt, available, now)
  if (prompt && IsControlJustReleased(0, prompt.control)) prompt.run()
})
