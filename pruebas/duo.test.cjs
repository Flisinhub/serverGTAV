const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')

const scripts = ['contratos.js', 'expansion.js', 'campana.js', 'frecuencia.js', 'eventos.js', 'guardado.js', 'servidor.js']
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
    GetPlayerIdentifierByType: (player, type) => {
      const license = players.get(Number(player))?.license
      return type === 'license' ? license ?? null : null
    },
    GetPlayerPed: player => players.get(Number(player))?.ped || 0,
    DoesEntityExist: entity => entities.has(entity),
    GetEntityCoords: entity => entities.get(entity)?.at || [0, 0, 0],
    GetEntityHeading: entity => entities.get(entity)?.heading || 0,
    GetEntityHealth: entity => entities.get(entity)?.health || 0,
    GetEntitySpeed: () => 0,
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
  for (let index = world.state(1).step; index < contract.stops.length; index++) {
    const stop = contract.stops[index]
    const current = world.state(1)
    assert.equal(current.step, index, key + ' etapa ' + index)
    let confirmer = 1
    arrive(world, stop.at)

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
  arrive(world, world.data.garage)
  world.step()
  return finishing
}

test('Dos jugadores completan las 30 misiones y conservan el progreso previo', t => {
  const world = createWorld(temporaryRoot(t))
  world.seed(1, { cash: 8000, completed: 7, bestRally: 90000, cars: { blista: 'cobre', sultan: 'petroleo' } })
  world.connect(1)
  world.connect(2)
  assert.equal(world.panel(1).cash, 8000)
  assert.equal(world.panel(2).cars.blista, 'grafito')
  const contractIds = Object.keys(world.data.contracts)
  assert.equal(contractIds.length, 30)
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
