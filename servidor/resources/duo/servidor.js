const { base, garage, shop, contracts, motorPool, parking, cars, paints } = Duo
const items = Duo.supplies
const lastAction = new Map()
const personalCars = new Map()
const personalAircraft = new Map()
let run
const gracePeriod = 5 * 60 * 1000

function send(player, message) {
  emitNet('duo:notice', player, message)
}

function near(entity, target, radius) {
  if (!entity || !DoesEntityExist(entity)) return false
  const [x, y, z] = GetEntityCoords(entity)
  return Math.hypot(x - target[0], y - target[1], z - target[2]) <= radius
}

function profileKey(player) {
  const license = GetPlayerIdentifierByType(String(player), 'license')?.toLowerCase()
  return /^license:[0-9a-f]+$/i.test(license || '') ? 'perfil-' + license.slice(8) + '.json' : null
}

function profile(player) {
  return DuoStore.load(profileKey(player))
}

function save(player, data) {
  return DuoStore.save(profileKey(player), data)
}

function chapterOf(mission) {
  return Duo.chapters.findIndex(chapter => chapter.missions.includes(mission))
}

function unlockedChapter(data) {
  const pending = Duo.chapters.findIndex(chapter =>
    !chapter.missions.every(mission => data.campaign.includes(mission)))
  return pending < 0 ? Duo.chapters.length - 1 : pending
}

function story2Complete(data) {
  return !!data && Duo.chapters.slice(Duo.story2.start).every(chapter =>
    chapter.missions.every(mission => data.campaign.includes(mission)))
}

function canJoin(player) {
  if (!run || run.started || run.engaged || run.disconnected.size || run.members.has(player) || run.members.size >= 2) return false
  const ped = GetPlayerPed(player)
  return run.incident
    ? near(ped, run.incident.at, 35) && !profile(player)?.incidents.includes(run.incident.id)
    : near(ped, base, 13)
}

function rescueTargets(player) {
  const pilot = run.members.get(player) === (run.rescueDriver || run.leadKey)
  const targets = []
  if (run.people.some(p => p.boarded)) targets.push({at:Duo.rescue.hospital,text:'Entregad juntos los supervivientes en Pillbox'})
  const index = run.people.findIndex(p => !p.lost && !p.boarded)
  if (index >= 0 && !pilot) targets.unshift({at:Duo.rescue.people[index],text:'Localiza al civil y confirma junto a él'})
  if (pilot && !targets.length) targets.push({at:Duo.rescue.meeting,text:'Conduce a Davis y sigue las indicaciones del rescatista'})
  return targets
}

function rescueTick() {
  let changed = false
  for (const [i,person] of run.people.entries()) {
    if (person.lost) continue
    const at = Duo.rescue.people[i]
    if (!person.entity) {
      if (!Array.from(run.members.keys()).some(id => near(GetPlayerPed(id),at,100))) continue
      person.entity = createPed('a_m_m_business_01',at)
      if (!person.entity) return failure('No se pudo crear el encuentro.')
      FreezeEntityPosition(person.entity,true)
      for (const [dx,dy] of [[24,9],[-22,13],[15,-24]]) {
        const enemy = createPed('u_m_y_zombie_01',[at[0]+dx,at[1]+dy,at[2]])
        if (!enemy) return failure('No se pudo crear el encuentro.')
        run.enemies.push(enemy)
      }
      changed = true
    }
    if (!alive(person.entity)) {
      person.lost = true
      person.boarded = false
      if (run.enemies.length < 8 && near(person.entity,at,40)) {
        const infected = createPed('u_m_y_zombie_01',GetEntityCoords(person.entity))
        if (infected) run.enemies.push(infected)
      }
      changed = true
    } else {
      const aboard = GetVehiclePedIsIn(person.entity,false) === run.vehicle
      if (aboard !== person.boarded) { person.boarded = aboard; changed = true }
    }
  }
  if (run.people.every(p => p.lost)) return failure('Se perdió el último superviviente.')
  if (changed) sync()
}

function rescueStep(player) {
  const ped = GetPlayerPed(player)
  if (!alive(ped)) return
  const hospital = Duo.rescue.hospital
  if (near(ped,hospital,10)) {
    const rescued = run.people.filter(p => alive(p.entity) && GetVehiclePedIsIn(p.entity,false) === run.vehicle).length
    if (!rescued || !near(run.vehicle,hospital,15) || GetEntitySpeed(run.vehicle)>1 ||
        !Array.from(run.members.keys()).every(id => alive(GetPlayerPed(id)) && near(GetPlayerPed(id),hospital,14)))
      return send(player,'Reuníos con la ambulancia parada y un superviviente a bordo.')
    run.bonus = rescued === 2 ? 800 : 0
    return completeContract(player)
  }
  if (run.members.get(player) === (run.rescueDriver || run.leadKey)) return send(player,'El rescatista confirma la recogida.')
  const i = run.people.findIndex(p => !p.boarded && !p.lost)
  if (i < 0) return
  const person = run.people[i]
  const at = Duo.rescue.people[i]
  const driver = [...run.members].find(([,key]) => key === (run.rescueDriver || run.leadKey))[0]
  if (!alive(person.entity) || !near(ped,at,7) || GetVehiclePedIsIn(ped,false) ||
      !near(run.vehicle,at,15) || GetEntitySpeed(run.vehicle)>1 || GetPedInVehicleSeat(run.vehicle,-1)!==GetPlayerPed(driver))
    return send(player,'El conductor debe parar cerca del civil y el rescatista bajar a recogerlo.')
  if (GetPedInVehicleSeat(run.vehicle,i+1)) return send(player,'Liberad el asiento trasero del superviviente.')
  FreezeEntityPosition(person.entity,false)
  SetPedIntoVehicle(person.entity,run.vehicle,i+1)
  rescueTick()
}

function playerTargets(stop, player) {
  if (run.people && run.step) return rescueTargets(player)
  if (run.people && run.step) return [rescueTargets(player)[0]?.text || 'Espera al equipo', 'A bordo · '+run.people.filter(p=>p.boarded).length+'/2']
  if (run.heist && run.step) return [DuoHeist.target(run,player)]
  if (run.key === 'guardacostas' && run.step > 0) {
    const pilot = run.members.get(player) === run.leadKey
    if (run.step === 1 && pilot && !run.pilotReady)
      return [{ at: Duo.sea.helipad, text:'Recoge el Maverick en Sandy Shores' }]
    if (run.step === 1 && pilot) return [{ at: run.wreckAt, text: 'Localiza el barco desde el Maverick', air: true }]
    if (run.step === 1) return [{ at: Duo.sea.dock, text: 'Toma el mando de la lancha y espera indicaciones' }]
    if (pilot) return run.step === 2 ? [{ at: run.wreckAt, text: 'Guía a la lancha por Teams', air: true }] : []
    return [{ at: run.step === 2 ? run.wreckAt : Duo.sea.dock, text: currentStop().text, localOnly: run.step === 2 }]
  }
  return stop.briefing || stop.paired ? operationTargets(stop, player) : stopTargets(stop, run.members.size)
}

function operationTargets(stop, player) {
  const role = Number(run.members.get(player) !== run.leadKey)
  if (run.confirmed.has(role)) return []
  return stop.briefing ? [{ at: stop.at, text: stop.text, index: role }] :
    [{ ...stop.paired.sites[role], index: role }]
}

function objectives(player) {
  if (!run?.members.has(player)) return []
  const stop = currentStop()
  if (run.heist && run.step) return [run.disconnected.size ? 'Esperando a tu compañero.' : DuoHeist.hint(run,player),
    'Botín asegurado · $'+run.heist.secured+' por persona']
  if (!run.failed && run.key === 'guardacostas' && run.step > 0) return [playerTargets(stop, player)[0]?.text || 'Orienta al patrón y acompaña el rescate desde el aire.']
  if (!run.failed && stop.air && run.members.size === 2) {
    const pilot = GetPedInVehicleSeat(run.vehicle, -1)
    return [GetPlayerPed(player) === pilot
      ? 'Piloto: mantén la aeronave dentro del control.'
      : 'Copiloto: pulsa E dentro del control aéreo.']
  }
  if (run.failed) return [run.failed.message, 'Abre F6 para reintentar desde el último punto.']
  if (run.incident && run.members.size === 2) {
    if (run.contract.kind !== 'Búsqueda') {
      const lead = run.members.get(player) === run.leadKey
      return [stop.text, lead ? 'Piloto: mantén el vehículo en posición.' : 'Copiloto: confirma el objetivo.']
    }
    if (stop.search) {
      const axis = Number(run.members.get(player) !== run.leadKey)
      const sorted = [...stop.search, stop.at].sort((a, b) => a[axis] - b[axis])
      const direction = axis ? 'sur a norte' : 'oeste a este'
      return [stop.text, 'Pista: punto ' + (sorted.indexOf(stop.at) + 1) + '/' + sorted.length + ' de ' + direction + '.']
    }
  }
  if (run.key === 'ultima_recogida' && run.step === 1 && run.pick !== undefined)
    return [run.members.get(player) === run.leadKey ? 'Detén la furgoneta en '+stop.text : 'Baja y recoge '+stop.boxes+' bultos en '+stop.text]
  if (run.contract.duoOnly) {
    if (run.members.size < 2) return ['Esperando a tu compañero.']
    if (stop.briefing || stop.paired) {
      const target = operationTargets(stop, player)[0]
      return target ? [target.text] : ['Has confirmado. Espera a tu compañero.']
    }
  }
  if (stop.clues) {
    const role = Array.from(run.members.keys()).indexOf(player)
    return run.members.size === 1 ? stop.clues : [stop.clues[role], 'Comparte tu pista con tu compañero.']
  }
  if (stop.dispatch) return [run.members.get(player) === run.leadKey ? 'Espera a que tu copiloto marque el comercio.' : stop.text]
  if (stop.choice) {
    if (run.choice !== undefined) return [stop.choice[run.choice].text]
    return [canChooseRoute(player) ? 'Abre F6 y elige una ruta.' : 'El copiloto elige la ruta desde F6.']
  }
  if (stop.parallel) {
    const remaining = stopTargets(stop, run.members.size)
    if (run.members.size > 1 && Array.from(run.confirmed.values()).includes(run.members.get(player))) {
      return ['Tu punto está confirmado.', 'Equipo: ' + remaining[0].text]
    }
    if (remaining.length === 1) return [remaining[0].text]
  }
  if (!stop.roles || run.members.size === 1) return [stop.text]
  const role = stop.relay && run.relayDriver
    ? Number(profileKey(player) !== run.relayDriver)
    : run.contract.duoOnly ? Number(run.members.get(player) !== run.leadKey) : Array.from(run.members.keys()).indexOf(player)
  return [stop.roles[role], 'Equipo: ' + stop.roles[1 - role]]
}

function notifyPayments(settled) {
  for (const entry of settled) {
    const player = getPlayers().find(id => profileKey(id) === entry.key)
    if (!player) continue
    const mark = entry.record ? ' · Récord: ' + (entry.record / 1000).toFixed(1) + ' s' : ''
    send(Number(player), entry.name + ' · $' + entry.pay + ' · Saldo: $' + entry.cash + mark)
    panel(Number(player))
  }
}

function day() {
  return Math.floor(Date.now() / 86400000)
}

function dailyCache() {
  return Duo.caches[day() % Duo.caches.length]
}

function dailyWorld() {
  return Duo.worldEvents[day() % Duo.worldEvents.length]
}

const incidentPeriod = 20 * 60 * 1000
function incidentWindow() {
  return Math.floor(Date.now() / incidentPeriod)
}

function incidentOffers() {
  const window = incidentWindow()
  return Duo.incidentDistricts.map((district, index) => {
    const [route, at] = district.sites[(window + index) % district.sites.length]
    const contract = Duo.worldEvents[route]
    return { id: window + ':' + contract.key, district: district.name, contract, at, expires: (window + 1) * incidentPeriod }
  })
}

function incidentBoard(player, data = profile(player)) {
  const ped = GetPlayerPed(player)
  const [x, y, z] = ped && DoesEntityExist(ped) ? GetEntityCoords(ped) : [0, 0, 0]
  return incidentOffers().map(({ id, district, contract, at, expires }) => {
    const { name, kind, zone, brief, pay } = contract
    const distance = Math.round(Math.hypot(x - at[0], y - at[1], z - at[2]))
    const completed = !!data?.incidents.includes(id)
    return { id, district, name, kind, zone, brief, pay, at, expires, distance, completed,
      canStart: !!data && !run && !completed && near(ped, at, 35) }
  }).sort((a, b) => a.distance - b.distance)
}

function pushIncidents(player) {
  emitNet('duo:incidents', player, incidentBoard(player))
}

function canChooseRoute(player) {
  if (!run?.members.has(player) || run.failed || !currentStop().choice || run.choice !== undefined) return false
  if (run.contract.duoOnly && run.members.size < 2) return false
  if (run.members.size === 1) return true
  const driver = GetPedInVehicleSeat(run.vehicle, -1)
  const pilot = Array.from(run.members.keys()).find(member => GetPlayerPed(member) === driver)
  return pilot === undefined ? Array.from(run.members.keys())[1] === player : pilot !== player
}

function featuredContract() {
  const choices = ['costa', 'nocturno', 'rural', 'rally', 'barrio', 'desierto', 'puerto']
  return choices[day() % choices.length]
}

function fleetView(active, air, vehicles) {
  const bays = air ? Duo.hangar.parking : parking
  const radius = air ? 10 : 2.7
  const busy = bays.map(slot => vehicles.some(entity => entity !== active?.entity && near(entity, slot, radius)))
  let parkHint = ''
  if (active && alive(active.entity)) {
    const center = air ? Duo.hangar.at : motorPool
    if (!near(active.entity, center, air ? 38 : 32)) parkHint = 'Devuelve el vehículo a su estacionamiento.'
    else if (getPlayers().some(id => {
      const ped = GetPlayerPed(id)
      return ped && GetVehiclePedIsIn(ped, false) === active.entity
    })) {
      parkHint = 'Todos deben bajar antes de guardar el vehículo.'
    }
  }
  return { free: busy.filter(used => !used).length, parkHint }
}

function remainingTime() {
  const due = run.heist?.expires || run.pairUntil || run.deadline
  return due ? Math.max(0, Math.ceil((due - Date.now()) / 1000)) : 0
}

function missionView(player) {
  if (!run) return null
  const stop = currentStop()
  const connections = new Set(run.members.values())
  const members = Array.from(run.names.keys()).filter(key => connections.has(key) || run.disconnected.has(key))
  const confirmed = new Set(run.confirmed.values())
  const stage = run.failed ? 'failed' : run.disconnected.size ? 'reconnect' :
    stop.briefing ? 'briefing' : run.step === run.contract.stops.length ? 'return' : 'field'
  const crew = [0, 1].map(index => {
    const key = members[index]
    return {
      name: run.names.get(key) || 'Plaza libre',
      role: run.people && key ? run.contract.roles[Number(key !== (run.rescueDriver || run.leadKey))] : run.contract.roles?.[index] || (run.incident && run.contract.kind !== 'Búsqueda'
        ? (index ? 'Copiloto y confirmación' : 'Conducción') : 'Integrante del equipo'),
      self: !!key && run.members.get(player) === key,
      status: !key ? 'vacant' : !connections.has(key) ? 'away' :
        confirmed.has(key) ? (stop.briefing ? 'ready' : 'confirmed') :
        stop.briefing || stop.paired || stop.parallel ? 'pending' : 'active'
    }
  })
  return {
    stage, deliveryLabel: run.handler && stage === 'return' ? 'Entrega en LSIA' : null, name: run.contract.name,
    area: run.incident?.contract.zone || run.contract.area, incident: run.incident?.id || null,
    vehicle: run.contract.vehicleName || cars[run.contract.vehicle]?.name || run.contract.vehicle,
    pay: run.contract.pay + run.bonus, step: run.step + 1, total: run.contract.stops.length + (run.incident || run.people || run.key === 'guardacostas' ? 0 : 1),
    remaining: remainingTime(), crew
  }
}

function panel(player) {
  const data = profile(player)
  const vehicle = personalCars.get(player)
  const aircraft = personalAircraft.get(player)
  const ped = GetPlayerPed(player)
  const member = !!run?.members.has(player)
  const stop = member ? currentStop() : null
  const { key, name, kind, zone, brief, pay } = dailyWorld()
  const vehicles = GetAllVehicles()
  const carBay = fleetView(vehicle, false, vehicles)
  emitNet('duo:panel', player, {
    heist: DuoHeist.view(run,player), completedHeists: data?.heists || [],
    dispatch: dispatchView(player), setup: shiftView(player, data),
    resumeName: !run && data?.checkpoint && !data.receipts.includes(data.checkpoint.receipt) ? contracts[data.checkpoint.key]?.name : null,
    startDistance: ped ? Math.round(Math.hypot(...GetEntityCoords(ped).slice(0,3).map((v,i) => v - base[i]))) : null,
    crew: getPlayers().length,
    garageBays: parking.map(slot => vehicles.some(entity => near(entity, slot, 2.7))),
    fleet: { garage: carBay, hangar: fleetView(aircraft, true, vehicles) },
    cash: data?.cash ?? null, completed: data?.completed || 0,
    cars: data?.cars || {}, bestRally: data?.bestRally || 0,
    weapons: data?.weapons || [],
    food: data?.food || {},
    operations: data?.operations || [],
    settlement: data?.lastSettlement || null,
    incidents: incidentBoard(player, data),
    mission: missionView(player),
    operation: member && run.contract.duoOnly ? {
      id: run.id, step: run.step, role: run.contract.roles[Number(run.members.get(player) !== (run.rescueDriver || run.leadKey))],
      chooseRescueRole: !!run.people && run.step === 0 && run.members.size === 2 && !run.confirmed.size,
      count: run.members.size, briefing: !!stop.briefing, paired: !!stop.paired,
      confirmed: run.confirmed.size,
      canBrief: !run.failed && !!stop.briefing && run.members.size === 2 && near(ped, base, 7) &&
        !run.confirmed.has(Number(run.members.get(player) !== run.leadKey))
    } : null,
    campaign: data?.campaign || [], unlockedChapter: data ? unlockedChapter(data) : 0,
    story2Reward: story2Complete(data),
    retryAvailable: member && !!run.checkpoint,
    dialogue: member ? run.dialogue : '',
    routeOptions: canChooseRoute(player) ? stop.choice.map((choice, index) => ({ index, text: choice.text })) : [],
    routeLabel: stop?.choice?.[run.choice]?.text || '',
    world: { key, name, kind, zone, brief, pay, canStart: !!data && !run && near(ped, base, 8) },
    phase: run?.members.has(player) ? 'Fase ' + (run.step + 1) + ' de ' + (run.contract.stops.length + 1) : '',
    objectives: objectives(player),
    activeCar: vehicle && alive(vehicle.entity) ? vehicle.model : null,
    lostCar: vehicle && !alive(vehicle.entity) ? vehicle.model : null,
    activeAircraft: aircraft && alive(aircraft.entity) ? aircraft.model : null,
    lostAircraft: aircraft && !alive(aircraft.entity) ? aircraft.model : null,
    atHangar: near(ped, Duo.hangar.at, 24),
    featured: featuredContract(),
    cache: { label: dailyCache().label, hint: dailyCache().hint, claimed: data?.cacheDay === day() },
    atBase: near(ped, base, 8), atGarage: near(ped, motorPool, 18),
    atShop: near(ped, shop, 7), ongoing: run ? run.contract.name : null,
    member: !!run?.members.has(player), canJoin: canJoin(player)
  })
}

function handleGarage(player, action, value, data) {
  const model = typeof value === 'string' ? value : value?.model
  const car = Object.hasOwn(cars, model) ? cars[model] : null
  const air = !!car?.type
  const fleet = air ? personalAircraft : personalCars
  const station = air ? Duo.hangar.at : motorPool
  const active = fleet.get(player)
  const garageLabel = air ? 'hangar' : 'garaje'
  if (action === 'locateCar') {
    if (!active || !alive(active.entity) || (model && model !== active.model)) return send(player, 'No tienes ese vehículo activo.')
    emitNet('duo:locateCar', player, GetEntityCoords(active.entity))
    return send(player, 'Tu vehículo se ha marcado en el GPS.')
  }
  if (!near(GetPlayerPed(player), station, air ? 24 : 18)) return send(player, 'Acércate al ' + garageLabel + '.')
  if (action === 'recoverCar' && (!active || alive(active.entity) || value !== active.model)) {
    return send(player, 'No tienes ese coche pendiente de recuperar.')
  }
  if (action === 'park' || action === 'pull') {
    if (active && !alive(active.entity)) return send(player, 'Recupera primero tu coche en el garaje.')
    if (active) {
      if (action === 'pull') return send(player, 'Guarda primero tu vehículo actual.')
      if (model && model !== active.model) return send(player, 'Ese vehículo no está fuera.')
      if (!near(active.entity, station, air ? 38 : 32)) return send(player, 'Trae el vehículo al ' + garageLabel + ' para guardarlo.')
      const occupied = getPlayers().some(id => {
        const ped = GetPlayerPed(id)
        return ped && GetVehiclePedIsIn(ped, false) === active.entity
      })
      if (occupied) return send(player, 'Bajad del coche antes de guardarlo.')
      clean(active.entity)
      fleet.delete(player)
      return send(player, 'Vehículo guardado.')
    }
    fleet.delete(player)
    if (action === 'park') return send(player, 'No tienes ningún coche fuera.')
  }
  if (!car) return
  if (action === 'buyCar') {
    if (data.cars[model]) return send(player, 'Ya tienes este coche.')
    if (data.cash < car.price) return send(player, 'Saldo insuficiente.')
    data.cash -= car.price
    data.cars[model] = 'grafito'
    return send(player, save(player, data) ? car.name + ' añadido al ' + garageLabel + '.' : 'No se pudo guardar la compra.')
  }
  if (!data.cars[model]) return send(player, 'Compra este coche antes de usarlo.')
  if (action === 'paint') {
    if (typeof value?.paint !== 'string' || !Object.hasOwn(paints, value.paint)) return
    if (paints[value.paint].requires === 'story2' && !story2Complete(data)) {
      return send(player, 'Completa Frecuencia fantasma para desbloquear esta pintura.')
    }
    data.cars[model] = value.paint
    if (!save(player, data)) return send(player, 'No se pudo guardar el color.')
    if (active?.model === model && DoesEntityExist(active.entity)) {
      Entity(active.entity).state.set('duoPaint', paints[value.paint].rgb, true)
    }
    return send(player, 'Pintura guardada: ' + paints[value.paint].name)
  }
  const slots = air ? Duo.hangar.parking : parking
  const vehicles = GetAllVehicles()
  const at = slots.find(slot => !vehicles.some(entity => entity !== active?.entity && near(entity, slot, air ? 10 : 2.7)))
  if (!at) return send(player, 'Las plazas de salida están ocupadas.')
  const entity = CreateVehicleServerSetter(GetHashKey(model), car.type || 'automobile', ...at)
  if (!entity) return send(player, 'No se pudo sacar el coche.')
  if (action === 'recoverCar') clean(active.entity)
  SetEntityOrphanMode(entity, 2)
  Entity(entity).state.set('duoPaint', (paints[data.cars[model]] || paints.grafito).rgb, true)
  fleet.set(player, { entity, model })
  send(player, car.name + ' disponible junto al ' + garageLabel + '.')
}

function currentStop() {
  if (run.handler && run.step === 2) return { at: Duo.eclipse.landing, text: 'Aterrizad juntos en la entrega de LSIA' }
  if (run.key === 'ultima_recogida' && run.step === 1) return run.pick !== undefined
    ? Duo.pickups[run.pick] : { at: Duo.garage, text: 'Copiloto: abre F6 para elegir la siguiente parada', dispatch: true }
  if (run.key === 'noche_davis' && run.step === 1) {
    const neighbor = Duo.davis[run.neighbor]
    return { at: run.returnVisit ? neighbor.next : neighbor.end, text: run.returnVisit ? neighbor.follow :
      ['Entrega el parte de avería en el taller', 'Entrega las cajas del comercio', 'Deja a Rosa en Pillbox'][run.neighbor] }
  }
  return run.contract.stops[run.step] || (run.contract.returnAt
    ? { at: run.contract.returnAt, text: 'Aterriza y estaciona en el punto indicado' }
    : { at: garage, text: 'Devuelve el vehiculo a la base' })
}

function alive(entity) {
  return !!entity && DoesEntityExist(entity) && GetEntityHealth(entity) > 0
}

function stopTargets(stop, count) {
  if (stop.dispatch) return []
  if (stop.choice) {
    if (run.choice === undefined) return []
    return [stop.choice[run.choice]]
  }
  if (stop.search) return [...stop.search, stop.at]
    .filter(at => !run.searched.has(at))
    .sort((first, second) => first[0] - second[0])
    .map(at => ({ at, text: 'Inspecciona la ubicación', search: true }))
  if (stop.parallel) {
    const targets = [stop.at, stop.parallel].map((at, index) => ({
      at, text: index ? stop.parallelText : stop.text, index
    })).filter(target => !run.confirmed.has(target.index))
    return count < 2 ? targets.slice(0, 1) : targets
  }
  return [{ at: stop.at, text: stop.text, air: !!stop.air }]
}

function net(entity) {
  return entity && DoesEntityExist(entity) ? NetworkGetNetworkIdFromEntity(entity) : 0
}

function sync(player = -1) {
  const recipients = player === -1 ? getPlayers().map(Number) : [player]
  for (const recipient of recipients) {
    const stop = run && currentStop()
    const participating = run?.members.has(recipient)
    emitNet('duo:state', recipient, participating ? {
      id: run.id, step: run.step, name: run.contract.name,
      terminal: !!run.heist && run.step === 1, cockpit: run.heist ? DuoHeist.cockpit(run,recipient) : null, crane: net(run.handler), cargo: DuoHeist.cargo(run,recipient),
      airReturn: !!run.contract.returnAt && run.step === run.contract.stops.length,
      finalDuo: !!run.contract.duoOnly && run.step === run.contract.stops.length,
      incidentKind: run.incident?.contract.kind || (run.key === 'noche_davis' && run.choice !== undefined ?
        ['Auxilio','Búsqueda','Vecino'][run.choice] : null),
      sceneAt: run.incident ? stop.at : run.key === 'noche_davis' && run.choice !== undefined ? Duo.davis[run.choice].at : null, stop: { at: stop.at, text: stop.choice?.[run.choice]?.text || stop.text, gang: stop.gang || null },
      targets: run.failed || (run.contract.duoOnly && run.members.size < 2) ? [] :
        playerTargets(stop, recipient),
      dialogue: run.dialogue,
      failed: !!run.failed,
      objectives: objectives(recipient),
      vehicle: net(run.vehicle), boat: net(run.boat), waving: run.key === 'guardacostas' && run.step === 2 ? net(run.castaway) : 0, passenger: net(run.passenger),
      tow: net(run.tow),
      escort: run.escort ? { vehicle: net(run.escort.vehicle), driver: net(run.escort.driver), at: stop.at } : null,
      outbreak: run.people ? run.people.filter(p => !p.lost && !p.boarded).map(p=>net(p.entity)).filter(Boolean) : null,
      enemies: run.enemies.map(net).filter(Boolean), engaged: run.engaged,
      total: run.contract.stops.length,
      remaining: remainingTime(),
      teamwork: run.contract.duoOnly ? {
        stage: run.disconnected.size ? 'reconnect' : stop.briefing ? 'briefing' : stop.paired ? 'paired' : 'field',
        confirmed: Array.from(run.confirmed.values()).includes(run.members.get(recipient)),
        teammateConfirmed: Array.from(run.confirmed.values()).some(key => key !== run.members.get(recipient)),
        switching: !!stop.relay && !!run.relayDriver
      } : null,
      rally: run.key === 'rally', members: Array.from(run.members.keys())
    } : null)
  }
}

function clean(entity) {
  if (entity && DoesEntityExist(entity)) DeleteEntity(entity)
}

function clearStageEntities() {
  for (const enemy of run.enemies) clean(enemy)
  for (const vehicle of run.scene) clean(vehicle)
  run.enemies = []
  run.scene = []
  run.sceneLoaded = false
}

function clearMissionEntities() {
  clearStageEntities()
  clean(run.passenger)
  clean(run.tow)
  clean(run.escort?.driver)
  clean(run.escort?.vehicle)
  clean(run.vehicle)
  for (const person of run.people || []) clean(person.entity)
  clean(run.handler)
  for (const entity of [run.boat, run.castaway, run.wreck]) clean(entity)
}

function finish(message) {
  if (!run) return
  for (const player of run.members.keys()) send(player, message)
  clearMissionEntities()
  run = undefined
  sync()
}

function failure(message) {
  if (!run.checkpoint) return finish(message)
  if (run.failed) return
  run.failed = { message, at: Date.now() }
  run.deadline = 0
  clearMissionEntities()
  for (const player of run.members.keys()) send(player, message + ' Reintenta desde F6.')
  sync()
}

function retry(player) {
  if (!run?.members.has(player) || !run.checkpoint) return
  if (run.contract.duoOnly && run.members.size < 2) return send(player, 'Espera a tu compañero para reintentar.')
  const checkpoint = run.checkpoint
  run.receipt ||= run.id
  const vehicle = CreateVehicleServerSetter(GetHashKey(run.contract.vehicle), run.contract.type, ...checkpoint.at)
  if (!vehicle) return send(player, 'La plaza del punto de control no está disponible. Vuelve a intentarlo.')
  SetEntityOrphanMode(vehicle, 2)
  clearMissionEntities()
  Object.assign(run, {
    id: DuoStore.id(), vehicle, step: checkpoint.step, failed: undefined,
    relayDriver: checkpoint.relayDriver, choice: undefined, pairUntil: 0, created: Date.now(),
    dialogue: checkpoint.dialogue,
    deadline: checkpoint.timed ? Date.now() + run.contract.timeLimit * 1000 : 0,
    passenger: 0, tow: 0, escort: undefined, engaged: false
  })
  run.searched.clear()
  run.confirmed.clear()
  sync()
  for (const member of run.members.keys()) {
    emitNet('duo:locateCar', member, checkpoint.at)
    send(member, 'Punto de control restaurado. El GPS indica el vehículo del contrato.')
  }
}

function createPed(model, at) {
  const ped = CreatePed(4, GetHashKey(model), at[0], at[1], at[2], at[3] || 0, true, true)
  if (ped) SetEntityOrphanMode(ped, 2)
  return ped
}

function start(player, key, world = false, incident = null) {
  const ped = GetPlayerPed(player)
  if (incident ? !alive(ped) || !near(ped, incident.at, 35) : !near(ped, base, 8)) {
    return send(player, incident ? 'Acércate al punto de encuentro.' : 'Ve a la central para elegir contrato.')
  }
  if (run) return send(player, 'Ya hay un contrato. Tu companero puede incluirte con /unir en la central.')
  const contract = incident?.contract || (world ? dailyWorld() : Object.hasOwn(contracts, key) && contracts[key])
  if (world || incident) key = contract.key
  if (!contract) return send(player, 'Contratos: ' + Object.keys(contracts).join(', '))
  if (contract.duoOnly && getPlayers().length < 2) return send(player, 'Esta operación requiere dos jugadores conectados.')
  const data = profile(player)
  if (!data) return send(player, 'No se pudo cargar tu perfil de FiveM.')
  if (incident && data.incidents.includes(incident.id)) return send(player, 'Ya has cobrado este incidente.')
  if (chapterOf(key) > unlockedChapter(data)) return send(player, 'Completa primero los capítulos anteriores.')
  const vehicle = CreateVehicleServerSetter(GetHashKey(contract.vehicle), contract.type, ...(key === 'proyecto_eclipse' ? Duo.eclipse.pad : key === 'guardacostas' ? Duo.sea.helipad : incident?.at || contract.launch || garage))
  if (!vehicle) return send(player, 'El vehiculo no se pudo crear. Prueba otra vez.')
  SetEntityOrphanMode(vehicle, 2)
  run = {
    id: DuoStore.id(), key, contract, incident, vehicle, step: 0, members: new Map([[player, profileKey(player)]]),
    leadKey: profileKey(player), pairUntil: 0,
    names: new Map([[profileKey(player), GetPlayerName(String(player)) || 'Jugador 1']]),
    bonus: key === featuredContract() ? Math.floor(contract.pay / 4) : 0,
    disconnected: new Map(), searched: new Set(), confirmed: new Map(), started: false,
    dialogue: contract.intro || '',
    passenger: 0, enemies: [], scene: [], sceneLoaded: false, engaged: false, created: Date.now()
  }
  if (key === 'ultima_ambulancia') run.people = Duo.rescue.people.map(() => ({entity:0,boarded:false,lost:false}))
  if (contract.heist) run.heist = DuoHeist.create()
  if (key === 'proyecto_eclipse') {
    run.handler = CreateVehicleServerSetter(GetHashKey('handler'),'automobile',...Duo.eclipse.handler)
    if (!run.handler) return finish('Central: la grúa no está disponible.')
    SetEntityOrphanMode(run.handler,2)
  }
  if (key === 'ultima_recogida') run.collected = []
  if (key === 'guardacostas') {
    run.wreckAt = Duo.sea.search[Math.floor(Math.random() * Duo.sea.search.length)]
    run.boat = CreateVehicleServerSetter(GetHashKey('dinghy'), 'boat', ...Duo.sea.dock)
    run.wreck = CreateVehicleServerSetter(GetHashKey('suntrap'), 'boat', ...run.wreckAt, 180)
    if (!run.boat || !run.wreck) return finish('Central: rescate no disponible.')
    for (const entity of [run.boat, run.wreck]) SetEntityOrphanMode(entity, 2)
    FreezeEntityPosition(run.wreck, true)
  }
  if (contract.passenger) {
    run.passenger = createPed(contract.passenger, currentStop().at)
    if (!run.passenger) return finish('No se pudo generar el pasajero.')
  }
  send(player, contract.name + (incident ? ' · Tu compañero puede unirse aquí antes de empezar.' :
    ' | Usa el vehiculo asignado. Tu companero puede usar /unir en la central.'))
  sync()
  for (const id of getPlayers()) {
    if (Number(id) !== player) send(Number(id), 'Invitación · ' + contract.name +
      (incident ? '. Ve al punto de encuentro para unirte.' : '. Abre el cuartel para unirte.'))
  }
}

function chooseRoute(player, value) {
  if (!canChooseRoute(player) || !Number.isInteger(value) || !currentStop().choice[value]) return
  run.started = true
  run.choice = value
  const text = currentStop().choice[value].text
  sync()
  for (const member of run.members.keys()) send(member, 'Ruta elegida · ' + text)
}

function join(player) {
  if (run?.members.has(player)) return
  if (!canJoin(player)) {
    return send(player, run?.incident ? 'Únete en el punto de encuentro antes de empezar.' :
      'Puedes unirte en la central antes del primer objetivo.')
  }
  if (run.resumePending && !run.resumePending.crew.includes(profileKey(player))) return send(player, 'Esta salida pertenece al equipo original.')
  if (!profile(player)) return send(player, 'No se pudo cargar tu perfil de FiveM.')
  if ((run.contract.duoOnly || run.incident) && run.leadKey === profileKey(player)) {
    return send(player, 'Cada integrante necesita su propio perfil.')
  }
  run.members.set(player, profileKey(player))
  run.names.set(profileKey(player), GetPlayerName(String(player)) || 'Jugador 2')
  if (run.resumePending) return restoreShift(player)
  send(player, 'Te has unido al contrato.')
  sync()
}

function prepareTow(stop) {
  if (run.tow) return true
  run.tow = CreateVehicleServerSetter(GetHashKey(stop.tow), 'automobile', ...stop.at)
  if (!run.tow) return false
  SetEntityOrphanMode(run.tow, 2)
  return true
}

function loadScene(stop) {
  if (run.sceneLoaded || !stop.scene ||
      !Array.from(run.members.keys()).some(player => near(GetPlayerPed(player), stop.at, 90))) return
  run.sceneLoaded = true
  for (const { model, at } of stop.scene) {
    const vehicle = CreateVehicleServerSetter(GetHashKey(model), 'automobile', ...at)
    if (!vehicle) continue
    SetEntityOrphanMode(vehicle, 2)
    FreezeEntityPosition(vehicle, true)
    SetVehicleDoorsLocked(vehicle, 2)
    run.scene.push(vehicle)
  }
}

function spawnEscort(stop) {
  const vehicle = CreateVehicleServerSetter(GetHashKey(stop.escort), 'automobile', ...stop.at)
  if (!vehicle) return false
  const driver = createPed('s_m_m_dockwork_01', [stop.at[0] + 2.5, ...stop.at.slice(1)])
  if (!driver) {
    clean(vehicle)
    return false
  }
  SetEntityOrphanMode(vehicle, 2)
  run.escort = { vehicle, driver }
  return true
}

function completeContract(player) {
  const pending = {
    name: run.contract.name, pay: run.contract.pay + run.bonus, rallyTime: run.rallyTime || 0,
    breakdown: run.heist ? { base: run.contract.pay, extra: run.bonus } : undefined,
    entries: Array.from(run.members.values(), key => {
      const data = DuoStore.load(key)
      const chapter = chapterOf(run.key)
      return { key, campaign: data && chapter >= 0 && chapter <= unlockedChapter(data) ? run.key : null,
        heist: run.heist ? run.key : null, davis: run.neighbor, operation: run.contract.duoOnly && !run.heist ? run.key : null, incident: run.incident?.id || null }
    })
  }
  if (!DuoStore.record(run.receipt || run.id, pending)) return send(player, 'No se pudo registrar el pago. Pulsa E para reintentar.')
  const file = 'pago-' + (run.receipt || run.id) + '.json'
  finish('Contrato completado. Procesando el pago…')
  notifyPayments(DuoStore.settle(file))
  publishExhibit()
  for (const id of getPlayers()) pushIncidents(Number(id))
}

function relayReady(player, ped) {
  const driver = GetPedInVehicleSeat(run.vehicle, -1)
  if (!driver || GetVehiclePedIsIn(ped, false) !== run.vehicle) {
    send(player, 'Confirma el relevo desde el vehículo asignado.')
    return false
  }
  const driverKey = Array.from(run.members).find(([id]) => GetPlayerPed(id) === driver)?.[1]
  if (run.contract.duoOnly && !run.relayDriver && driverKey && driverKey !== run.leadKey) {
    send(player, 'El jefe de la operación conduce el primer tramo.')
    return false
  }
  if (!driverKey || (run.members.size > 1 && (ped === driver ||
      (run.relayDriver && run.relayDriver === driverKey)))) {
    send(player, run.relayDriver ? 'Cambiad de conductor. El copiloto confirma.' : 'El copiloto confirma el relevo.')
    return false
  }
  run.relayDriver ||= driverKey
  return true
}

function pairExpired() {
  if (!run.pairUntil || Date.now() < run.pairUntil) return
  run.pairUntil = 0
  run.confirmed.clear()
  sync()
  for (const member of run.members.keys()) send(member, 'La ventana de sincronización se agotó. Confirmad ambos puntos de nuevo.')
}

function confirmPair(player, stop, site) {
  if (stop.briefing && Array.from(run.members.keys()).some(member => {
    const ped = GetPlayerPed(member)
    return !alive(ped) || !near(ped, stop.at, 8)
  })) {
    send(player, 'Estad los dos junto al tablón para confirmar la salida.')
    return false
  }
  if (stop.paired) run.pairUntil ||= Date.now() + stop.paired.seconds * 1000
  run.confirmed.set(site.index, run.members.get(player))
  if (run.confirmed.size === 2) return true
  sync()
  send(player, 'Confirmación registrada. Falta tu compañero.')
  return false
}

function advance(player, value) {
  if (!run?.members.has(player) || run.failed || value?.id !== run.id || value?.step !== run.step) return
  if (run.resumePending) return send(player, 'Espera al equipo original en el cuartel.')
  if (run.contract.duoOnly && run.members.size < 2) return send(player, 'Espera a tu compañero para continuar.')
  if (run.people && run.step) return rescueStep(player)
  if (run.heist && run.step > 0) {
    if (run.step === 1) return send(player,'Abre la consola de tu puesto desde F6.')
    if (!DuoHeist.canDeliver(run)) return send(player, run.handler ? 'Aterrizad los dos a bordo del Cargobob en la entrega.' : 'Acercad el vehículo y reuníos en la entrega.')
    return completeContract(player)
  }
  if (run.key === 'guardacostas' && run.step > 0) return seaStep(player)
  if (run.key === 'ultima_recogida' && run.step === 1) return pickupStep(player)
  pairExpired()
  const stop = currentStop()
  const ped = GetPlayerPed(player)
  const inRoute = run.step < run.contract.stops.length
  const incidentDestination = run.incident && run.step === run.contract.stops.length - 1
  const rally = run.key === 'rally' && inRoute
  const pairStage = stop.briefing || stop.paired
  const sites = pairStage ? operationTargets(stop, player) : stopTargets(stop, run.members.size)
  const target = sites.find(site => near(ped, site.at, site.air ? 95 : rally ? 16 : run.contract.launch ? 15 : 7))
  if (!target || !alive(ped)) return
  if (run.deadline && Date.now() >= run.deadline) return failure('Se agotó el cronómetro.')
  if (rally && GetVehiclePedIsIn(ped, false) !== run.vehicle) {
    return send(player, 'Cruza el control dentro del coche de rally.')
  }
  if (run.contract.launch && GetVehiclePedIsIn(ped, false) !== run.vehicle) {
    return send(player, 'Confirma el control desde la aeronave asignada.')
  }
  if (stop.air && run.members.size === 2) {
    const pilot = GetPedInVehicleSeat(run.vehicle, -1)
    const crew = Array.from(run.members.keys())
    if (!crew.some(member => GetPlayerPed(member) === pilot) || pilot === ped) {
      return send(player, 'En pareja, un jugador pilota y el otro confirma el control.')
    }
  }
  if (run.contract.returnAt && !inRoute && GetEntitySpeed(run.vehicle) > 2) {
    return send(player, 'Detén la aeronave para cerrar el encargo.')
  }
  const radius = stop.air ? 105 : stop.gang || stop.search || stop.parallel || stop.paired ? 110 : 24
  if (!((run.key === 'guardacostas' || run.handler) && stop.briefing) && !near(run.vehicle, target.at, radius)) return send(player, 'Acerca el vehículo del contrato.')
  if (run.incident && run.contract.kind !== 'Búsqueda' && run.members.size === 2) {
    const lead = Array.from(run.members).find(([, key]) => key === run.leadKey)
    if (!lead || GetPedInVehicleSeat(run.vehicle, -1) !== GetPlayerPed(lead[0]) || lead[0] === player) {
      return send(player, 'El anfitrión conduce y el compañero confirma el objetivo.')
    }
  }
  if (stop.gang && (!run.engaged || run.enemies.some(enemy =>
    !DoesEntityExist(enemy) || GetEntityHealth(enemy) > 0
  ))) return send(player, 'Todavía hay miembros de la banda en la zona.')
  if (run.passenger &&
      (!DoesEntityExist(run.passenger) || GetVehiclePedIsIn(run.passenger, false) !== run.vehicle)) {
    return send(player, 'Deja espacio atrás y espera a que suba el pasajero.')
  }
  if (!inRoute) {
    if (run.key === 'ultima_recogida' && GetEntitySpeed(run.vehicle) > 1) return send(player, 'Detén la furgoneta.')
    if (run.contract.duoOnly && Array.from(run.members.keys()).some(member => {
      const teammate = GetPlayerPed(member)
      return !alive(teammate) || !near(teammate, garage, 12)
    })) return send(player, 'Volved los dos al cuartel para cerrar la operación.')
    return completeContract(player)
  }
  if (pairStage && !confirmPair(player, stop, target)) return

  run.started = true
  if (stop.search && target.at !== stop.at) {
    run.searched.add(target.at)
    sync()
    return send(player, 'Aquí no está. Revisad las ubicaciones restantes.')
  }
  if (stop.parallel) {
    const key = run.members.get(player)
    if (run.members.size > 1 && Array.from(run.confirmed.values()).includes(key)) {
      return send(player, 'Tu compañero confirma el otro punto.')
    }
    run.confirmed.set(target.index, key)
    if (run.confirmed.size < 2) {
      sync()
      return send(player, 'Primer punto confirmado. Falta el otro registro.')
    }
  }
  if (stop.relay && !relayReady(player, ped)) return
  if (stop.tow && !run.tow) {
    if (!prepareTow(stop)) return failure('No se pudo generar el coche averiado.')
    sync()
    return send(player, 'Coloca la grúa junto al coche averiado.')
  }
  if (stop.tow && !near(run.vehicle, GetEntityCoords(run.tow), 12)) {
    return send(player, 'Coloca la grúa junto al coche averiado.')
  }
  if (run.tow && !stop.tow) {
    if (!near(run.tow, stop.at, 16)) return send(player, 'Entrega también el coche remolcado.')
    if (incidentDestination) return completeContract(player)
    clean(run.tow)
    run.tow = 0
  }
  if (run.escort && !stop.escort) {
    if (!near(run.escort.vehicle, stop.at, 20)) return send(player, 'Espera a la furgoneta de los estibadores.')
    if (incidentDestination) return completeContract(player)
    clean(run.escort.driver)
    clean(run.escort.vehicle)
    run.escort = undefined
  }
  if (stop.escort && !spawnEscort(stop)) return failure('No se pudo generar el transporte de los estibadores.')
  if (incidentDestination) return completeContract(player)

  if (run.key === 'noche_davis' && run.step === 0) {
    if (run.choice === 2 && GetPedInVehicleSeat(run.vehicle,1))
      return send(player,'Rosa necesita el asiento trasero derecho. Dejadlo libre.')
    run.neighbor = run.choice
    run.returnVisit = DuoStore.load(run.leadKey)?.davis?.includes(run.neighbor) || false
    if (run.neighbor === 2) {
      run.passenger = CreatePedInsideVehicle(run.vehicle,4,GetHashKey('a_f_m_tourist_01'),1,true,true)
      if (!run.passenger) return failure('Dejad libre el asiento trasero para Rosa y volved a iniciar su traslado.')
      SetEntityOrphanMode(run.passenger,2)
    }
  }
  clearStageEntities()
  run.engaged = false
  run.searched.clear()
  run.confirmed.clear()
  run.pairUntil = 0
  if (run.passenger && run.step === 1) {
    clean(run.passenger)
    run.passenger = 0
  }
  if (run.contract.timeLimit && run.step === 0) {
    run.timerStart = Date.now()
    run.deadline = run.timerStart + run.contract.timeLimit * 1000
  }
  if (run.deadline && run.step === run.contract.stops.length - 1) {
    run.deadline = 0
    if (rally) run.rallyTime = Date.now() - run.timerStart
  }
  run.step++
  run.choice = undefined
  run.dialogue = stop.dialogue || ''
  if (stop.checkpoint) {
    run.checkpoint = {
      step: run.step, at: [...GetEntityCoords(run.vehicle), GetEntityHeading(run.vehicle)],
      relayDriver: run.relayDriver, timed: !!run.deadline, dialogue: run.dialogue
    }
  }
  if (stop.checkpoint) saveCheckpoint()
  if (run.key === 'ultima_recogida' && run.step === 1) run.opened = Date.now()
  if (run.rallyTime) {
    for (const member of run.members.keys()) {
      send(member, 'Meta: ' + (run.rallyTime / 1000).toFixed(1) + ' s. Devolved el coche.')
    }
  } else send(player, currentStop().text)
  sync()
}

function saveCheckpoint() {
  const data = DuoStore.load(run.leadKey)
  if (!data) return
  run.receipt ||= run.id
  data.checkpoint = { key: run.key, receipt: run.receipt, crew: [...run.members.values(), ...run.disconnected.keys()],
    point: run.checkpoint, bonus: run.bonus }
  if (!DuoStore.save(run.leadKey, data)) {
    for (const p of run.members.keys()) send(p, 'Punto disponible esta sesión. El guardado en disco ha fallado.')
  }
}

function resumeShift(player) {
  const data = profile(player)
  const saved = data?.checkpoint
  if (run || !saved || data.receipts.includes(saved.receipt) || !contracts[saved.key] ||
      !saved.point || !Array.isArray(saved.crew)) return
  start(player, saved.key)
  if (!run) return
  run.resumePending = saved
  run.receipt = saved.receipt
  if (saved.crew.length === 1) return restoreShift(player)
  send(player, 'Tu compañero original debe unirse en Pillbox para recuperar el vehículo.')
}

function restoreShift(player) {
  const saved = run.resumePending
  run.checkpoint = saved.point
  run.bonus = saved.bonus
  retry(player)
  if (run.step === saved.point.step) {
    run.started = true
    delete run.resumePending
  } else finish('No se pudo restaurar el vehículo. El punto sigue disponible en F6.')
}

function dispatchView(player) {
  if (run?.key !== 'ultima_recogida' || run.step !== 1 || !run.members.has(player)) return null
  return { editable: run.members.get(player) !== run.leadKey && run.members.size === 2,
    boxes: run.bonus / 320, selected: run.pick, stops: Duo.pickups.map((site, i) => ({
      name: site.text, boxes: site.boxes, seconds: Math.max(0, Math.ceil((run.opened + site.closes * 1000 - Date.now()) / 1000)),
      collected: run.collected.includes(i) })) }
}

function dispatch(player, value) {
  const sheet = dispatchView(player)
  if (!sheet?.editable) return
  if (value === 'return') {
    if (!run.collected.length) return finish('Ruta cerrada sin recogidas ni pago.')
    run.step++
    run.pick = undefined
  } else {
    if (!Number.isInteger(value) || !sheet.stops[value]?.seconds || sheet.stops[value].collected) return
    run.pick = value
  }
  sync()
  for (const p of run.members.keys()) send(p, value === 'return' ? 'Regreso al cuartel' : 'Siguiente recogida · ' + Duo.pickups[value].text)
}

function pickupStep(player) {
  const site = Duo.pickups[run.pick]
  if (!site || run.collected.includes(run.pick) || Date.now() >= run.opened + site.closes * 1000) return
  const driver = [...run.members].find(([, key]) => key === run.leadKey)[0]
  if (player === driver) return send(player, 'El copiloto recoge los bultos.')
  if (GetPedInVehicleSeat(run.vehicle, -1) !== GetPlayerPed(driver) || GetEntitySpeed(run.vehicle) > 1)
    return send(player, 'El conductor debe detener la furgoneta.')
  const ped = GetPlayerPed(player)
  if (!alive(ped) || !near(ped, site.at, 7) || !near(run.vehicle, site.at, 12) || GetVehiclePedIsIn(ped,false))
    return send(player, 'Baja junto al comercio para cargar los bultos.')
  run.collected.push(run.pick)
  run.bonus += 320 * site.boxes
  run.pick = undefined
  if (run.collected.length === Duo.pickups.length) run.step++
  sync()
}

function seaStep(player) {
  const ped = GetPlayerPed(player)
  if (!alive(ped) || !alive(run.boat) || (run.castaway && !alive(run.castaway))) return failure('El equipo de rescate se ha perdido.')
  const pilot = run.members.get(player) === run.leadKey
  if (run.step === 1) {
    if (!pilot || GetPedInVehicleSeat(run.vehicle,-1) !== ped || !near(ped, run.wreckAt, 95))
      return send(player, pilot ? 'Vuela sobre la embarcación asignada.' : 'Espera a que el piloto localice el barco.')
    run.castaway = CreatePedInsideVehicle(run.wreck, 4, GetHashKey('a_m_m_beach_01'), -1, true, true)
    if (!run.castaway) return send(player,'Mantén el Maverick sobre el barco y confirma de nuevo.')
    SetEntityOrphanMode(run.castaway,2)
    run.dialogue = 'Barco localizado. Acerca la lancha al costado.'
  } else {
    if (pilot || GetPedInVehicleSeat(run.boat,-1) !== ped || GetEntitySpeed(run.boat) > 2)
      return send(player, 'El patrón debe detener la lancha.')
    if (!near(run.boat, run.step === 2 ? run.wreckAt : Duo.sea.dock, 12)) return
    if (run.step === 2) {
      if (GetVehiclePedIsIn(run.castaway,false) !== run.boat) SetPedIntoVehicle(run.castaway, run.boat, 0)
      if (GetVehiclePedIsIn(run.castaway,false) !== run.boat) return send(player,'Embarcando. Mantén la lancha parada y confirma cuando esté a bordo.')
      run.dialogue = 'Volved al embarcadero con el náufrago.'
    } else {
      if (GetVehiclePedIsIn(run.castaway,false) !== run.boat) {
        run.step = 2
        sync()
        return send(player, 'Recoge al náufrago antes de volver.')
      }
      return completeContract(player)
    }
  }
  run.step++
  sync()
}

function shiftView(player, data) {
  if (!data) return null
  const favorite = data.favorite
  const model = favorite && Object.hasOwn(cars,favorite.model) && !cars[favorite.model].type && data.cars[favorite.model]
    ? favorite.model : Object.keys(data.cars).find(key => Object.hasOwn(cars,key) && !cars[key].type) || 'blista'
  const color = favorite?.model === model ? favorite.paint : data.cars[model]
  const paint = Object.hasOwn(paints,color) ? color : 'grafito'
  const food = Object.hasOwn(items,data.pocket) && items[data.pocket].heal ? data.pocket : 'bocadillo'
  const missing = Math.max(0, 3 - (data.food[food] || 0))
  return { model, paint, food, missing, cost: missing * items[food].price }
}

function setupShift(player, action, value) {
  const data = profile(player)
  if (!data) return
  if (action === 'pocket' && Object.hasOwn(items, value) && items[value].heal) data.pocket = value
  else if (action === 'favoriteCar' && Object.hasOwn(cars,value) && !cars[value].type && data.cars[value])
    data.favorite = { model: value, paint: data.cars[value] }
  else if (action === 'prepareShift') {
    const setup = shiftView(player, data)
    if (!near(GetPlayerPed(player),motorPool,18)) return send(player,'Prepara tu salida junto al garaje.')
    if (value !== setup.cost) return send(player,'El coste ha cambiado. Revisa la salida.')
    if (data.cash < setup.cost) return send(player,'Saldo insuficiente para reponer la mochila.')
    const active = personalCars.get(player)
    if (active && (active.model !== setup.model || !alive(active.entity) || !near(active.entity,motorPool,32))) return send(player,'Guarda o recupera primero tu coche actual.')
    data.cars[setup.model] = setup.paint
    if (!active) handleGarage(player,'pull',setup.model,data)
    const car = personalCars.get(player)
    if (!car) return
    data.cash -= setup.cost
    data.food[setup.food] = (data.food[setup.food] || 0) + setup.missing
    if (!save(player,data)) {
      if (!active) { clean(car.entity); personalCars.delete(player) }
      return send(player,'No se pudo guardar la salida.')
    }
    Entity(car.entity).state.set('duoPaint', paints[setup.paint].rgb,true)
    return send(player,'Salida preparada. Tu coche y tu mochila están listos.')
  } else return
  if (!save(player,data)) return send(player,'No se pudo guardar la preferencia.')
  if (action === 'favoriteCar') publishExhibit()
  send(player,'Preferencia guardada.')
}

function publishExhibit(player = -1) {
  const gallery = DuoStore.gallery().map(data => ({
    model: data.favorite?.model || 'blista', paint: data.favorite?.paint || 'grafito',
    trophies: ['La central','Frecuencia fantasma'].filter((_,i) => (i ? Duo.chapters.slice(Duo.story2.start) :
      Duo.chapters.slice(0,Duo.story2.start)).every(ch => ch.missions.every(k => data.campaign.includes(k))))
  }))
  emitNet('duo:exhibit',player,gallery)
}

function expireHeist() {
  const expiry = DuoHeist.expire(run)
  if (expiry === 'failed') finish('Alerta completa. Atraco cerrado sin botín.')
  if (expiry === 'return') {
    for (const player of run.members.keys()) send(player,'Tiempo agotado. Entregad el botín asegurado.')
    sync()
  }
  return !!expiry
}

function route(player, action, value) {
  if (Date.now() - (lastAction.get(player) || 0) < (action === 'heistInput' ? 140 : 600)) return
  lastAction.set(player, Date.now())
  if (action === 'heistInput' && run?.heist && run.members.has(player)) {
    if (expireHeist()) return
    const result = DuoHeist.act(run,player,value)
    if (typeof result === 'string') return send(player,result)
    if (result && !expireHeist()) sync()
    return
  }
  if (action === 'resumeShift') return resumeShift(player)
  if (action === 'dispatch') return dispatch(player, value)
  if (['pocket', 'favoriteCar', 'prepareShift'].includes(action)) return setupShift(player, action, value)
  if (action === 'quickEat') { action = 'eat'; value = profile(player)?.pocket || 'bocadillo' }
  if (action === 'start' && typeof value === 'string') return start(player, value)
  if (action === 'markIncident' || action === 'startIncident') {
    const reserved = action === 'markIncident' && value && run?.incident?.id === value ? run.incident : null
    const offer = reserved || incidentOffers().find(incident => incident.id === value)
    if (!offer) return send(player, 'La oferta ha caducado. Consulta los nuevos incidentes.')
    if (action === 'startIncident') return start(player, null, false, offer)
    emitNet('duo:locateCar', player, offer.at)
    return send(player, 'Incidente marcado en el GPS.')
  }
  if (action === 'locateHangar') {
    emitNet('duo:locateCar', player, Duo.hangar.at)
    return send(player, 'Hangar de Sandy Shores marcado en el GPS.')
  }
  if (action === 'locateHQ') {
    emitNet('duo:locateCar', player, base)
    return send(player, 'Cuartel general marcado en el GPS.')
  }
  if (action === 'startWorld') {
    if (value !== undefined && value !== dailyWorld().key) return send(player, 'Ha cambiado el evento diario. Revisa la nueva oferta.')
    return start(player, undefined, true)
  }
  if (action === 'join') return join(player)
  if (action === 'step') return advance(player, value)
  if (action === 'rescueRole') {
    if (!run?.people || run.step !== 0 || value?.id !== run.id || !run.members.has(player) ||
        run.members.size !== 2 || run.confirmed.size || !near(GetPlayerPed(player),base,7)) return
    const self = run.members.get(player)
    if (value.role === 'driver') run.rescueDriver = self
    else if (value.role === 'rescuer') run.rescueDriver = [...run.members.values()].find(key => key !== self)
    else return
    sync()
    for (const id of run.members.keys()) panel(id)
    return
  }
  if (action === 'confirmBriefing' && run && currentStop().briefing) return advance(player, value)
  if (action === 'retry') return retry(player)
  if (action === 'chooseRoute') return chooseRoute(player, value)
  if (action === 'cancel' && run && run.members.has(player)) {
    const owner = DuoStore.load(run.leadKey)
    if (owner?.checkpoint?.receipt === (run.receipt || run.id)) {
      delete owner.checkpoint
      if (!DuoStore.save(run.leadKey, owner)) return send(player, 'No se pudo guardar la cancelación.')
    }
    return finish('Contrato cancelado.')
  }
  const garageAction = ['buyCar', 'paint', 'pull', 'park', 'locateCar', 'recoverCar'].includes(action)
  if (!garageAction && !['buy', 'eat', 'balance', 'locate', 'claim'].includes(action)) return
  const data = profile(player)
  if (!data) return send(player, 'No se pudo cargar el perfil.')
  if (action === 'locate' || action === 'claim') {
    if (data.cacheDay === day()) return send(player, 'Ya recogiste el alijo de hoy.')
    const cache = dailyCache()
    if (action === 'locate') {
      emitNet('duo:cache', player, cache)
      return send(player, 'Sector de búsqueda marcado en ' + cache.label + '.')
    }
    const ped = GetPlayerPed(player)
    if (!near(ped, cache.at, 7) || GetEntityHealth(ped) <= 0) return send(player, 'Acércate al alijo para recogerlo.')
    if (!save(player, { ...data, cash: data.cash + Duo.cachePay, cacheDay: day() })) {
      return send(player, 'No se pudo guardar la recompensa.')
    }
    emitNet('duo:cache', player, null)
    return send(player, 'Alijo recuperado · $' + Duo.cachePay)
  }
  if (garageAction) return handleGarage(player, action, value, data)
  if (action === 'balance') return send(player, 'Saldo: $' + data.cash + ' | Contratos: ' + data.completed)
  if (typeof value !== 'string' || !Object.hasOwn(items, value)) return
  const item = items[value]
  const ped = GetPlayerPed(player)
  if (action === 'eat') {
    if (!item.heal || !alive(ped) || !(data.food[value] > 0)) return send(player, 'No puedes consumir ese artículo.')
    data.food[value]--
    if (!save(player, data)) return send(player, 'No se pudo guardar el consumo.')
    emitNet('duo:supply', player, value)
    return send(player, item.label + ' consumido.')
  }
  if (!near(ped, shop, 7)) return send(player, 'Compra en el punto de suministros de la central.')
  if (item.heal && (data.food[value] || 0) >= 10) return send(player, 'Ya llevas diez unidades de ese artículo.')
  if (item.weapon && data.weapons.includes(value)) return send(player, 'Ya tienes esta arma en tu equipo.')
  if (data.cash < item.price) return send(player, 'Saldo insuficiente.')
  data.cash -= item.price
  if (item.weapon) data.weapons.push(value)
  if (item.heal) data.food[value] = (data.food[value] || 0) + 1
  if (!save(player, data)) return send(player, 'No se pudo guardar la compra.')
  if (!item.heal) emitNet('duo:supply', player, value)
  send(player, item.label + ' | Saldo: $' + data.cash)
}

onNet('duo:action', (action, value) => {
  const player = Number(global.source)
  route(player, action, value)
  panel(player)
})
const lastPing = new Map()
onNet('duo:ping', coordinates => {
  const sender = Number(global.source)
  if (Date.now() - (lastPing.get(sender) || 0) < 1500 || !Array.isArray(coordinates) ||
      coordinates.length !== 3 || !coordinates.every(Number.isFinite) || Math.abs(coordinates[0]) > 9000 ||
      Math.abs(coordinates[1]) > 10000 || Math.abs(coordinates[2]) > 1800) return
  lastPing.set(sender, Date.now())
  for (const id of getPlayers()) if (Number(id) !== sender) emitNet('duo:ping', Number(id), coordinates)
})
onNet('duo:panel', () => panel(Number(global.source)))
onNet('duo:ready', () => {
  const player = Number(global.source)
  pushIncidents(player)
  publishExhibit(player)
  emitNet('duo:crew', -1, getPlayers().length)
  const weapons = profile(player)?.weapons || []
  emitNet('duo:loadout', player, weapons.filter(key => typeof key === 'string' && Object.hasOwn(items, key) && items[key].weapon))
  const key = profileKey(player)
  const expiry = run?.disconnected.get(key)
  if (expiry && Date.now() < expiry) {
    run.disconnected.delete(key)
    run.members.set(player, key)
    if (run.heist?.pausedMs) {
      run.heist.expires = Date.now()+run.heist.pausedMs
      delete run.heist.pausedMs
    }
    send(player, 'Te has reincorporado al contrato.')
    sync()
  } else sync(player)
})
on('playerDropped', () => {
  const player = Number(global.source)
  emitNet('duo:crew', -1, getPlayers().filter(id => Number(id) !== player).length)
  lastAction.delete(player)
  lastPing.delete(player)
  clean(personalCars.get(player)?.entity)
  personalCars.delete(player)
  clean(personalAircraft.get(player)?.entity)
  personalAircraft.delete(player)
  const key = run?.members.get(player)
  if (!key) return
  if (run.heist?.expires) {
    run.heist.pausedMs = Math.max(1,run.heist.expires-Date.now())
    run.heist.expires = 0
  }
  run.members.delete(player)
  if (!run.members.size) return finish('Contrato cerrado.')
  if (run.contract.duoOnly) {
    run.confirmed.clear()
    run.pairUntil = 0
  }
  run.disconnected.set(key, Date.now() + gracePeriod)
  for (const member of run.members.keys()) send(member, 'Tu compañero tiene cinco minutos para volver.')
  sync()
})

RegisterCommand('duo_identificadores', sender => {
  if (Number(sender) !== 0) return
  for (const player of getPlayers()) {
    const license = GetPlayerIdentifierByType(String(player), 'license')
    if (license) console.log('Jugador ' + player + ' · ' + license)
  }
}, true)

on('playerConnecting', (_name, _reject, deferrals) => {
  const player = String(global.source)
  const required = GetConvar('duo_require_allowlist', '0') === '1'
  const peer = GetConvar('duo_enroll_peer', '').trim()
  const allowed = GetConvar('duo_allowlist', '').split(',').map(id => id.trim().toLowerCase()).filter(Boolean)
  if (!required && !peer && !allowed.length) return
  let rejection
  if (peer) {
    const address = (GetPlayerEndpoint(player) || '').replace(/^::ffff:/i, '').replace(/:\d+$/, '')
    if (address !== peer && address !== '127.0.0.1') rejection = 'Acceso reservado al equipo vinculado para el registro.'
  }
  if (required && (allowed.length !== 2 || new Set(allowed).size !== 2 ||
      allowed.some(id => !/^license:[a-f0-9]{40}$/.test(id)))) {
    rejection = 'El anfitrión debe configurar los dos jugadores autorizados.'
  }
  if (!rejection && (required || allowed.length)) {
    const license = GetPlayerIdentifierByType(player, 'license')?.toLowerCase()
    if (!allowed.includes(license)) rejection = 'Este servidor es para los dos jugadores autorizados.'
  }
  if (!rejection) return
  deferrals.defer()
  setTimeout(() => deferrals.done(rejection), 0)
})

notifyPayments(DuoStore.recover())
setInterval(() => notifyPayments(DuoStore.recover()), 10000)
let lastIncidentWindow = incidentWindow()
setInterval(() => {
  const window = incidentWindow()
  if (run?.key === 'ultima_recogida' && run.step === 1 && run.pick !== undefined &&
      Date.now() >= run.opened + Duo.pickups[run.pick].closes * 1000) {
    run.pick = undefined
    sync()
    for (const p of run.members.keys()) send(p, 'El comercio ha cerrado. Consultad la hoja de ruta.')
  }
  if (window === lastIncidentWindow) return
  lastIncidentWindow = window
  for (const id of getPlayers()) {
    pushIncidents(Number(id))
    panel(Number(id))
  }
}, 3000)

setInterval(() => {
  if (!run) return
  for (const [key, expiry] of run.disconnected) {
    if (Date.now() >= expiry) {
      run.disconnected.delete(key)
      if (run.contract.duoOnly) return finish('Se agotó el plazo para recuperar al compañero.')
    }
  }
  if (run.contract.duoOnly && run.disconnected.size) return
  if (run.heist && expireHeist()) return
  if (run.handler && run.step < 2 && !alive(run.handler)) return failure('Grúa del prototipo perdida.')
  if (run.handler && run.step === 1) {
    const seats = [run.vehicle,run.handler].map(entity => GetPedInVehicleSeat(entity,-1)).join('/')
    if (run.seats !== seats) { run.seats = seats; sync() }
  }
  pairExpired()
  if (run.failed) {
    if (Date.now() - run.failed.at > 10 * 60 * 1000) finish('Se agotó el plazo de reintento.')
    return
  }
  if (run.deadline && Date.now() >= run.deadline) return failure('Se agotó el cronómetro.')
  if (Date.now() - run.created > 45 * 60 * 1000) return failure('Tiempo agotado.')
  if (!DoesEntityExist(run.vehicle) || GetEntityHealth(run.vehicle) <= 0) {
    return failure('Vehículo del contrato perdido.')
  }
  if (run.passenger && (!DoesEntityExist(run.passenger) || GetEntityHealth(run.passenger) <= 0)) {
    return failure('Pasajero perdido.')
  }
  if (run.key === 'guardacostas' && (!alive(run.boat) || !alive(run.wreck) || (run.castaway && !alive(run.castaway)))) return failure('Rescate interrumpido.')
  if (run.tow && !alive(run.tow)) return failure('Se perdió el coche averiado.')
  if (run.escort && (!alive(run.escort.vehicle) || !alive(run.escort.driver))) {
    return failure('La escolta no pudo llegar al destino.')
  }
  if (run.people && run.step) return rescueTick()
  if (run.enemies.some(enemy => !DoesEntityExist(enemy))) return failure('Se perdió una entidad del encuentro.')
  const stop = currentStop()
  if (run.key === 'guardacostas' && run.step === 1 && run.members.size === 2 && !run.pilotReady &&
      GetPedInVehicleSeat(run.vehicle,-1) === GetPlayerPed([...run.members].find(([,key]) => key === run.leadKey)?.[0] || 0)) {
    run.pilotReady = true
    sync()
  }
  loadScene(stop)
  if (stop.tow && !run.tow && Array.from(run.members.keys()).some(player => near(GetPlayerPed(player), stop.at, 70))) {
    if (!prepareTow(stop)) return failure('No se pudo generar el coche averiado.')
    sync()
  }
  if (!stop.gang || run.engaged) return
  const nearby = Array.from(run.members.keys()).some(player => near(GetPlayerPed(player), stop.at, 85))
  if (!nearby) return
  const offsets = [[7, 3], [-6, 8], [4, -8], [-8, -3], [10, 8]]
  for (const [dx, dy] of offsets.slice(0, run.members.size === 2 ? 5 : 3)) {
    const enemy = createPed(stop.model, [stop.at[0] + dx, stop.at[1] + dy, stop.at[2]])
    if (!enemy) return failure('No se pudo generar la banda.')
    run.enemies.push(enemy)
  }
  run.engaged = true
  for (const member of run.members) send(member, stop.gang + ' vigila este punto.')
  sync()
}, 1000)

on('onResourceStop', resource => {
  if (resource !== GetCurrentResourceName()) return
  finish('Servidor reiniciando.')
  for (const { entity } of personalCars.values()) clean(entity)
  personalCars.clear()
  for (const { entity } of personalAircraft.values()) clean(entity)
  personalAircraft.clear()
})
