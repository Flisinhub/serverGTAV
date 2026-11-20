const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')

const scripts = ['contratos.js', 'expansion.js', 'flota.js', 'campana.js', 'frecuencia.js', 'operaciones.js', 'turnos.js', 'atracos.js', 'eventos.js', 'guardado.js', 'atracos_servidor.js', 'servidor.js']
const resource = path.join(__dirname, '..', 'servidor', 'resources', 'duo')
const licenses = { 1: 'license:aaaa', 2: 'license:bbbb' }
const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value))

function temporaryRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'los-santos-a-dos-'))
  t.after(() => {
    for (const file of fs.readdirSync(root)) fs.unlinkSync(path.join(root, file))
    fs.rmdirSync(root)
  })
  return root
}

function createWorld(root, options = {}) {
  let clock = options.clock ?? 1_700_000_000_000
  let index = 100
  const entities = new Map()
  const players = new Map()
  const events = new Map()
  const messages = []
  const timers = []
  const failures = []

  function make(model, kind, x, y, z, heading = 0) {
    const entity = ++index
    entities.set(entity, { model, kind, at: [x, y, z], heading, health: 200, state: {} })
    return entity
  }

  function seat(ped, vehicle, position = -1) {
    Object.assign(entities.get(ped), { vehicle, seat: position })
  }

  function schedule(callback, delay, repeat) {
    const timer = { callback, delay: Math.max(delay || 0, 1), next: clock + Math.max(delay || 0, 1), repeat }
    timers.push(timer)
    return timer
  }

  function elapse(ms) {
    const end = clock + ms
    while (true) {
      const next = timers.filter(timer => timer.next <= end).sort((a, b) => a.next - b.next)[0]
      if (!next) break
      clock = next.next
      next.next = next.repeat ? next.next + next.delay : Infinity
      next.callback()
    }
    clock = end
  }

  const controlledFs = {
    ...fs,
    renameSync(from, to) {
      const failure = failures.find(record => record.name === path.basename(to) && record.remaining > 0)
      if (!failure) return fs.renameSync(from, to)
      failure.remaining--
      const error = new Error('Fallo controlado de escritura')
      error.code = 'EACCES'
      throw error
    }
  }

  const context = vm.createContext({
    require: name => name === 'fs' || name === 'node:fs' ? controlledFs : require(name),
    console: { error: () => {}, log: () => {}, warn: () => {} },
    Date: class extends Date { static now() { return clock } },
    on: (name, callback) => events.set(name, callback),
    onNet: (name, callback) => events.set(name, callback),
    RegisterCommand: () => {},
    emitNet: (name, player, data) => messages.push({ name, player: Number(player), data: copy(data) }),
    setInterval: (callback, delay) => schedule(callback, delay, true),
    setTimeout: (callback, delay) => schedule(callback, delay, false),
    clearInterval: timer => { timer.next = Infinity },
    clearTimeout: timer => { timer.next = Infinity },
    GetCurrentResourceName: () => 'duo',
    GetResourcePath: () => root,
    GetConvar: (name, fallback) => options.convars?.[name] ?? fallback,
    GetConvarInt: (name, fallback) => Number(options.convars?.[name] ?? fallback),
    getPlayers: () => [...players.keys()].map(String),
    GetPlayerName: player => players.has(Number(player)) ? 'Jugador ' + player : null,
    GetPlayerEndpoint: player => options.endpoints?.[player] ?? '127.0.0.1:30120',
    GetPlayerName: player => 'Jugador ' + player,
    GetPlayerIdentifierByType: (player, type) => {
      const license = players.get(Number(player))?.license
      return type === 'license' ? license ?? null : null
    },
    GetPlayerPed: player => players.get(Number(player))?.ped || 0,
    DoesEntityExist: entity => entities.has(entity),
    GetEntityCoords: entity => entities.get(entity)?.at || [0, 0, 0],
    GetEntityHeading: entity => entities.get(entity)?.heading || 0,
    GetEntityHealth: entity => entities.get(entity)?.health || 0,
    GetEntitySpeed: entity => entities.get(entity)?.speed || 0,
    GetVehicleEngineHealth: entity => entities.get(entity)?.health || 0,
    GetEntityAttachedTo: entity => entities.get(entity)?.attachedTo || 0,
    GetVehiclePedIsIn: ped => entities.get(ped)?.vehicle || 0,
    GetPedInVehicleSeat: (vehicle, position) => [...entities.entries()].find(([, entity]) =>
      entity.vehicle === vehicle && entity.seat === position)?.[0] || 0,
    SetPedIntoVehicle: seat,
    GetHashKey: model => model,
    GetEntityModel: entity => entities.get(entity)?.model,
    CreateVehicleServerSetter: (model, _type, x, y, z, heading) => make(model, 'vehicle', x, y, z, heading),
    CreatePed: (_type, model, x, y, z, heading) => make(model, 'npc', x, y, z, heading),
    CreatePedInsideVehicle: (vehicle, _type, model, position) => {
      const ped = make(model, 'npc', ...entities.get(vehicle).at)
      seat(ped, vehicle, position)
      return ped
    },
    SetEntityOrphanMode: () => {},
    FreezeEntityPosition: () => {},
    SetVehicleDoorsLocked: () => {},
    SetVehicleEngineHealth: (entity, health) => { entities.get(entity).health = health },
    DeleteEntity: entity => {
      entities.delete(entity)
      for (const info of entities.values()) {
        if (info.vehicle === entity) info.vehicle = 0
        if (info.attachedTo === entity) info.attachedTo = 0
      }
    },
    GetAllVehicles: () => [...entities.keys()].filter(entity => entities.get(entity).kind === 'vehicle'),
    NetworkGetNetworkIdFromEntity: entity => entity,
    NetworkGetEntityFromNetworkId: id => id,
    NetworkGetEntityOwner: () => 1,
    Entity: entity => ({ state: { set: (key, value) => { entities.get(entity).state[key] = copy(value) } } })
  })
  context.global = context
  for (const file of scripts) {
    vm.runInContext(fs.readFileSync(path.join(resource, file), 'utf8'), context, { filename: file })
  }

  function fire(player, name, ...args) {
    context.source = String(player)
    assert.ok(events.has(name), 'Evento registrado: ' + name)
    events.get(name)(...args)
  }

  function position(entity, at) {
    assert.ok(entities.has(entity), 'Entidad simulada: ' + entity)
    entities.get(entity).at = [...at].slice(0, 3)
  }

  function connect(player, license = licenses[player]) {
    players.set(player, { license, ped: make('player', 'player', ...context.Duo.base) })
    fire(player, 'duo:ready')
  }

  function drop(player) {
    const old = players.get(player)
    fire(player, 'playerDropped')
    players.delete(player)
    entities.delete(old.ped)
  }

  function latest(name, player = 1) {
    return messages.findLast(message => message.name === name && (message.player === -1 || message.player === player))?.data
  }

  function action(player, name, value, wait = true) {
    if (wait) elapse(650)
    fire(player, 'duo:action', name, value)
  }

  function step(player = 1, state = latest('duo:state', player)) {
    assert.ok(state, 'El jugador tiene una misión activa')
    action(player, 'step', { id: state.id, step: state.step })
  }

  function saved(player) {
    const target = path.join(root, 'perfil-' + licenses[player].slice(8) + '.json')
    return JSON.parse(fs.readFileSync(target, 'utf8'))
  }

  function seed(player, data) {
    fs.writeFileSync(path.join(root, 'perfil-' + licenses[player].slice(8) + '.json'), JSON.stringify(data))
  }

  function find(model, kind) {
    return [...entities].find(([, info]) => info.model === model && info.kind === kind)?.[0]
  }

  return {
    data: context.Duo, store: context.DuoStore, entities, players, action, step, elapse, fire, latest, saved, seed,
    connect, drop, position, find, seat,
    ped: player => players.get(player).ped,
    state: player => latest('duo:state', player),
    panel: player => { fire(player, 'duo:panel'); return latest('duo:panel', player) },
    failWrite: (name, remaining = 1) => failures.push({ name, remaining }),
    date: () => clock
  }
}

function start(world, key, partner = 2) {
  world.position(world.ped(1), world.data.base)
  world.action(1, 'start', key)
  assert.equal(world.state(1)?.name, world.data.contracts[key].name, key)
  assert.equal(typeof world.state(1).id, 'string')
  if (partner) {
    world.position(world.ped(partner), world.data.base)
    world.action(partner, 'join')
    assert.equal(world.state(partner)?.id, world.state(1).id)
  }
}

function arrive(world, at, player = 1, moveVehicle = true) {
  const { vehicle } = world.state(player)
  if (moveVehicle) world.position(vehicle, at)
  world.position(world.ped(player), at)
}

function complete(world, key, partner = 2, { contract = world.data.contracts[key], routeIndex = 0 } = {}) {
  if (contract.launch) {
    const state = world.state(1)
    assert.deepEqual(world.entities.get(state.vehicle).at, copy(contract.launch.slice(0, 3)))
    arrive(world, state.stop.at)
    world.step()
    assert.equal(world.state(1).step, state.step, 'El control aéreo exige la aeronave asignada')
    world.seat(world.ped(1), state.vehicle)
    if (partner) world.seat(world.ped(partner), state.vehicle, 0)
  }
  for (let index = world.state(1).step; index < contract.stops.length; index++) {
    const stop = contract.stops[index]
    const current = world.state(1)
    assert.equal(current.step, index, key + ' etapa ' + index)
    let confirmer = 1
    arrive(world, stop.at)
    if (stop.briefing || stop.paired) {
      if (stop.briefing) arrive(world, stop.at, partner, false)
      else arrive(world, stop.paired.sites[1].at, partner, false)
      world.step(1)
      assert.equal(world.state(1).step, index, 'Falta confirmar el objetivo del compañero')
      world.step(partner)
      continue
    }
    if (stop.air && partner) {
      world.step()
      assert.equal(world.state(1).step, index, 'El piloto no confirma el control cooperativo')
      arrive(world, stop.at, partner, false)
      confirmer = partner
    }

    if (stop.choice) {
      const driver = world.ped(1)
      const chooser = partner || 1
      world.seat(driver, current.vehicle, -1)
      if (partner) {
        world.action(1, 'chooseRoute', routeIndex)
        assert.equal(world.state(1).targets.length, 0, 'El conductor cede la elección al copiloto')
      }
      world.action(chooser, 'chooseRoute', stop.choice.length)
      assert.equal(world.state(1).targets.length, 0, 'Una opción desconocida no cambia la ruta')
      assert.equal(world.panel(chooser).routeOptions.length, stop.choice.length)
      world.action(chooser, 'chooseRoute', routeIndex)
      assert.deepEqual(world.state(1).targets.map(target => target.at), [copy(stop.choice[routeIndex].at)])
      arrive(world, stop.choice[1 - routeIndex].at)
      world.step()
      assert.equal(world.state(1).step, index, 'El control de la ruta descartada no sirve')
      arrive(world, stop.choice[routeIndex].at)
    }
    if (stop.gang) {
      world.elapse(1100)
      const enemies = world.state(1).enemies
      assert.equal(enemies.length, partner ? 5 : 3)
      world.step()
      assert.equal(world.state(1).step, index, 'Los NPC siguen activos')
      for (const enemy of enemies) world.entities.get(enemy).health = 0
    }
    if (current.passenger) world.seat(current.passenger, current.vehicle, 1)
    if (key === 'rally') world.seat(world.ped(1), current.vehicle)
    if (stop.search) {
      const incorrect = stop.search[0]
      arrive(world, incorrect)
      world.step()
      assert.equal(world.state(1).step, index, 'La ubicación falsa no avanza la fase')
      assert.equal(world.state(1).targets.length, current.targets.length - 1)
      arrive(world, stop.at)
    }
    if (stop.relay) {
      if (contract.stops[index - 1]?.relay && partner) {
        arrive(world, stop.at, partner, false)
        world.step(partner)
        assert.equal(world.state(1).step, index, 'El conductor anterior no puede repetir el segundo relevo')
        world.seat(world.ped(partner), current.vehicle, -1)
        world.seat(world.ped(1), current.vehicle, 0)
      } else {
        world.seat(world.ped(1), current.vehicle, -1)
        if (partner) {
          arrive(world, stop.at, partner, false)
          world.seat(world.ped(partner), current.vehicle, 0)
          confirmer = partner
        }
      }
    }
    if (stop.tow) {
      world.elapse(1100)
      const towed = world.find(stop.tow, 'vehicle')
      assert.ok(towed, 'Aparece el coche averiado')
      world.position(towed, stop.at)
      world.position(current.vehicle, [stop.at[0] + 18, ...stop.at.slice(1)])
      world.step()
      assert.equal(world.state(1).step, index, 'La grúa debe acercarse al coche averiado')
      world.position(current.vehicle, stop.at)
      world.entities.get(towed).attachedTo = current.vehicle
    }
    const previous = contract.stops[index - 1]
    if (previous?.tow || previous?.escort) {
      const secondary = world.find(previous.tow || previous.escort, 'vehicle')
      assert.ok(secondary, 'El vehículo secundario existe en la etapa de entrega')
      world.step()
      assert.equal(world.state(1).step, index, 'La entrega espera a que llegue el vehículo secundario')
      world.position(secondary, stop.at)
    }
    if (stop.parallel) {
      world.step(confirmer)
      assert.equal(world.state(1).step, index, 'La segunda ubicación sigue pendiente')
      confirmer = partner || 1
      arrive(world, stop.parallel, confirmer)
    }
    world.step(confirmer)
  }
  assert.equal(world.state(1).step, contract.stops.length, 'Vuelta al garaje del contrato ' + key)
  const finishing = world.state(1)
  arrive(world, contract.returnAt || world.data.garage)
  if (contract.duoOnly) {
    world.position(world.ped(partner), contract.stops.at(-1).at)
    world.step()
    assert.equal(world.state(1).step, finishing.step, 'El compañero debe volver al cuartel para cobrar')
    arrive(world, world.data.garage, partner, false)
  }
  if (contract.returnAt) {
    const aircraft = world.entities.get(finishing.vehicle)
    aircraft.speed = 12
    world.step()
    assert.equal(world.state(1).step, finishing.step, 'La aeronave debe detenerse para cobrar')
    aircraft.speed = 0
  }
  world.step()
  return finishing
}

test('Despacho permite redirigir, cerrar antes y liquidar solo los bultos cargados', t => {
  const w = createWorld(temporaryRoot(t))
  w.connect(1); w.connect(2)
  start(w,'ultima_recogida')
  w.step(1); w.step(2)
  assert.equal(w.panel(1).dispatch.editable,false)
  w.action(1,'dispatch',0)
  assert.equal(w.state(1).targets.length,0)
  w.action(2,'dispatch',1); w.action(2,'dispatch',0)
  const site = w.data.pickups[0]
  assert.deepEqual(w.state(1).targets[0].at,copy(site.at))
  arrive(w,site.at); arrive(w,site.at,2,false)
  w.seat(w.ped(1),w.state(1).vehicle,-1)
  w.step(2); w.step(2)
  assert.equal(w.panel(2).dispatch.boxes,site.boxes)
  w.elapse(481000)
  w.action(2,'dispatch',1)
  assert.equal(w.state(1).targets.length,0)
  w.action(2,'dispatch','return')
  arrive(w,w.data.garage); arrive(w,w.data.garage,2,false)
  w.step()
  assert.equal(w.saved(2).lastSettlement.amount,site.boxes*320)
})

test('Guardacostas exige piloto, patrón, lancha parada y náufrago a bordo', t => {
  const w = createWorld(temporaryRoot(t))
  w.connect(1); w.connect(2)
  start(w,'guardacostas')
  w.step(1); w.step(2)
  const {vehicle,boat} = w.state(1)
  w.seat(w.ped(1),vehicle,-1)
  w.elapse(1100)
  const at = w.state(1).targets[0].at
  arrive(w,at)
  w.step(1)
  assert.equal(w.state(2).targets[0].localOnly,true)
  w.position(boat,at); w.position(w.ped(2),at)
  w.step(2)
  assert.equal(w.state(1).step,2)
  w.seat(w.ped(2),boat,-1)
  w.step(2)
  assert.equal(w.state(1).step,3)
  w.position(boat,w.data.sea.dock)
  w.entities.get(boat).speed = 4
  w.step(2)
  assert.ok(w.state(1))
  w.entities.get(boat).speed = 0
  w.step(2)
  assert.equal(w.saved(1).lastSettlement.amount,2650)
  assert.equal(w.entities.size,2)
})

test('Davis recuerda a cada vecino y cambia el encargo de la segunda visita', t => {
  const w = createWorld(temporaryRoot(t))
  w.connect(1); w.connect(2)
  for (const i of [0,1,2,0,1,2]) {
    const repeat = w.panel(1).completed >= 3
    start(w,'noche_davis')
    w.action(2,'chooseRoute',i)
    arrive(w,w.data.davis[i].at); w.step()
    const dest = w.state(1).targets[0]
    assert.equal(dest.text.includes(w.data.davis[i].follow),repeat)
    arrive(w,dest.at); w.step()
    arrive(w,w.data.garage); w.step()
    assert.equal(w.state(1),null)
    assert.ok(w.saved(2).davis.includes(i))
  }
})

test('El equipo original retoma Doble baliza desde disco y cobra una sola vez', t => {
  const root = temporaryRoot(t)
  let w = createWorld(root)
  w.connect(1); w.connect(2)
  start(w,'doble_baliza')
  w.step(1); w.step(2)
  arrive(w,w.data.contracts.doble_baliza.stops[1].at); w.step()
  const receipt = w.saved(1).checkpoint.receipt
  w.fire(1,'onResourceStop','duo')
  w = createWorld(root)
  w.connect(1); w.connect(2)
  assert.equal(w.panel(1).resumeName,'Doble baliza')
  w.action(1,'resumeShift'); w.action(2,'join')
  assert.equal(w.state(1).step,2)
  complete(w,'doble_baliza')
  assert.ok(w.saved(2).receipts.includes(receipt))
  assert.equal(w.panel(1).resumeName,null)
  w.action(1,'resumeShift')
  assert.equal(w.state(1),null)
})

test('Preparación y bolsillo respetan saldo, propiedad, presupuesto y guardado', t => {
  const w = createWorld(temporaryRoot(t))
  w.connect(1); w.connect(2)
  w.action(1,'pocket','barrita')
  w.action(1,'favoriteCar','sultan')
  assert.equal(w.panel(1).setup.model,'blista')
  w.action(1,'favoriteCar','blista')
  w.position(w.ped(1),w.data.motorPool)
  w.action(1,'prepareShift',55)
  assert.equal(w.panel(1).activeCar,null)
  w.failWrite('perfil-aaaa.json')
  w.action(1,'prepareShift',75)
  assert.equal(w.panel(1).activeCar,null)
  w.action(1,'prepareShift',75)
  assert.equal(w.saved(1).cash,425)
  assert.equal(w.saved(1).food.barrita,3)
  w.action(1,'prepareShift',75)
  assert.equal(w.saved(1).cash,425)
  w.action(1,'quickEat')
  assert.equal(w.saved(1).food.barrita,2)
  w.fire(1,'duo:ping',[12,42,15])
  assert.deepEqual(w.latest('duo:ping',2),[12,42,15])
  w.fire(1,'duo:ping',[0,0,0])
  assert.deepEqual(w.latest('duo:ping',2),[12,42,15])
})

function beginHeist(w,key) {
  w.connect(1)
  w.connect(2)
  start(w,key)
  w.step(1)
  w.step(2)
  assert.equal(w.state(1).step,1)
  const job = w.data.contracts[key]
  if (key === 'proyecto_eclipse') {
    const helicopter = w.state(1).vehicle
    const crane = w.find('handler','vehicle')
    for (const [player,vehicle] of [[1,helicopter],[2,crane]]) {
      const [x,y,z] = w.data.eclipse.cargo[1]
      const at = [x,y,z+(player===1?20:0)]
      w.position(w.ped(player),at)
      w.position(vehicle,at)
      w.seat(w.ped(player),vehicle,-1)
    }
  } else {
    inputHeist(w,1,'ready')
    assert.match(w.panel(1).heist.readout[0],/pendiente/)
    for (const player of [1,2]) w.position(w.ped(player),job.sites[player-1])
  }
  const initial = w.panel(2).heist
  inputHeist(w,1,'ready')
  w.action(2,'heistInput',{id:initial.id,rev:initial.rev,key:'ready'},false)
  assert.equal(w.panel(1).heist.phase,'play')
}

function inputHeist(w,player,key) {
  const {id,rev} = w.panel(player).heist
  w.action(player,'heistInput',{id,rev,key})
}

function solveCaja(w) {
  const view = w.panel(2).heist
  assert.deepEqual(view.choices,[])
  assert.deepEqual(w.panel(1).heist.readout,[])
  for (const symbol of view.readout) inputHeist(w,1,symbol)
}

function deliverHeist(w) {
  arrive(w,w.data.garage)
  const state = w.state(1)
  w.step(1)
  assert.ok(w.state(1),'El otro jugador aún no ha vuelto')
  arrive(w,w.data.garage,2,false)
  w.step(2)
  assert.equal(w.state(1),null)
  w.step(1,state)
}

test('Caja de cierre separa las pistas, exige los dos votos y liquida una sola vez',t => {
  const w = createWorld(temporaryRoot(t))
  beginHeist(w,'caja_cierre')
  const stale = w.panel(1).heist
  const sequence = w.panel(2).heist.readout
  const wrong = stale.choices.find(([symbol])=>symbol!==sequence[0])[0]
  inputHeist(w,1,wrong)
  assert.equal(w.panel(1).heist.cursor,0)
  assert.ok(w.state(1).remaining < 115)
  w.action(1,'heistInput',{id:stale.id,rev:stale.rev,key:sequence[0]})
  assert.equal(w.panel(1).heist.rev,stale.rev+1)
  solveCaja(w)
  inputHeist(w,1,'extra')
  assert.equal(w.panel(1).heist.phase,'choice')
  inputHeist(w,2,'extra')
  solveCaja(w)
  deliverHeist(w)
  for (const player of [1,2]) {
    const data = w.saved(player)
    assert.deepEqual(data.lastSettlement.breakdown,{base:1350,extra:650})
    assert.equal(data.cash,2500)
    assert.deepEqual(data.heists,['caja_cierre'])
  }
})

test('La alerta antes del botín falla, y tras asegurar la base solo vence el extra',t => {
  for (const secured of [false,true]) {
    const w = createWorld(temporaryRoot(t))
    beginHeist(w,'caja_cierre')
    if (secured) {
      solveCaja(w)
      inputHeist(w,1,'extra')
      inputHeist(w,2,'extra')
    }
    w.elapse(121000)
    if (!secured) {
      assert.equal(w.state(1),null)
      assert.equal(w.panel(1).cash,500)
    } else {
      assert.equal(w.state(1).step,2)
      deliverHeist(w)
      assert.deepEqual(w.saved(2).lastSettlement.breakdown,{base:1350,extra:0})
    }
  }
})

test('Cámara de ecos alterna puestos, recupera la sesión y permite entregar la base',t => {
  const w = createWorld(temporaryRoot(t))
  beginHeist(w,'camara_ecos')
  for (let cursor=0;cursor<3;cursor++) {
    const operator = 1+cursor%2
    const reader = 3-operator
    const signal = w.panel(reader).heist.readout[0].replace('Eco · ','')
    assert.equal(w.panel(operator).heist.choices.length,6)
    inputHeist(w,reader,signal)
    assert.equal(w.panel(reader).heist.cursor,cursor)
    if (cursor === 1) {
      w.drop(2)
      w.elapse(130000)
      assert.ok(w.state(1))
      w.connect(2)
      w.position(w.ped(2),w.data.contracts.camara_ecos.sites[1])
      assert.equal(w.panel(2).heist.cursor,1)
    }
    inputHeist(w,operator,signal)
  }
  inputHeist(w,2,'leave')
  deliverHeist(w)
  assert.deepEqual(w.saved(1).lastSettlement.breakdown,{base:2700,extra:0})
})

test('Eclipse cruza emblemas e IDs, comprueba los vehículos y entrega la carga con ambos a bordo',t => {
  const w = createWorld(temporaryRoot(t))
  beginHeist(w,'proyecto_eclipse')
  const emblem = w.panel(2).heist.readout[0].replace('Prototipo · ','')
  const cargo = w.state(1).cargo.labels.indexOf(emblem)
  assert.ok(cargo>=0)
  const heli = w.state(1).vehicle
  const crane = w.find('handler','vehicle')
  const ids = w.state(2).cargo.labels
  for (const index of [(cargo+1)%3,cargo]) {
    const at = w.data.eclipse.cargo[index]
    w.position(crane,at)
    inputHeist(w,2,ids[index])
    assert.equal(w.state(1).step,1)
    assert.equal(w.state(1).cargo.onCrane,index===cargo)
  }
  const [x,y,z] = w.data.eclipse.cargo[cargo]
  w.position(heli,[x+20,y,z+10])
  inputHeist(w,1,'hook')
  assert.equal(w.panel(1).heist.phase,'hook')
  w.position(heli,[x,y,z+10])
  w.action(1,'heistInput',w.state(1).cockpit)
  assert.equal(w.state(1).step,2)
  assert.equal(w.state(1).cargo.lifted,cargo)
  const at = w.data.eclipse.landing
  w.position(heli,at)
  w.position(w.ped(1),at)
  w.step(1)
  assert.ok(w.state(1))
  w.position(w.ped(2),at)
  w.seat(w.ped(2),heli,0)
  w.step(1)
  assert.equal(w.state(1),null)
  assert.equal(w.saved(2).lastSettlement.amount,4200)
  assert.equal(w.entities.size,2)
})

test('Dos jugadores completan las 39 misiones y conservan el progreso previo', t => {
  const world = createWorld(temporaryRoot(t))
  world.seed(1, { cash: 8000, completed: 7, bestRally: 90000, cars: { blista: 'cobre', sultan: 'petroleo' } })
  world.connect(1)
  world.connect(2)
  assert.equal(world.panel(1).cash, 8000)
  assert.equal(world.panel(2).cars.blista, 'grafito')
  const contractIds = Object.keys(world.data.contracts).filter(key => !world.data.contracts[key].shift && !world.data.contracts[key].heist)
  assert.equal(Object.keys(world.data.contracts).length,46)
  assert.equal(contractIds.length, 39)
  const featured = world.panel(1).featured
  let total = 0
  for (const key of contractIds) {
    start(world, key)
    const finishing = complete(world, key)
    assert.equal(world.state(1), null, key + ' cerrado')
    assert.equal(world.entities.size, 2, key + ' limpia las entidades')
    const contract = world.data.contracts[key]
    total += contract.pay + (featured === key ? Math.floor(contract.pay / 4) : 0)
    world.action(2, 'step', { id: finishing.id, step: finishing.step })
    assert.equal(world.state(2), null, key + ' rechaza la repetición del cierre')
  }
  assert.equal(world.saved(1).cash, 8000 + total)
  assert.equal(world.saved(2).cash, 500 + total)
  assert.equal(world.saved(1).completed, 7 + contractIds.length)
  assert.equal(world.saved(2).completed, contractIds.length)
  assert.deepEqual(world.saved(1).operations, copy(world.data.operations.filter(key => !world.data.contracts[key].shift)))
  assert.deepEqual(world.saved(2).operations, copy(world.data.operations.filter(key => !world.data.contracts[key].shift)))
  const settlement = world.panel(2).settlement
  const lastContract = world.data.contracts[contractIds.at(-1)]
  assert.deepEqual(settlement, { name: lastContract.name, amount: lastContract.pay, completed: 39,
    progress: 'Operación registrada' })
  const campaignIds = world.data.chapters.flatMap(chapter => chapter.missions)
  assert.deepEqual(world.saved(1).campaign, copy(campaignIds))
  assert.deepEqual(world.saved(2).campaign, copy(campaignIds))
  assert.equal(world.saved(1).cars.sultan, 'petroleo')
  assert.ok(world.saved(1).bestRally > 0 && world.saved(1).bestRally < 90000)
  assert.equal(world.panel(1).story2Reward, true)
  assert.equal(world.panel(2).story2Reward, true)
})

test('La primera campaña desbloquea Frecuencia fantasma y el solitario recibe ambas pistas', t => {
  const root = temporaryRoot(t)
  const world = createWorld(root)
  const { story2, chapters } = world.data
  const firstCampaign = chapters.slice(0, story2.start).flatMap(chapter => chapter.missions)
  const secondCampaign = chapters.slice(story2.start).flatMap(chapter => chapter.missions)
  const first = world.data.contracts[secondCampaign[0]]
  world.connect(1)
  world.action(1, 'start', secondCampaign[0])
  assert.equal(world.state(1), null)
  world.seed(1, { cash: 1250, completed: 18, cars: { blista: 'cobre' }, campaign: firstCampaign })
  assert.equal(world.panel(1).unlockedChapter, story2.start)
  assert.equal(world.panel(1).story2Reward, false)
  world.position(world.ped(1), world.data.motorPool)
  world.action(1, 'paint', { model: 'blista', paint: story2.rewardPaint })
  assert.equal(world.saved(1).cars.blista, 'cobre')

  start(world, secondCampaign[0], null)
  assert.equal(world.state(1).dialogue, first.intro)
  arrive(world, first.stops[0].at)
  world.step()
  assert.equal(world.state(1).dialogue, first.stops[0].dialogue)
  assert.deepEqual(world.panel(1).objectives, copy(first.stops[1].clues))
  complete(world, secondCampaign[0], null)
  for (const key of secondCampaign.slice(1)) {
    start(world, key, null)
    complete(world, key, null, { routeIndex: 1 })
    assert.equal(world.state(1), null)
    assert.equal(world.entities.size, 1)
  }
  assert.equal(world.saved(1).completed, 18 + secondCampaign.length)
  assert.deepEqual(world.saved(1).campaign, copy([...firstCampaign, ...secondCampaign]))
  assert.equal(world.panel(1).story2Reward, true)
  world.position(world.ped(1), world.data.motorPool)
  world.action(1, 'paint', { model: 'blista', paint: story2.rewardPaint })
  const restarted = createWorld(root)
  restarted.connect(1)
  assert.equal(restarted.panel(1).story2Reward, true)
  assert.equal(restarted.panel(1).cars.blista, story2.rewardPaint)
})

test('Las pistas del dúo se reparten entre el conductor y el compañero', t => {
  const world = createWorld(temporaryRoot(t))
  const oldProgress = world.data.chapters.slice(0, world.data.story2.start).flatMap(chapter => chapter.missions)
  for (const player of [1, 2]) {
    world.seed(player, { cash: 500, completed: 8, campaign: oldProgress })
    world.connect(player)
  }
  const contract = world.data.contracts.turno_interrumpido
  start(world, 'turno_interrumpido')
  arrive(world, contract.stops[0].at)
  world.step()
  const [firstClue, secondClue] = contract.stops[1].clues
  assert.equal(world.panel(1).objectives[0], firstClue)
  assert.equal(world.panel(2).objectives[0], secondClue)
  assert.ok(!world.panel(1).objectives.includes(secondClue))
  assert.ok(!world.panel(2).objectives.includes(firstClue))
})

test('El punto de reintento invalida la etapa anterior y el encargo paga una sola vez', t => {
  const world = createWorld(temporaryRoot(t))
  const key = 'dos_destinos'
  const chapterIndex = world.data.chapters.findIndex(chapter => chapter.missions.includes(key))
  const campaign = world.data.chapters.slice(0, chapterIndex).flatMap(chapter => chapter.missions)
  for (const player of [1, 2]) {
    world.seed(player, { cash: 500, completed: campaign.length, campaign })
    world.connect(player)
  }
  const contract = world.data.contracts[key]
  start(world, key)
  assert.equal(world.panel(1).retryAvailable, false)
  arrive(world, contract.stops[0].at)
  world.step()
  const before = world.state(1)
  assert.equal(world.panel(1).retryAvailable, true)
  arrive(world, before.stop.at)
  world.step()
  assert.equal(world.state(1).targets.length, 1)
  world.entities.get(before.vehicle).health = 0
  world.elapse(1100)
  assert.equal(world.state(1).failed, true)
  assert.equal(world.saved(1).cash, 500)
  world.action(1, 'retry')
  const retried = world.state(1)
  assert.notEqual(retried.id, before.id)
  assert.notEqual(retried.vehicle, before.vehicle)
  assert.equal(retried.step, before.step)
  assert.equal(retried.failed, false)
  assert.equal(retried.targets.length, 2)
  assert.deepEqual(world.entities.get(retried.vehicle).at, copy(contract.stops[0].at))
  arrive(world, retried.stop.at)
  world.step(1, before)
  assert.equal(world.state(1).targets.length, 2)
  const finishing = complete(world, key)
  world.step(1, finishing)
  for (const player of [1, 2]) {
    assert.equal(world.saved(player).cash, 500 + contract.pay)
    assert.equal(world.saved(player).campaign.filter(mission => mission === key).length, 1)
  }
})

test('Los nueve incidentes se aceptan y pagan en ruta en solitario y en dúo', t => {
  const root = temporaryRoot(t)
  for (const duo of [false, true]) {
    const completed = new Set()
    for (let rotation = 0; rotation < 3; rotation++) {
      const period = 1200000
      const world = createWorld(root, { clock: Date.UTC(2026, duo ? 3 : 2, 1) + period * rotation })
      world.connect(1)
      if (duo) world.connect(2)
      const offers = world.panel(1).incidents
      assert.equal(offers.length, 3)
      assert.equal(new Set(offers.map(offer => offer.district)).size, 3)
      for (const offer of offers) {
        const contract = world.data.worldEvents.find(event => offer.id.endsWith(':' + event.key))
        const before = world.panel(1).cash
        world.position(world.ped(1), world.data.base)
        world.action(1, 'markIncident', offer.id)
        assert.deepEqual(world.latest('duo:locateCar'), offer.at)
        world.action(1, 'startIncident', offer.id)
        assert.equal(world.state(1), null)
        world.position(world.ped(1), offer.at)
        if (duo) world.position(world.ped(2), offer.at)
        world.action(1, 'startIncident', offer.id)
        const first = world.state(1)
        assert.equal(first.name, contract.name)
        if (duo) {
          world.action(2, 'startIncident', offer.id, false)
          assert.equal(world.state(2), null)
          world.action(2, 'join')
          assert.equal(world.state(2).id, first.id)
        }
        if (duo && contract.kind === 'Búsqueda') {
          assert.match(world.panel(1).objectives[1], /oeste a este/)
          assert.match(world.panel(2).objectives[1], /sur a norte/)
        }
        let secondary
        const confirmer = duo && contract.kind !== 'Búsqueda' ? 2 : 1
        for (const [index, stop] of contract.stops.entries()) {
          arrive(world, stop.at)
          if (duo) {
            world.seat(world.ped(1), first.vehicle)
            world.position(world.ped(2), stop.at)
          }
          if (stop.tow) {
            world.elapse(1100)
            secondary = world.find(stop.tow, 'vehicle')
            assert.ok(secondary)
          } else if (secondary) world.position(secondary, stop.at)
          if (confirmer === 2) {
            world.step(1)
            assert.equal(world.state(1).step, index)
          }
          world.step(confirmer)
          if (stop.escort) {
            secondary = world.find(stop.escort, 'vehicle')
            assert.ok(secondary)
          }
        }
        assert.equal(world.state(1), null, 'Cobra en el destino sin volver al cuartel')
        assert.equal(world.panel(1).cash, before + contract.pay)
        assert.equal(world.panel(1).incidents.find(item => item.id === offer.id).completed, true)
        if (duo) assert.ok(world.saved(2).incidents.includes(offer.id))
        world.action(1, 'step', { id: first.id, step: 1 })
        world.position(world.ped(1), offer.at)
        world.action(1, 'startIncident', offer.id)
        assert.equal(world.state(1), null)
        assert.equal(world.panel(1).cash, before + contract.pay)
        completed.add(contract.key)
      }
    }
    assert.equal(completed.size, 9)
  }
})

test('Un incidente reservado sobrevive a la rotación y el compañero puede reincorporarse', t => {
  const period = 1200000
  const clock = period * 1420000 + period - 20000
  const world = createWorld(temporaryRoot(t), { clock })
  world.connect(1)
  world.connect(2)
  const offer = world.panel(1).incidents[0]
  const stale = world.panel(1).incidents[1]
  for (const player of [1, 2]) world.position(world.ped(player), offer.at)
  world.action(1, 'startIncident', offer.id)
  const first = world.state(1)
  world.action(2, 'join')
  world.drop(2)
  world.elapse(21000)
  assert.equal(world.state(1).id, first.id)
  assert.equal(world.latest('duo:incidents', 1).some(incident => incident.id === offer.id), false)
  world.connect(2)
  assert.equal(world.state(2).id, first.id)
  world.action(1, 'cancel')
  world.position(world.ped(1), stale.at)
  world.action(1, 'startIncident', stale.id)
  assert.equal(world.state(1), null)
  assert.match(world.latest('duo:notice'), /caducado/)
})

test('La oferta diaria recorre las nueve variantes y admite juego en dúo y en solitario', t => {
  const root = temporaryRoot(t)
  const selected = new Set()
  let cash = 500
  for (let index = 0; index < 9; index++) {
    const clock = Date.UTC(2026, 1, 1 + index)
    const world = createWorld(root, { clock })
    const contract = world.data.worldEvents[Math.floor(clock / 86400000) % world.data.worldEvents.length]
    const partner = index % 2 ? null : 2
    world.connect(1)
    if (partner) world.connect(partner)
    const [x, y, z] = world.data.garage
    world.position(world.ped(1), [x + 100, y, z])
    assert.equal(world.panel(1).world.canStart, false)
    world.action(1, 'startWorld')
    assert.equal(world.state(1), null)
    world.position(world.ped(1), world.data.base)
    assert.equal(world.panel(1).world.key, contract.key)
    assert.equal(world.panel(1).world.canStart, true)
    world.action(1, 'startWorld', 'una oferta anterior')
    assert.equal(world.state(1), null)
    world.action(1, 'startWorld', contract.key)
    assert.equal(world.state(1).name, contract.name)
    if (partner) {
      assert.equal(world.panel(partner).world.canStart, false)
      world.action(partner, 'startWorld')
      assert.equal(world.state(partner), null)
      world.action(partner, 'join')
      assert.equal(world.state(partner).id, world.state(1).id)
    }
    complete(world, contract.key, partner, { contract })
    selected.add(contract.key)
    cash += contract.pay
    assert.equal(world.saved(1).cash, cash)
    assert.deepEqual(world.saved(1).campaign, [])
    assert.equal(world.entities.size, partner ? 2 : 1)
  }
  assert.equal(selected.size, 9)
})

test('El evento iniciado conserva la oferta anterior cuando cambia el día UTC', t => {
  const boundary = Date.UTC(2026, 1, 2)
  const world = createWorld(temporaryRoot(t), { clock: boundary - 2000 })
  world.connect(1)
  const offered = world.panel(1).world
  const contract = world.data.worldEvents.find(event => event.key === offered.key)
  world.action(1, 'startWorld', offered.key)
  world.elapse(1500)
  assert.notEqual(world.panel(1).world.key, offered.key)
  assert.equal(world.state(1).name, contract.name)
  complete(world, contract.key, null, { contract })
  assert.equal(world.saved(1).cash, 500 + contract.pay)
  world.position(world.ped(1), world.data.base)
  world.action(1, 'startWorld', offered.key)
  assert.equal(world.state(1), null)
})

test('Los toques atrasados solo afectan a su misión y etapa originales', t => {
  const world = createWorld(temporaryRoot(t))
  world.connect(1)
  world.connect(2)
  start(world, 'mensajeria')
  const first = world.state(1)
  arrive(world, first.stop.at)
  world.step()
  const second = world.state(2)
  arrive(world, second.stop.at, 2)
  world.step(2, first)
  assert.equal(world.state(2).step, second.step)
  world.step(2, { ...second, id: 'otra-mision' })
  assert.equal(world.state(2).step, second.step)
  world.step(2)
  assert.equal(world.state(1).step, second.step + 1)
})

test('El diario recupera un fallo parcial de pago después de reiniciar sin duplicar el abono', t => {
  const root = temporaryRoot(t)
  const world = createWorld(root)
  world.connect(1)
  world.connect(2)
  start(world, 'mensajeria')
  world.failWrite('perfil-bbbb.json')
  complete(world, 'mensajeria')
  const pay = world.data.contracts.mensajeria.pay
  assert.equal(world.saved(1).cash, 500 + pay)
  assert.equal(world.store.load('perfil-bbbb.json').cash, 500)
  assert.equal(fs.readdirSync(root).filter(name => name.startsWith('pago-')).length, 1)

  const restarted = createWorld(root)
  restarted.elapse(11000)
  assert.equal(restarted.saved(1).cash, 500 + pay)
  assert.equal(restarted.saved(2).cash, 500 + pay)
  assert.equal(restarted.saved(1).completed, 1)
  assert.equal(restarted.saved(2).completed, 1)
  restarted.elapse(11000)
  assert.equal(restarted.saved(1).cash, 500 + pay)
  assert.equal(restarted.saved(2).cash, 500 + pay)
  assert.equal(fs.readdirSync(root).filter(name => name.startsWith('pago-')).length, 0)
})

test('Un fallo al registrar el pago deja la entrega disponible para reintentar', t => {
  const world = createWorld(temporaryRoot(t))
  world.connect(1)
  world.connect(2)
  start(world, 'mensajeria')
  world.failWrite('pago-' + world.state(1).id + '.json')
  const finishing = complete(world, 'mensajeria')
  assert.equal(world.state(1).step, finishing.step)
  assert.equal(world.store.load('perfil-aaaa.json').cash, 500)
  assert.equal(world.store.load('perfil-bbbb.json').cash, 500)
  world.step()
  assert.equal(world.state(1), null)
  const expected = 500 + world.data.contracts.mensajeria.pay
  assert.equal(world.saved(1).cash, expected)
  assert.equal(world.saved(2).cash, expected)
})

test('Garaje, pintura, suministros y alijo mantienen un saldo persistente', t => {
  const root = temporaryRoot(t)
  const world = createWorld(root)
  world.seed(1, { cash: 3000, completed: 4 })
  world.connect(1)
  world.connect(2)
  world.position(world.ped(1), world.data.motorPool)
  world.action(1, 'buyCar', 'sultan')
  world.action(1, 'buyCar', 'sultan')
  assert.equal(world.saved(1).cash, 1450)
  world.action(1, 'pull', 'sultan')
  const sultan = world.find('sultan', 'vehicle')
  assert.ok(sultan)
  world.action(1, 'paint', { model: 'sultan', paint: 'petroleo' })
  assert.deepEqual(world.entities.get(sultan).state.duoPaint, copy(world.data.paints.petroleo.rgb))
  world.seat(world.ped(2), sultan, 0)
  world.action(1, 'park')
  assert.ok(world.entities.has(sultan), 'El coche ocupado no desaparece')
  world.seat(world.ped(2), 0)
  world.action(1, 'park')
  assert.ok(!world.entities.has(sultan))
  world.action(1, 'pull', 'sultan')
  const lost = world.find('sultan', 'vehicle')
  world.action(1, 'locateCar')
  assert.deepEqual(world.latest('duo:locateCar'), world.entities.get(lost).at)
  world.entities.get(lost).health = 0
  assert.equal(world.panel(1).lostCar, 'sultan')
  world.action(1, 'recoverCar', 'sultan')
  assert.ok(!world.entities.has(lost))
  const recovered = world.find('sultan', 'vehicle')
  assert.ok(recovered)
  assert.deepEqual(world.entities.get(recovered).state.duoPaint, copy(world.data.paints.petroleo.rgb))
  assert.equal(world.saved(1).cash, 1450)

  world.position(world.ped(1), world.data.shop)
  world.action(1, 'buy', 'blindaje')
  assert.equal(world.latest('duo:supply'), 'blindaje')
  world.action(1, 'claim')
  assert.equal(world.saved(1).cash, 1270)
  const cache = world.data.caches[Math.floor(world.date() / 86400000) % world.data.caches.length]
  world.position(world.ped(1), cache.at)
  world.action(1, 'claim')
  world.action(1, 'claim')
  const restarted = createWorld(root)
  restarted.connect(1)
  assert.equal(restarted.panel(1).cash, 1270 + world.data.cachePay)
  assert.equal(restarted.panel(1).cars.sultan, 'petroleo')
  assert.equal(restarted.panel(1).cache.claimed, true)
})

test('La despensa guarda la comida comprada y se puede consumir fuera del cuartel', t => {
  const root = temporaryRoot(t)
  const world = createWorld(root)
  world.connect(1)
  world.position(world.ped(1), world.data.hangar.at)
  world.action(1, 'buy', 'bocadillo')
  assert.deepEqual(world.panel(1).food, {})
  world.position(world.ped(1), world.data.shop)
  world.action(1, 'buy', 'bocadillo')
  assert.equal(world.panel(1).cash, 445)
  assert.equal(world.latest('duo:supply', 1), undefined)
  const restarted = createWorld(root)
  restarted.connect(1)
  restarted.position(restarted.ped(1), restarted.data.hangar.at)
  assert.equal(restarted.panel(1).food.bocadillo, 1)
  restarted.action(1, 'eat', 'bocadillo')
  assert.equal(restarted.latest('duo:supply', 1), 'bocadillo')
  assert.equal(restarted.panel(1).food.bocadillo, 0)
})

test('El armero cobra una sola vez y devuelve el equipo al reaparecer y reiniciar', t => {
  const root = temporaryRoot(t)
  const world = createWorld(root)
  world.connect(1)
  assert.deepEqual(world.panel(1).weapons, [])
  world.position(world.ped(1), world.data.shop)
  world.action(1, 'buy', 'pistolacombate')
  assert.equal(world.latest('duo:supply', 1), 'pistolacombate')
  world.action(1, 'buy', 'pistolacombate')
  assert.equal(world.saved(1).cash, 180)
  world.fire(1, 'duo:ready')
  assert.deepEqual(world.latest('duo:loadout', 1), ['pistolacombate'])
  const restarted = createWorld(root)
  restarted.connect(1)
  restarted.fire(1, 'duo:ready')
  assert.deepEqual(restarted.latest('duo:loadout', 1), ['pistolacombate'])
})

test('Doble baliza exige dos confirmaciones nuevas después de agotar el plazo o reconectar', t => {
  const world = createWorld(temporaryRoot(t))
  world.connect(1)
  world.action(1, 'start', 'doble_baliza')
  assert.equal(world.state(1), null)
  world.connect(2)
  start(world, 'doble_baliza', null)
  const invitation = world.latest('duo:notice', 2)
  assert.ok(invitation.includes('Invitación') && invitation.includes('Doble baliza'))
  world.action(2, 'join')
  assert.equal(world.latest('duo:crew'), 2)
  assert.equal(world.panel(1).mission.stage, 'briefing')
  assert.deepEqual(world.panel(1).mission.crew.map(member => member.self), [true, false])
  assert.deepEqual(world.panel(2).mission.crew.map(member => member.self), [false, true])
  const briefing = world.state(1)
  world.action(1, 'confirmBriefing', { id: briefing.id, step: briefing.step })
  assert.equal(world.panel(1).operation.confirmed, 1)
  assert.deepEqual(world.panel(2).mission.crew.map(member => member.status), ['ready', 'pending'])
  world.action(2, 'confirmBriefing', { id: briefing.id, step: briefing.step })
  const contract = world.data.contracts.doble_baliza
  arrive(world, contract.stops[1].at)
  world.step()
  const [first, second] = contract.stops[2].paired.sites
  arrive(world, first.at)
  world.step()
  assert.ok(world.state(1).remaining > 0)
  assert.equal(world.state(1).teamwork.confirmed, true)
  assert.equal(world.state(2).teamwork.teammateConfirmed, true)
  assert.ok(world.panel(2).mission.remaining > 0)
  world.elapse(26000)
  assert.equal(world.panel(1).operation.confirmed, 0)
  arrive(world, second.at, 1, false)
  world.step()
  assert.equal(world.panel(1).operation.confirmed, 0, 'El compañero tiene asignada la segunda baliza')
  arrive(world, first.at)
  world.step()
  world.drop(1)
  assert.equal(world.latest('duo:crew'), 1)
  assert.equal(world.panel(2).mission.stage, 'reconnect')
  assert.equal(world.panel(2).mission.crew[0].status, 'away')
  assert.equal(world.state(2).targets.length, 0)
  world.connect(3, licenses[1])
  assert.equal(world.panel(3).operation.role, contract.roles[0])
  assert.equal(world.panel(3).operation.confirmed, 0)
  assert.deepEqual(world.state(3).targets[0].at, copy(first.at))
  assert.equal(world.latest('duo:crew', 3), 2)
})

test('Dos confirmaciones simultáneas avanzan Doble baliza una sola fase', t => {
  const world = createWorld(temporaryRoot(t))
  world.connect(1)
  world.connect(2)
  start(world, 'doble_baliza')
  world.step(1)
  world.step(2)
  const contract = world.data.contracts.doble_baliza
  arrive(world, contract.stops[1].at)
  world.step()
  const [first, second] = contract.stops[2].paired.sites
  arrive(world, first.at)
  arrive(world, second.at, 2, false)
  const before = world.state(1)
  const confirmation = { id: before.id, step: before.step }
  world.elapse(650)
  world.action(1, 'step', confirmation, false)
  world.action(2, 'step', confirmation, false)
  assert.equal(world.state(1).step, before.step + 1)
  assert.equal(world.state(2).remaining, 0)
  world.elapse(650)
  world.action(1, 'step', confirmation, false)
  world.action(2, 'step', confirmation, false)
  assert.equal(world.state(1).step, before.step + 1)
})

test('El HUD separa el objetivo del jugador, la confirmación del equipo y el cronómetro', () => {
  let tick
  let now = 1000
  let player = 1
  const lines = []
  const listeners = new Map()
  const native = () => {}
  const context = vm.createContext({
    Duo: { base: [0, 0, 0], hangar: { at: [0, 0, 0] }, hq: [], contracts: {} },
    onNet: (event, handler) => listeners.set(event, handler), on: native,
    RegisterCommand: native, RegisterKeyMapping: native, RegisterNuiCallbackType: native,
    setInterval: native, setTick: handler => { tick = handler },
    GetGameTimer: () => now, PlayerId: () => 0, GetPlayerServerId: () => player,
    IsPauseMenuActive: () => false, IsEntityDead: () => false,
    PlayerPedId: () => 10, GetEntityCoords: () => [400, 400, 400], GetVehiclePedIsIn: () => 0,
    SetTextFont: native, SetTextScale: native, SetTextColour: native, SetTextOutline: native,
    BeginTextCommandDisplayText: native, EndTextCommandDisplayText: native, DrawRect: native,
    AddTextComponentSubstringPlayerName: text => lines.push(text)
  })
  vm.runInContext(fs.readFileSync(path.join(resource, 'cliente.js'), 'utf8'), context)
  vm.runInContext('initialized = true', context)
  const update = listeners.get('duo:state')
  const base = { id: 'dúo', step: 2, name: 'Doble baliza', stop: { text: 'Sincronizad las balizas' },
    targets: [], members: [1, 2], remaining: 18 }
  update({ ...base, objectives: ['Espera al compañero'],
    teamwork: { stage: 'paired', confirmed: true, teammateConfirmed: false } })
  tick()
  assert.ok(lines.some(line => line.includes('0:18')))
  assert.ok(lines.includes('Espera al compañero'))
  assert.ok(lines.some(line => line.includes('Compañero: pendiente')))
  lines.length = 0
  now += 2000
  player = 2
  update({ ...base, remaining: 16, objectives: ['Confirma la baliza del almacén'],
    teamwork: { stage: 'paired', confirmed: false, teammateConfirmed: true } })
  tick()
  assert.ok(lines.some(line => line.includes('0:16')))
  assert.ok(lines.includes('Confirma la baliza del almacén'))
  assert.ok(lines.some(line => line.includes('Compañero: confirmado')))
  lines.length = 0
  update({ ...base, step: 3, name: 'Relevo nocturno', remaining: 0, objectives: ['Conduce el segundo tramo'],
    teamwork: { stage: 'field', switching: true } })
  tick()
  assert.ok(lines.includes('Relevo: intercambiad los asientos'))
})

test('El HUD NUI limita la telemetría y libera el foco al pausar, morir y detener el recurso', () => {
  let tick
  let now = 1000
  let vehicle = 0
  let classId = 0
  let health = 180
  let paused = false
  let dead = false
  let binding = 't_J'
  const messages = []
  const focus = []
  const events = new Map()
  const commands = new Map()
  const native = () => {}
  const context = vm.createContext({
    Duo: { base: [0, 0, 0], hangar: { at: [0, 0, 0] }, hq: [],
      contracts: {}, supplies: {} },
    onNet: (event, handler) => events.set(event, [handler]),
    on(event, handler) { events.set(event, [...(events.get(event) || []), handler]) },
    RegisterCommand: (name, handler) => commands.set(name, handler),
    RegisterKeyMapping: native, RegisterNuiCallbackType: native,
    setInterval: native, setTick: handler => { tick = handler },
    GetGameTimer: () => now, PlayerId: () => 0, GetPlayerServerId: () => 1,
    GetCurrentResourceName: () => 'duo', IsPauseMenuActive: () => paused, IsEntityDead: () => dead,
    PlayerPedId: () => 10, GetEntityCoords: () => [0, 0, vehicle ? 221 : 1],
    GetVehiclePedIsIn: () => vehicle, GetEntityHealth: () => health, GetEntityMaxHealth: () => 200,
    GetVehicleClass: () => classId, GetPedArmour: () => 63, GetVehicleEngineHealth: () => 540,
    GetSelectedPedWeapon: () => 1, IsPedArmed: () => true, GetAmmoInClip: () => [true, 12],
    GetAmmoInPedWeapon: () => 48, GetVehicleCurrentGear: () => 3, GetEntitySpeed: () => 25,
    GetSafeZoneSize: () => .94, GetControlInstructionalButton: () => binding, IsControlJustReleased: () => false,
    DrawMarker: native, SetTextFont: native, SetTextScale: native, SetTextColour: native, SetTextOutline: native,
    BeginTextCommandDisplayText: native, EndTextCommandDisplayText: native, DrawRect: native,
    AddTextComponentSubstringPlayerName: native, GetPedInVehicleSeat: () => 0, emitNet: native,
    SetNuiFocus: (keyboard, cursor) => focus.push([keyboard, cursor]),
    SendNuiMessage: payload => messages.push(JSON.parse(payload))
  })
  vm.runInContext(fs.readFileSync(path.join(resource, 'cliente.js'), 'utf8'), context)
  vm.runInContext('initialized = true', context)
  const latest = type => messages.findLast(message => message.type === type)
  const telemetry = () => messages.filter(message => message.type === 'hud:telemetry')
  const call = name => events.get('__cfx_nui:' + name)[0]({}, result => assert.equal(result.ok, true))
  tick()
  assert.equal(telemetry().length, 0)
  call('hudReady')
  tick()
  assert.equal(latest('hud:visibility').visible, true)
  assert.deepEqual(telemetry()[0].data, { mode: 'foot', health: 80, armor: 63, clip: 12,
    ammo: 36, speed: null, gear: null, damaged: false, altitude: null, safeZone: .94 })
  assert.equal(latest('hud:prompt').key, 'J')
  binding = 'b_32'
  health = 150
  now += 249
  tick()
  assert.equal(telemetry().length, 1)
  now++
  tick()
  assert.equal(telemetry()[1].data.health, 50)
  assert.equal(latest('hud:prompt').key, 'X')
  now += 250
  tick()
  assert.equal(telemetry().length, 2, 'Sin cambios no se vuelve a enviar')
  vehicle = 20
  now += 99
  tick()
  assert.equal(telemetry().length, 2)
  now++
  tick()
  assert.deepEqual(telemetry()[2].data, { mode: 'road', health: 50, armor: 63, clip: 12,
    ammo: 36, speed: 90, gear: 3, damaged: true, altitude: null, safeZone: .94 })
  classId = 16
  now += 100
  tick()
  assert.equal(telemetry()[3].data.mode, 'air')
  assert.equal(telemetry()[3].data.altitude, 221)
  assert.equal(telemetry()[3].data.gear, null)
  const relay = { id: 'relevo', step: 3, members: [1, 2], name: 'Relevo nocturno',
    stop: { text: 'Cambia el conductor' }, objectives: [], targets: [],
    teamwork: { stage: 'field', switching: true } }
  const update = events.get('duo:state')[0]
  update(relay)
  update(relay)
  assert.equal(messages.filter(message => message.type === 'hud:toast').length, 1)
  assert.equal(latest('hud:mission').data.detail, 'Relevo: intercambiad los asientos')

  commands.get('central')()
  assert.deepEqual(focus.at(-1), [true, true])
  assert.equal(latest('hud:visibility').visible, false)
  call('cierra')
  assert.deepEqual(focus.at(-1), [false, false])
  commands.get('central')()
  paused = true
  tick()
  assert.deepEqual(focus.at(-1), [false, false])
  paused = false
  commands.get('central')()
  dead = true
  tick()
  assert.deepEqual(focus.at(-1), [false, false])
  dead = false
  commands.get('central')()
  for (const stop of events.get('onClientResourceStop')) stop('duo')
  assert.deepEqual(focus.at(-1), [false, false])
  tick()
  now += 10000
  tick()
  assert.equal(latest('hud:visibility').visible, false)
  call('hudHeartbeat')
  tick()
  assert.equal(latest('hud:visibility').visible, true)
})

test('El piloto puede completar los cuatro encargos aéreos en solitario', t => {
  const world = createWorld(temporaryRoot(t))
  world.connect(1)
  const flights = Object.entries(world.data.contracts).filter(([, contract]) => contract.launch)
  assert.equal(flights.length, 4)
  for (const [key] of flights) {
    start(world, key, null)
    complete(world, key, null)
    assert.equal(world.state(1), null)
  }
  assert.equal(world.saved(1).completed, 4)
})

test('El hangar conserva la aeronave comprada y mantiene una plaza independiente del coche', t => {
  const root = temporaryRoot(t)
  const world = createWorld(root)
  world.seed(1, { cash: 12000, completed: 0 })
  world.connect(1)
  world.position(world.ped(1), world.data.motorPool)
  world.action(1, 'pull', 'blista')
  world.action(1, 'locateHangar')
  assert.deepEqual(world.latest('duo:locateCar', 1), copy(world.data.hangar.at))
  world.action(1, 'locateHQ')
  assert.deepEqual(world.latest('duo:locateCar', 1), copy(world.data.base))
  world.action(1, 'buyCar', 'mammatus')
  assert.equal(world.panel(1).cash, 12000, 'La compra exige estar en el hangar')
  world.position(world.ped(1), world.data.hangar.at)
  world.action(1, 'buyCar', 'mammatus')
  world.action(1, 'pull', 'mammatus')
  const aircraft = world.find('mammatus', 'vehicle')
  assert.ok(aircraft)
  assert.equal(world.panel(1).activeAircraft, 'mammatus')
  assert.equal(world.panel(1).activeCar, 'blista')
  world.action(1, 'paint', { model: 'mammatus', paint: 'cobre' })
  world.action(1, 'park', 'mammatus')
  assert.equal(world.find('mammatus', 'vehicle'), undefined)
  assert.equal(world.panel(1).activeCar, 'blista')
  const restarted = createWorld(root)
  restarted.connect(1)
  assert.equal(restarted.panel(1).cars.mammatus, 'cobre')
})

test('Un compañero se reincorpora con la misma licencia y al salir ambos se limpia el contrato', t => {
  const world = createWorld(temporaryRoot(t))
  world.connect(1)
  world.connect(2)
  start(world, 'mensajeria')
  const first = world.state(1)
  arrive(world, first.stop.at)
  world.step()
  world.drop(2)
  world.elapse(299000)
  world.connect(13, licenses[2])
  assert.equal(world.state(13)?.id, first.id)
  assert.equal(world.state(13)?.step, first.step + 1)
  world.drop(13)
  world.elapse(301000)
  world.connect(14, licenses[2])
  assert.ok(!world.state(14) || !world.state(14).members.includes(14), 'Caduca la reincorporación')
  world.drop(1)
  assert.equal(world.entities.size, 1)
  assert.equal(world.state(14), null)
})

test('El respaldo de perfil conserva saldo y coches tras un archivo principal dañado', t => {
  const root = temporaryRoot(t)
  const world = createWorld(root)
  assert.equal(world.store.save('perfil-aaaa.json', {
    cash: 2040, completed: 5, cars: { blista: 'cobre', sultan: 'grafito' }
  }), true)
  fs.writeFileSync(path.join(root, 'perfil-aaaa.json'), '{mal formado')
  const restarted = createWorld(root)
  restarted.connect(1)
  assert.equal(restarted.panel(1).cash, 2040)
  assert.equal(restarted.panel(1).cars.blista, 'cobre')
  assert.equal(restarted.panel(1).completed, 5)
})

test('Carga urgente usa el cronómetro fuera del coche y cancela al vencer', t => {
  const world = createWorld(temporaryRoot(t))
  world.connect(1)
  start(world, 'carga', null)
  arrive(world, world.state(1).stop.at)
  world.step()
  assert.equal(world.state(1).step, 1)
  assert.ok(world.state(1).remaining > 0)
  world.elapse((world.data.contracts.carga.timeLimit + 1) * 1000)
  assert.equal(world.state(1), null)
  assert.equal(world.entities.size, 1)
  assert.equal(world.store.load('perfil-aaaa.json').completed, 0)
})

test('Cruce de Davis en solitario exige las dos confirmaciones', t => {
  const world = createWorld(temporaryRoot(t))
  const earlierChapters = world.data.chapters.slice(0, 3).flatMap(chapter => chapter.missions)
  world.seed(1, { cash: 500, completed: 6, campaign: earlierChapters })
  world.connect(1)
  start(world, 'cruce', null)
  complete(world, 'cruce', null)
  assert.ok(world.saved(1).campaign.includes('cruce'))
})

test('El anfitrión necesita desbloquear el capítulo y un acompañante puede ayudar', t => {
  const world = createWorld(temporaryRoot(t))
  const earlierChapters = world.data.chapters.slice(0, 3).flatMap(chapter => chapter.missions)
  world.seed(1, { cash: 500, completed: 6, campaign: earlierChapters })
  world.connect(1)
  world.connect(2)
  world.action(2, 'start', 'cruce')
  assert.equal(world.state(2), null)
  start(world, 'cruce')
  complete(world, 'cruce')
  assert.ok(world.saved(1).campaign.includes('cruce'))
  assert.ok(!world.saved(2).campaign.includes('cruce'))
  assert.ok(world.saved(2).cash > 500)
})

test('El perfil remoto acepta solo las dos licencias configuradas', t => {
  const allowlist = ['license:' + 'a'.repeat(40), 'license:' + 'b'.repeat(40)]
  const root = temporaryRoot(t)
  const world = createWorld(root, { convars: {
    duo_require_allowlist: '1',
    duo_allowlist: allowlist.join(',')
  } })
  world.connect(1, allowlist[0])
  world.connect(2, allowlist[1])
  world.connect(3, 'license:' + 'c'.repeat(40))

  function attempt(fixture, id) {
    let deferred = false
    let message
    fixture.fire(id, 'playerConnecting', 'Jugador ' + id, () => {}, {
      defer: () => { deferred = true },
      done: reason => { message = reason }
    })
    fixture.elapse(1)
    return { deferred, message }
  }
  assert.equal(attempt(world, 1).deferred, false)
  assert.equal(attempt(world, 2).deferred, false)
  assert.match(attempt(world, 3).message, /jugadores autorizados/)

  const invalid = createWorld(root, { convars: {
    duo_require_allowlist: '1',
    duo_allowlist: [allowlist[0], allowlist[0]].join(',')
  } })
  invalid.connect(1, allowlist[0])
  assert.match(attempt(invalid, 1).message, /configurar los dos jugadores/)
})
test('Última ambulancia valida roles, rescate parcial o doble, cobro único y limpieza',t => {
  for (const count of [1,2]) {
    const w=createWorld(temporaryRoot(t))
    w.connect(1)
    w.connect(2)
    start(w,'ultima_ambulancia')
    w.step(1)
    w.step(2)
    const car=w.state(1).vehicle
    w.seat(w.ped(1),car,-1)
    assert.notDeepEqual(w.state(1).targets[0].at,w.state(2).targets[0].at)
    for (let i=0;i<count;i++) {
      const at=w.data.rescue.people[i]
      arrive(w,at)
      arrive(w,at,2,false)
      w.elapse(1200)
      w.step(1)
      assert.equal(w.state(2).outbreak.length,1)
      w.step(2)
      assert.equal(w.state(2).outbreak.length,0)
      assert.equal(w.state(1).enemies.length,3*(i+1))
    }
    const last=w.state(1)
    arrive(w,w.data.rescue.hospital)
    w.step(1)
    assert.ok(w.state(1))
    arrive(w,w.data.rescue.hospital,2,false)
    w.step(2)
    w.step(1,last)
    assert.equal(w.entities.size,2)
    for (const id of [1,2]) assert.equal(w.saved(id).cash,500+(count===2?2600:1800))
  }
})

test('Un brote perdido se cierra sin pago y retira los infectados',t => {
  const w=createWorld(temporaryRoot(t))
  w.connect(1)
  w.connect(2)
  start(w,'ultima_ambulancia')
  w.step(1)
  w.step(2)
  for (const at of w.data.rescue.people) {
    arrive(w,at,2,false)
    w.elapse(1200)
    const state=w.state(2)
    assert.ok(state.enemies.length<=8)
    w.entities.get(state.outbreak[0]).health=0
    w.elapse(1200)
  }
  assert.equal(w.state(1),null)
  assert.equal(w.panel(1).cash,500)
  assert.equal(w.entities.size,2)
})
test('El invitado elige conducir y el anfitrión recibe la ubicación del primer civil',t=>{
  const w=createWorld(temporaryRoot(t))
  w.connect(1)
  w.connect(2)
  start(w,'ultima_ambulancia')
  const id=w.state(2).id
  w.action(2,'rescueRole',{id,role:'driver'})
  assert.equal(w.panel(2).operation.role,'Conductor de emergencias')
  w.step(1)
  w.action(1,'rescueRole',{id,role:'driver'})
  assert.equal(w.panel(2).operation.role,'Conductor de emergencias')
  w.step(2)
  assert.deepEqual(w.state(1).targets[0].at,copy(w.data.rescue.people[0]))
  assert.deepEqual(w.state(2).targets[0].at,copy(w.data.rescue.meeting))
})
