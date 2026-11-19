const { base, shop, motorPool, contracts } = Duo
let state
let routeBlips = []
let spawning = false
let deathAt = 0
let initialized = false
let configured = new Set()
let notice = { text: '', until: 0 }

const panelActions = new Set(['start', 'join', 'cancel', 'buy', 'buyCar', 'pull', 'park', 'paint', 'locate', 'locateCar', 'recoverCar',
  'startWorld', 'retry', 'chooseRoute'])
let panelOpen = false
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

function closePanel() {
  panelOpen = false
  SetNuiFocus(false, false)
  SendNuiMessage(JSON.stringify({ type: 'visible', visible: false }))
}

function openPanel() {
  if (!initialized || spawning || IsEntityDead(PlayerPedId()) || IsPauseMenuActive()) return
  panelOpen = true
  SetNuiFocus(true, true)
  SendNuiMessage(JSON.stringify({ type: 'visible', visible: true }))
  emitNet('duo:panel')
}

function nui(type, handle) {
  RegisterNuiCallbackType(type)
  on('__cfx_nui:' + type, (data, callback) => {
    handle(data)
    callback({ ok: true })
  })
}

nui('cierra', closePanel)
nui('accion', data => {
  if (!panelOpen || !panelActions.has(data?.operation)) return
  request(data.operation, data.value)
})

onNet('duo:panel', snapshot => {
  SendNuiMessage(JSON.stringify({ type: 'snapshot', snapshot }))
})
on('onClientResourceStop', resource => {
  if (resource === GetCurrentResourceName() && panelOpen) closePanel()
})
RegisterCommand('central', openPanel, false)
RegisterKeyMapping('central', 'Abrir la central de Los Santos a Dos', 'keyboard', 'F6')

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
  if (!state) return
  rallyEndsAt = state.remaining ? GetGameTimer() + state.remaining * 1000 : 0
  const color = state.stop.gang ? 1 : 5
  routeBlips = state.targets.map(site => blip(site.at, site.text, site.search ? 162 : 1, color))
  if (routeBlips.length && !state.targets[0].search) {
    SetBlipRoute(routeBlips[0], true)
    SetBlipRouteColour(routeBlips[0], color)
  }
})

onNet('duo:supply', item => {
  const ped = PlayerPedId()
  if (item === 'blindaje') SetPedArmour(ped, 100)
  if (item === 'botiquin') SetEntityHealth(ped, GetEntityMaxHealth(ped))
  if (item === 'carabina') GiveWeaponToPed(ped, GetHashKey('WEAPON_CARBINERIFLE'), 180, false, false)
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
    blip(base, 'Central de contratos', 280, 3)
    blip(motorPool, 'Garaje personal', 357, 4)
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
  }
}, 1100)

setTick(() => {
  if (!initialized || spawning || panelOpen) return
  const ped = PlayerPedId()
  const coords = GetEntityCoords(ped)
  const driving = GetVehiclePedIsIn(ped, false)
  if (driving && GetPedInVehicleSeat(driving, -1) === ped) {
    const speed = String(Math.round(GetEntitySpeed(driving) * 3.6)).padStart(3, '0')
    DrawRect(0.915, 0.82, 0.105, 0.065, 13, 22, 21, 218)
    label(0.873, 0.787, speed, 0.65)
    label(0.924, 0.819, 'KM/H', 0.35)
  }
  if (GetGameTimer() < notice.until) {
    DrawRect(0.28, 0.81, 0.49, 0.045, 10, 17, 25, 207)
    label(0.041, 0.798, notice.text)
  }
  if (state) {
    const role = state.objectives[0]
    const secondLine = state.objectives[1] && !state.objectives[1].startsWith('Equipo: ')
    DrawRect(0.292, secondLine ? 0.096 : 0.085, 0.523, secondLine ? 0.134 : 0.112, 10, 17, 25, 210)
    label(0.044, 0.04, state.name + '  |  ' + state.members.length + '/2', 0.46)
    const seconds = rallyEndsAt ? Math.max(0, Math.ceil((rallyEndsAt - GetGameTimer()) / 1000)) : 0
    const clock = seconds ? '  |  ' + Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0') : ''
    label(0.044, 0.081, state.stop.text + clock)
    if (role && role !== state.stop.text) label(0.044, 0.107, role, 0.32)
    if (secondLine) label(0.044, 0.129, state.objectives[1], 0.32)
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
      if (dist < 65) marker(site.at, state.stop.gang ? [215, 55, 55] : [255, 190, 62])
      if (dist < reach) canConfirm = true
    }
    if (canConfirm) {
      label(0.39, 0.89, '~y~E~s~  Confirmar objetivo', 0.45)
      if (IsControlJustReleased(0, 38)) request('step', { id: state.id, step: state.step })
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
    if (distance(coords, cache.at) < 6) {
      label(0.39, 0.86, '~y~G~s~  Recoger alijo diario', 0.45)
      if (IsControlJustReleased(0, 47)) request('claim')
    }
  }
  if (distance(coords, base) < 40) marker(base, [76, 173, 255])
  if (distance(coords, shop) < 40) marker(shop, [80, 215, 143])
  if (distance(coords, motorPool) < 45) marker(motorPool, [222, 169, 75])
  if ([base, shop, motorPool].some(at => distance(coords, at) < 5)) {
    label(0.36, 0.93, '~y~F6~s~  Contratos / Garaje / Suministros', 0.41)
  }
})



