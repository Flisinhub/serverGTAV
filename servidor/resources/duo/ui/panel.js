const app = document.getElementById('app')
const content = document.getElementById('content')
const bar = document.getElementById('bar')
const overview = document.getElementById('overview')
const objectives = document.getElementById('objectives')
const stories = document.getElementById('stories')
const chapters = document.getElementById('chapters')
const status = document.getElementById('status')
const tabs = document.getElementById('tabs')
const resume = document.getElementById('resume')
const money = value => '$' + new Intl.NumberFormat('es-ES').format(value)
const standalone = typeof GetParentResourceName !== 'function'
let tab = 'hq'
let filter = 'Todos'
let snapshot
let selectedStory
let selectedOperation
let timerEnds = 0
let welcomeOffered = false
let welcomePending = false
let setPreviewView
const selectedChapters = new Map()
const expandedMissions = new Set()
const fleetFilters = new Map()
const displaySelection = new Map()
const checkout = document.createElement('dialog')
checkout.className = 'checkout'
checkout.setAttribute('aria-label', 'Confirmar compra')
app.append(checkout)

const crewStatus = {
  vacant: 'Plaza libre', away: 'Reconectando', active: 'En misión', pending: 'Pendiente',
  confirmed: 'Confirmado', ready: 'Listo'
}
const missionStatus = {
  briefing: 'Preparando salida', field: 'En misión', reconnect: 'Esperando reconexión',
  return: 'Regreso al cuartel', failed: 'Interrumpida'
}

function element(tag, text = '', classes = '') {
  const node = document.createElement(tag)
  node.textContent = text
  node.className = classes
  return node
}

async function call(endpoint, data = {}) {
  if (standalone) {
    if (endpoint === 'cierra') setPreviewView?.('foot')
    else status.textContent = 'La vista previa muestra el panel. Las acciones se ejecutan dentro de FiveM.'
    return
  }
  try {
    const response = await fetch('https://' + GetParentResourceName() + '/' + endpoint,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (!response.ok) status.textContent = 'La central no pudo procesar la acción.'
  } catch {
    status.textContent = 'No se pudo comunicar con el juego.'
  }
}

function button(text, handle, enabled = true, primary = false) {
  const node = element('button', text, primary ? 'primary' : '')
  node.type = 'button'
  node.disabled = !enabled
  node.addEventListener('click', handle)
  return node
}

function action(title, operation, value, enabled, primary = true) {
  const purchase = operation === 'buy' || operation === 'buyCar'
  const control = button(title, () => purchase ? openCheckout(operation, value) : call('accion', { operation, value }), enabled, primary)
  control.dataset.focus = operation + ':' + JSON.stringify(value)
  return control
}

function openCheckout(operation, value) {
  const item = operation === 'buyCar' ? Duo.cars[value] : Duo.supplies[value]
  if (!item || snapshot.cash == null) return
  checkout.replaceChildren(element('p', 'CONFIRMACIÓN DE COMPRA', 'checkout-label'),
    element('h2', item.name || item.label),
    facts([['Precio', money(item.price)], ['Saldo después', money(snapshot.cash - item.price)]]))
  const actions = element('div', '', 'objective-actions')
  actions.append(button('Volver', () => checkout.close()), button('Confirmar compra', () => {
    checkout.close()
    call('accion', { operation, value })
  }, snapshot.cash >= item.price, true))
  checkout.append(actions)
  checkout.showModal()
  actions.firstChild.focus()
}

function displayBanner(section, title, copy) {
  const banner = element('header', '', 'store-banner ' + section)
  banner.append(element('h2', title), element('p', copy))
  content.append(banner)
}

function displayItem(section, key, title, detail, actionNode, extras) {
  const article = element('article', '', 'store-detail')
  article.append(element('h2', title), element('p', detail))
  if (extras) article.append(extras)
  const controls = element('div', '', 'objective-actions')
  controls.append(actionNode)
  article.append(controls)
  content.querySelector('.store-banner').after(article)
  article.dataset.selection = section + ':' + key
}

function inspectItem(section, key) {
  const control = button('Ver ficha', () => {
    displaySelection.set(section, key)
    render()
    const detail = content.querySelector('.store-detail')
    detail?.scrollIntoView({ block: 'nearest' })
    detail?.querySelector('button:not(:disabled)')?.focus({ preventScroll: true })
  }, true, false)
  control.dataset.focus = 'inspect:' + key
  return control
}

function segmented(label, values, selected, pick) {
  const group = element('div', '', 'filters')
  group.setAttribute('role', 'group')
  group.setAttribute('aria-label', label)
  for (const value of values) {
    const option = button(value, () => pick(value))
    option.dataset.focus = label + ':' + value
    option.setAttribute('aria-pressed', String(selected === value))
    group.append(option)
  }
  return group
}

function card(type, title, detail, price, control, featured = false) {
  const article = element('article', '', 'card' + (featured ? ' featured' : ''))
  const actions = element('div', '', 'actions')
  actions.append(element('span', price, 'price'), control)
  article.append(element('span', type, 'type'), element('h2', title), element('p', detail), actions)
  content.append(article)
  return article
}

function contractControls() {
  if (snapshot.ongoing) {
    bar.append(snapshot.member
      ? action('Cancelar contrato', 'cancel', null, true, false)
      : action('Unirse al contrato', 'join', null, snapshot.canJoin))
  } else if (!snapshot.atBase) {
    bar.append(element('span', 'Acércate a la central para iniciar un contrato.'))
  }
}

function campaign() {
  const route = Duo.chapters || []
  const completed = new Set(snapshot.campaign || [])
  const unlocked = Math.max(0, Math.min(snapshot.unlockedChapter ?? 0, route.length - 1))
  contractControls()
  if (!route.length) return
  const sequel = Duo.story2
  const storyGroups = sequel ? [
    { name: 'Primera campaña', start: 0, end: sequel.start },
    { name: sequel.name, start: sequel.start, end: route.length }
  ] : [{ name: 'Primera campaña', start: 0, end: route.length }]
  const activeStory = selectedStory ?? storyGroups.findIndex(story => unlocked < story.end)
  const story = storyGroups[activeStory]
  if (storyGroups.length > 1) {
    stories.hidden = false
    for (const [index, group] of storyGroups.entries()) {
      const missions = route.slice(group.start, group.end).flatMap(chapter => chapter.missions)
      const done = missions.filter(key => completed.has(key)).length
      const progress = group.start > unlocked
        ? 'Completa la primera campaña para desbloquearla'
        : done + ' de ' + missions.length + ' misiones completadas'
      const choice = button('', () => {
        selectedStory = index
        render()
      })
      choice.className = 'story'
      choice.dataset.focus = 'story-' + index
      choice.setAttribute('aria-pressed', String(index === activeStory))
      choice.append(element('strong', group.name), element('span', progress))
      stories.append(choice)
    }
  }
  const showing = selectedChapters.get(activeStory) ?? Math.max(story.start, Math.min(unlocked, story.end - 1))
  chapters.hidden = false
  const map = element('div', '', 'chapter-map')
  map.setAttribute('role', 'group')
  map.setAttribute('aria-label', 'Capítulos de campaña')
  for (const [offset, chapter] of route.slice(story.start, story.end).entries()) {
    const index = story.start + offset
    const done = chapter.missions.filter(key => completed.has(key)).length
    const locked = index > unlocked
    const description = locked ? 'Bloqueado' : done === chapter.missions.length
      ? 'Completado' : done + ' de ' + chapter.missions.length + ' completadas'
    const choice = button('', () => {
      selectedChapters.set(activeStory, index)
      render()
    })
    choice.className = 'chapter'
    choice.dataset.focus = 'chapter-' + index
    choice.setAttribute('aria-pressed', String(index === showing))
    choice.style.setProperty('--chapter-image', 'url(capitulo-' + (index + 1) + '.jpg)')
    const number = String(offset + 1).padStart(2, '0')
    choice.append(element('span', 'Capítulo ' + number, 'chapter-index'), element('strong', chapter.name),
      element('span', description, 'chapter-status'))
    map.append(choice)
  }
  chapters.append(map)

  const chapter = route[showing]
  const locked = showing > unlocked
  if (chapter.intro) chapters.append(element('p', chapter.intro, 'chapter-intro'))
  if (locked) {
    const previous = showing === sequel?.start ? 'la primera campaña' : 'el capítulo «' + route[showing - 1].name + '»'
    chapters.append(element('p', 'Completa ' + previous + ' para desbloquear este capítulo.', 'chapter-hint'))
  }
  content.classList.add('chapter-missions', 'missions-' + chapter.missions.length)
  for (const [index, key] of chapter.missions.entries()) {
    const contract = Duo.contracts[key]
    const [, detail] = Duo.briefs[key]
    const done = completed.has(key)
    const title = locked ? 'Bloqueado' : done ? 'Repetir' : 'Iniciar'
    const missionNumber = 'Misión ' + (index + 1) + (done ? ' · Completada' : '')
    const article = card(missionNumber, contract.name, detail, money(contract.pay),
      action(title, 'start', key, !locked && snapshot.atBase && !snapshot.ongoing))
    if (locked || !contract.stops?.length) continue
    const instructions = element('details', '', 'mission-details')
    instructions.open = expandedMissions.has(key)
    instructions.addEventListener('toggle', () => {
      if (instructions.open) expandedMissions.add(key)
      else expandedMissions.delete(key)
    })
    const summary = element('summary', 'Ver objetivos')
    summary.dataset.focus = 'brief-' + key
    const steps = element('ol')
    for (const stop of contract.stops) steps.append(element('li', stop.text))
    steps.append(element('li', 'Devuelve el vehículo a la central.'))
    instructions.append(summary)
    if (contract.intro) instructions.append(element('p', contract.intro, 'mission-intro'))
    instructions.append(steps)
    article.insertBefore(instructions, article.lastChild)
  }
}

function contracts() {
  const filters = element('div', '', 'filters')
  for (const kind of ['Todos', 'Trabajo', 'Banda', 'Contrarreloj', 'Aviación']) {
    const option = button(kind, () => { filter = kind; render() })
    option.dataset.focus = 'filter-' + kind
    option.setAttribute('aria-pressed', String(kind === filter))
    filters.append(option)
  }
  bar.append(filters)
  contractControls()
  const story = new Set((Duo.chapters || []).flatMap(chapter => chapter.missions))
  const available = Object.entries(Duo.contracts).filter(([key, contract]) => !story.has(key) && !contract.duoOnly)
  const order = available.sort(([a], [b]) => Number(b === snapshot.featured) - Number(a === snapshot.featured))
  for (const [key, contract] of order) {
    const [kind, detail] = Duo.briefs[key]
    if (filter !== 'Todos' && filter !== kind) continue
    const featured = key === snapshot.featured
    const pay = contract.pay + (featured ? Math.floor(contract.pay / 4) : 0)
    card(featured ? kind + ' · +25 % hoy' : kind, contract.name, detail, money(pay),
      action('Iniciar', 'start', key, snapshot.atBase && !snapshot.ongoing), featured)
  }
}

function garage(air = false) {
  const atStation = !!(air ? snapshot.atHangar : snapshot.atGarage)
  const activeModel = air ? snapshot.activeAircraft : snapshot.activeCar
  const lostModel = air ? snapshot.lostAircraft : snapshot.lostCar
  const bay = (air ? snapshot.fleet?.hangar : snapshot.fleet?.garage) || {}
  const stationHint = atStation ? '' : air ? 'Acércate al hangar de Sandy Shores.' : 'Acércate al garaje del cuartel.'
  const noBay = bay.free === 0 ? 'Todas las plazas de salida están ocupadas.' : ''
  const activeHint = activeModel ? 'Guarda el vehículo que está fuera.' : lostModel ? 'Recupera antes el vehículo perdido.' : ''
  const section = air ? 'hangar' : 'garage'
  displayBanner(section, air ? 'Exposición de Sandy Shores' : 'Exposición del cuartel',
    air ? 'Explora las aeronaves y consulta los precios.' : 'Explora la flota y gestiona tus vehículos.')
  const selected = fleetFilters.get(section) || 'Todos'
  const options = ['Todos', 'En propiedad', 'Disponibles', 'Fuera']
  bar.append(segmented('Filtrar vehículos', options, selected, value => { fleetFilters.set(section, value); render() }))
  if (air && !atStation) bar.append(action('Marcar hangar', 'locateHangar', null, true, false))
  if (activeModel || lostModel) {
    const pin = element('article', '', 'mission-summary vehicle-pin')
    pin.append(element('span', lostModel ? 'Pendiente de recuperación' : 'Vehículo fuera', 'state-chip'),
      element('h2', Duo.cars[activeModel || lostModel].name))
    const controls = element('div', '', 'objective-actions')
    const reason = activeModel ? stationHint || bay.parkHint : stationHint || noBay
    if (activeModel) {
      controls.append(action('Localizar', 'locateCar', activeModel, true),
        action('Guardar', 'park', activeModel, !reason, false))
    } else controls.append(action('Recuperar', 'recoverCar', lostModel, !reason))
    if (reason) pin.append(element('p', reason, 'availability'))
    pin.append(controls)
    content.append(pin)
  }
  let cards = 0
  for (const [key, car] of Object.entries(Duo.cars)) {
    if (!!car.type !== air) continue
    const owned = Object.hasOwn(snapshot.cars, key)
    const active = activeModel === key
    const lost = lostModel === key
    if ((selected === 'En propiedad' && !owned) || (selected === 'Disponibles' && owned) ||
        (selected === 'Fuera' && !active && !lost)) continue
    const reason = active || lost ? '' : stationHint ||
      (owned ? activeHint || noBay : snapshot.cash == null ? 'Perfil sin cargar.' :
        snapshot.cash < car.price ? 'Saldo insuficiente.' : '')
    let control
    if (active) control = element('span', 'En la calle', 'vehicle-status')
    else if (lost) control = element('span', 'Usa Recuperar arriba', 'vehicle-status')
    else if (owned) control = action('Sacar', 'pull', key, !reason)
    else control = action('Comprar', 'buyCar', key, !reason)
    const detail = active ? 'Vehículo activo' : lost ? 'Pendiente de recuperar'
      : owned ? 'En propiedad' : 'Disponible para comprar'
    const isSelected = displaySelection.get(section) === key
    const article = card(car.kind, car.name, detail,
      owned ? 'En propiedad' : money(car.price), inspectItem(section, key), isSelected)
    cards++
    if (reason) article.insertBefore(element('p', reason, 'availability'), article.lastChild)
    const swatches = element('div', '', 'swatches')
    for (const [paint, color] of owned ? Object.entries(Duo.paints) : []) {
      const locked = color.requires === 'story2' && !snapshot.story2Reward
      const option = action('', 'paint', { model: key, paint }, atStation && !locked, false)
      option.style.setProperty('--swatch', color.swatch)
      option.title = locked ? color.name + ' · Completa Frecuencia fantasma' :
        stationHint ? color.name + ' · ' + stationHint : color.name
      option.setAttribute('aria-label', option.title)
      option.setAttribute('aria-pressed', String(snapshot.cars[key] === paint))
      swatches.append(option)
    }
    if (isSelected) {
      displayItem(section, key, car.name,
        [car.kind, owned ? 'En propiedad' : money(car.price), reason].filter(Boolean).join(' · '), control, owned ? swatches : null)
    }
  }
  if (!cards) content.append(element('p', selected === 'Fuera' ? 'No tienes vehículos fuera.' :
    'No hay vehículos con este filtro.', 'empty'))
}

function shop() {
  displayBanner('shop', 'Despensa y armero', 'Comida para el camino, equipo y suministros.')
  const selected = fleetFilters.get('shop') || 'Todos'
  bar.append(segmented('Filtrar suministros', ['Todos', 'Comida', 'En equipo', 'Disponibles', 'Consumibles'],
    selected, value => { fleetFilters.set('shop', value); render() }))
  let cards = 0
  for (const [key, supply] of Object.entries(Duo.supplies)) {
    const { label, price, detail, ammo } = supply
    const owned = ammo && snapshot.weapons?.includes(key)
    const units = snapshot.food?.[key] || 0
    if ((selected === 'Comida' && !supply.heal) || (selected === 'En equipo' && !owned && !units) ||
        (selected === 'Disponibles' && owned) || (selected === 'Consumibles' && (ammo || supply.heal))) continue
    const reason = !snapshot.atShop ? 'Acércate al almacén del cuartel.' :
      snapshot.cash == null ? 'Perfil sin cargar.' : snapshot.cash < price ? 'Saldo insuficiente.' :
        units >= 10 ? 'Mochila llena para este artículo.' : ''
    const description = detail || ('Equipo permanente · ' + ammo + ' cartuchos al reaparecer.')
    const isSelected = displaySelection.get('shop') === key
    const article = card(ammo ? 'Armero' : supply.heal ? 'Comida' : 'Suministros', label, description,
      owned ? 'Adquirida' : money(price) + (units ? ' · ' + units + ' en mochila' : ''),
      inspectItem('shop', key), isSelected)
    if (isSelected) {
      displayItem('shop', key, label, [description, supply.heal ? units + ' en mochila' : '', !owned ? reason : ''].filter(Boolean).join(' · '), owned
        ? element('span', 'En tu equipo', 'vehicle-status')
        : action('Comprar · ' + money(price), 'buy', key, !reason),
      units ? action('Consumir', 'eat', key, true, false) : null)
    }
    cards++
    if (!owned && reason) article.insertBefore(element('p', reason, 'availability'), article.lastChild)
  }
  if (!cards) content.append(element('p', 'No hay equipo con este filtro.', 'empty'))
}

function world() {
  const { cache, world: event } = snapshot
  if (snapshot.ongoing) contractControls()
  if (event) {
    card([event.kind, event.zone].filter(Boolean).join(' · '), event.name, event.brief,
      money(event.pay), action('Aceptar encargo', 'startWorld', event.key, event.canStart), true)
  }
  if (cache) card('Exploración diaria', 'Alijo de ' + cache.label, cache.hint,
    cache.claimed ? 'Recogido' : money(Duo.cachePay),
    action('Marcar zona', 'locate', null, !cache.claimed), !event)
}

function selectSection(section) {
  const controls = Array.from(tabs.children)
  if (!controls.some(control => control.dataset.tab === section)) return
  tab = section
  for (const control of controls) control.setAttribute('aria-pressed', String(control.dataset.tab === tab))
  document.getElementById('viewport').scrollTop = 0
  render()
}

function facts(values) {
  const list = element('dl', '', 'facts')
  for (const [label, value] of values) {
    if (!value) continue
    const property = element('div')
    property.append(element('dt', label), element('dd', value))
    list.append(property)
  }
  return list
}

function updateClock() {
  const clock = document.getElementById('mission-clock')
  if (!clock) return
  const seconds = Math.max(0, Math.ceil((timerEnds - Date.now()) / 1000))
  clock.textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0')
}

function liveMission(mission) {
  const article = element('article', '', 'mission-summary')
  const heading = element('div', '', 'mission-heading')
  const state = element('span', missionStatus[mission.stage], 'state-chip ' + mission.stage)
  const title = element('h2', mission.name)
  heading.append(title, state)
  if (timerEnds > Date.now()) {
    const clock = element('strong', '', 'mission-clock')
    clock.id = 'mission-clock'
    clock.setAttribute('aria-label', 'Tiempo restante')
    heading.append(clock)
  }
  article.append(heading, facts([
    ['Zona', mission.area], ['Vehículo', mission.vehicle], ['Pago individual', money(mission.pay)],
    ['Fase', mission.step + '/' + mission.total]
  ]))
  const crew = element('ul', '', 'crew-list')
  for (const member of mission.crew) {
    const slot = element('li', '', 'crew-slot')
    const info = element('div', '', 'crew-info')
    const name = member.status === 'vacant' ? 'Compañero' : member.name
    info.append(element('strong', name + (member.self ? ' · Tú' : '')), element('span', member.role))
    slot.append(info, element('span', crewStatus[member.status], 'state-chip ' + member.status))
    crew.append(slot)
  }
  article.append(crew)
  const controls = element('div', '', 'objective-actions')
  const operation = snapshot.operation
  if (!snapshot.member) {
    controls.append(action('Unirse al contrato', 'join', null, snapshot.canJoin))
    if (!snapshot.canJoin) article.append(element('p', snapshot.atBase
      ? 'La incorporación se hace antes de salir.' : 'Ve al cuartel para unirte.', 'availability'))
  } else if (operation?.briefing) {
    controls.append(action('Confirmar salida', 'confirmBriefing', { id: operation.id, step: operation.step }, operation.canBrief))
    if (!operation.canBrief) article.append(element('p', operation.count < 2 ? 'Esperando a que se una el compañero.'
      : operation.confirmed && mission.crew.some(member => member.self && member.status === 'ready')
        ? 'Salida confirmada. Espera a tu compañero.' : 'Acércate al tablón.', 'availability'))
  } else if (mission.stage === 'field' || mission.stage === 'return') {
    const play = button('Volver al juego', () => call('cierra'), true, true)
    play.dataset.focus = 'resume-game'
    controls.append(play)
  }
  if (snapshot.member) controls.append(action('Cancelar contrato', 'cancel', null, true, false))
  article.append(controls)
  overview.append(article)
  updateClock()
}

function headquarters() {
  const bays = snapshot.garageBays || [false, false]
  const connected = (snapshot.crew ?? 0) + '/2 jugadores conectados'
  bar.append(element('span', connected))
  if (!snapshot.mission && welcomePending) {
    const offer = element('aside', '', 'mission-summary welcome-offer')
    const actions = element('div', '', 'objective-actions')
    actions.append(button('Ver guía', () => selectSection('help'), true, true),
      button('Omitir', () => {
        window.DuoWelcome.dismiss()
        welcomePending = false
        render()
      }))
    offer.append(element('h2', 'Primera salida'), element('p', 'Busca el cuartel y únete a tu compañero.'), actions)
    overview.append(offer)
  }
  if (snapshot.mission) liveMission(snapshot.mission)
  else {
    const dispatch = element('article', '', 'mission-summary dispatch' + (snapshot.settlement ? '' : ' full'))
    dispatch.append(element('h2', 'Preparad la próxima salida'),
      element('p', 'Elegid un encargo para dos y confirmad en el tablón antes de salir.'),
      button('Preparar operación', () => selectSection('operations'), true, true))
    content.append(dispatch)
    if (snapshot.settlement) {
      const { name, amount, completed, progress } = snapshot.settlement
      const receipt = element('article', '', 'card settlement')
      receipt.append(element('span', 'Último cierre', 'type'), element('h2', name),
        element('strong', '+' + money(amount), 'settlement-payment'),
        element('p', progress + ' · ' + completed + ' contratos al cobrar'))
      content.append(receipt)
    }
  }
  for (const [category, title, detail, destination] of [
    ['Encargos', 'Tablón de trabajos', 'Repartos, taxi, bandas y contrarreloj. El segundo jugador puede unirse aquí desde el menú.', 'contracts'],
    ['Operaciones', 'Campañas', 'Consulta los capítulos y retomad los encargos de la historia.', 'campaign'],
    ['Vehículos', 'Garaje y taller', bays.filter(used => !used).length + '/' + bays.length + ' plazas de salida libres. Saca, guarda, pinta o recupera un coche.', 'garage'],
    ['Aviación', 'Hangar de Sandy Shores', 'Consulta tus aeronaves y marca el hangar en el mapa.', 'hangar'],
    ['Equipo', 'Almacén de suministros', 'Consigue blindaje, curación y material antes de salir.', 'shop'],
    ['Ciudad', 'Exploración', 'Consulta el encargo diario o localiza el alijo en el mapa.', 'world']
  ]) {
    card(category, title, detail, '', button('Abrir', () => selectSection(destination)))
  }
}

function operations() {
  contractControls()
  const banner = element('section', '', 'operations-banner')
  banner.append(element('h2', 'Sala de operaciones'),
    element('p', (snapshot.operations || []).length + '/' + Duo.operations.length + ' operaciones completadas en tu perfil'))
  content.append(banner)
  const crewOnline = (snapshot.crew ?? 0) >= 2
  if (!snapshot.ongoing && snapshot.atBase && !crewOnline) {
    bar.append(element('span', 'Conectaos los dos para iniciar una operación.'))
  }
  if (selectedOperation) {
    const contract = Duo.contracts[selectedOperation]
    const brief = element('article', '', 'mission-summary')
    brief.append(element('h2', contract.name), element('p', contract.intro), facts([
      ['Zona', contract.area], ['Vehículo', contract.vehicleName], ['Pago individual', money(contract.pay)],
      ['Primer jugador', contract.roles[0]], ['Segundo jugador', contract.roles[1]]
    ]))
    const reason = snapshot.ongoing ? 'Termina el encargo activo.' :
      !snapshot.atBase ? 'Acércate al tablón del cuartel.' : !crewOnline ? 'Conectaos los dos.' : ''
    if (reason) brief.append(element('p', reason, 'availability'))
    const controls = element('div', '', 'objective-actions')
    controls.append(action('Preparar salida', 'start', selectedOperation, !reason),
      button('Ver todas', () => { selectedOperation = undefined; render() }))
    brief.append(controls)
    content.append(brief)
    return
  }
  for (const key of Duo.operations) {
    const contract = Duo.contracts[key]
    const done = snapshot.operations?.includes(key)
    const details = button('Ver ficha', () => { selectedOperation = key; render() })
    details.dataset.focus = 'operation:' + key
    const article = card(done ? 'Completada · Dúo' : 'Operación · Dúo', contract.name, Duo.briefs[key][1],
      money(contract.pay) + ' por jugador', details, !!done)
    const roles = element('p', contract.roles.join(' · '), 'operation-roles')
    article.insertBefore(roles, article.lastChild)
  }
}

function utilityPanel() {
  const section = element('section', '', 'utility-panel')
  if (tab === 'settings') {
    window.DuoHud.mountSettings(section)
  } else {
    window.DuoWelcome.mount(section, {
      onLocate: () => call('accion', { operation: 'locateHQ' }),
      onDismiss: () => { welcomePending = false; selectSection('hq') }
    })
  }
  content.append(section)
}

function render() {
  if (!snapshot) return
  const focus = document.activeElement?.dataset.focus
  document.getElementById('cash').textContent = snapshot.cash == null ? 'Perfil sin cargar' : money(snapshot.cash)
  document.getElementById('completed').textContent = snapshot.completed + ' completados'
  document.getElementById('section-title').textContent = tabs.querySelector('[aria-pressed="true"]')?.textContent || 'Cuartel general'
  resume.hidden = tab === 'hq' || !snapshot.mission
  document.getElementById('best').textContent = snapshot.bestRally
    ? 'Vinewood · ' + (snapshot.bestRally / 1000).toFixed(1) + ' s' : ''
  bar.replaceChildren()
  overview.replaceChildren()
  content.replaceChildren()
  content.classList.remove('chapter-missions', 'missions-2', 'missions-3')
  stories.hidden = true
  stories.replaceChildren()
  chapters.hidden = true
  chapters.replaceChildren()
  objectives.hidden = true
  objectives.replaceChildren()
  const goals = (snapshot.objectives || []).filter(goal => typeof goal === 'string' && goal).slice(0, 2)
  const routes = snapshot.routeOptions || []
  if (tab === 'hq' && snapshot.member && (goals.length || snapshot.dialogue || routes.length || snapshot.retryAvailable || snapshot.routeLabel)) {
    objectives.append(element('h2', 'Objetivos en curso'))
    if (goals.length) {
      const list = element('ul')
      for (const goal of goals) list.append(element('li', goal))
      objectives.append(list)
    }
    if (snapshot.dialogue) objectives.append(element('p', snapshot.dialogue, 'mission-dialogue'))
    if (snapshot.routeLabel) objectives.append(element('p', 'Ruta actual · ' + snapshot.routeLabel, 'mission-dialogue'))
    if (routes.length || snapshot.retryAvailable) {
      const actions = element('div', '', 'objective-actions')
      for (const route of routes) actions.append(action(route.text, 'chooseRoute', route.index, true))
      if (snapshot.retryAvailable) actions.append(action('Reintentar desde el punto de control', 'retry', undefined, true, false))
      objectives.append(actions)
    }
    objectives.hidden = false
  }
  if (tab === 'hq') headquarters()
  if (tab === 'operations') operations()
  if (tab === 'campaign') campaign()
  if (tab === 'contracts') contracts()
  if (tab === 'garage') garage()
  if (tab === 'hangar') garage(true)
  if (tab === 'shop') shop()
  if (tab === 'world') world()
  if (tab === 'settings' || tab === 'help') utilityPanel()
  if (focus) {
    const control = Array.from(app.querySelectorAll('[data-focus]'))
      .find(candidate => !candidate.disabled && candidate.dataset.focus === focus)
    const destination = control || tabs.querySelector('[aria-pressed="true"]')
    destination?.focus({ preventScroll: true })
  }
}

tabs.addEventListener('click', event => {
  if (!event.target.dataset.tab) return
  selectSection(event.target.dataset.tab)
})
tabs.addEventListener('keydown', event => {
  const buttons = Array.from(tabs.querySelectorAll('button[data-tab]'))
  const index = buttons.indexOf(event.target)
  if (index < 0) return
  const offset = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
  const target = event.key === 'Home' ? buttons[0] : event.key === 'End' ? buttons.at(-1) :
    offset ? buttons[(index + offset + buttons.length) % buttons.length] : null
  if (!target) return
  event.preventDefault()
  selectSection(target.dataset.tab)
  target.focus()
})
resume.addEventListener('click', () => selectSection('hq'))
setInterval(() => { if (!app.hidden) updateClock() }, 250)

document.getElementById('close').addEventListener('click', () => call('cierra'))
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return
  if (checkout.open) return
  if (standalone && app.hidden) setPreviewView?.('menu')
  else if (!app.hidden) call('cierra')
})

window.addEventListener('message', event => {
  const data = event.data
  if (data?.type === 'visible') {
    if (!data.visible && checkout.open) checkout.close()
    app.hidden = !data.visible
    if (data.visible) {
      selectSection(data.section || 'hq')
      status.textContent = 'Consultando la central…'
      tabs.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true })
    }
  }
  if (data?.type === 'snapshot') {
    const firstJoin = data.snapshot.member && !snapshot?.member
    snapshot = data.snapshot
    timerEnds = Date.now() + (snapshot.mission?.remaining || 0) * 1000
    if (status.textContent === 'Consultando la central…') status.textContent = ''
    if (!app.hidden && firstJoin) selectSection('hq')
    else render()
  }
  if (data?.type === 'crew' && snapshot) {
    snapshot.crew = data.count
    if (tab === 'operations' || tab === 'hq') render()
  }
  if (data?.type === 'notice') status.textContent = data.text
  if (data?.type === 'hud:visibility' && data.visible && !standalone && !welcomeOffered) {
    welcomeOffered = true
    if (!window.DuoWelcome.hasDismissed()) {
      welcomePending = true
      window.dispatchEvent(new MessageEvent('message', {
        data: { type: 'hud:toast', text: '¿Primera partida? Abre F6 → Ayuda para ver la guía.' }
      }))
    }
  }
})

if (standalone) {
  app.hidden = false
  status.textContent = 'Vista previa local'
  const query = new URLSearchParams(location.search)
  const phases = {
    idle: 'Cuartel sin operación', invite: 'Invitación', briefing: 'Preparación',
    field: 'Balizas en curso', reconnect: 'Reconexión', return: 'Regreso al cuartel', paid: 'Liquidación'
  }
  const controls = element('div', '', 'preview-controls')
  const phaseSelect = document.createElement('select')
  const playerSelect = document.createElement('select')
  const viewSelect = document.createElement('select')
  const safeSelect = document.createElement('select')
  const previewRibbon = element('aside', '', 'preview-ribbon')
  previewRibbon.hidden = true
  document.body.append(previewRibbon)
  phaseSelect.setAttribute('aria-label', 'Estado de la vista previa')
  playerSelect.setAttribute('aria-label', 'Jugador de la vista previa')
  viewSelect.setAttribute('aria-label', 'Vista de interfaz')
  safeSelect.setAttribute('aria-label', 'Zona segura')
  for (const [key, title] of Object.entries(phases)) phaseSelect.add(new Option(title, key))
  playerSelect.add(new Option('Jugador 1', '1'))
  playerSelect.add(new Option('Jugador 2', '2'))
  const views = { menu: 'Menú F6', foot: 'HUD a pie', road: 'HUD en coche', air: 'HUD en avión' }
  for (const [key, title] of Object.entries(views)) viewSelect.add(new Option(title, key))
  safeSelect.add(new Option('Zona segura máx.', '1'))
  safeSelect.add(new Option('Zona segura mín.', '0.9'))
  phaseSelect.value = Object.hasOwn(phases, query.get('fase')) ? query.get('fase') : 'idle'
  playerSelect.value = query.get('jugador') === '2' ? '2' : '1'
  viewSelect.value = Object.hasOwn(views, query.get('vista')) ? query.get('vista') : 'menu'
  safeSelect.value = query.get('zona') === 'min' ? '0.9' : '1'
  controls.append(phaseSelect, playerSelect, viewSelect, safeSelect)
  status.after(controls)
  const exampleChapter = Duo.story2?.start ?? 1
  const exampleProgress = Duo.chapters?.slice(0, exampleChapter).flatMap(chapter => chapter.missions) || []

  function preview() {
    const phase = phaseSelect.value
    const player = Number(playerSelect.value)
    const first = player === 1
    const active = phase !== 'idle' && phase !== 'paid'
    const briefing = phase === 'briefing' || phase === 'invite'
    const stage = briefing ? 'briefing' : phase
    const contract = Duo.contracts.doble_baliza
    const crew = contract.roles.map((role, index) => {
      const status = phase === 'invite' ? (index ? 'vacant' : 'pending') :
        phase === 'reconnect' && index === 1 ? 'away' : briefing ? (index ? 'pending' : 'ready') :
        phase === 'field' ? (index ? 'pending' : 'confirmed') : 'active'
      return { name: index ? 'Nico' : 'Mara', role, status,
        self: index === player - 1 && status !== 'vacant' && status !== 'away' }
    })
    snapshot = {
      cash: phase === 'paid' ? 11150 : 9250, completed: exampleProgress.length + Number(phase === 'paid'),
      cars: { blista: 'grafito', sultan: 'petroleo', mammatus: 'cobre' },
      weapons: ['pistolacombate'], food: { bocadillo: 2 }, crew: phase === 'reconnect' ? 1 : 2,
      operations: phase === 'paid' ? ['doble_baliza'] : [],
      bestRally: 58500, activeCar: 'sultan', lostAircraft: 'mammatus', featured: 'nocturno',
      campaign: exampleProgress, unlockedChapter: exampleChapter,
      atBase: true, atGarage: true, atShop: true, atHangar: false,
      fleet: { garage: { free: 1, parkHint: 'Devuelve el vehículo a su estacionamiento.' }, hangar: { free: 2 } },
      garageBays: [true, false],
      ongoing: active ? contract.name : null,
      member: active && (phase !== 'invite' || first) && (phase !== 'reconnect' || first),
      canJoin: phase === 'invite' && !first,
      mission: active ? { name: contract.name, stage, area: contract.area, vehicle: contract.vehicleName, pay: contract.pay,
        step: briefing ? 1 : phase === 'return' ? 5 : 3, total: 5, crew } : null,
      operation: active && briefing ? { id: 'preview', step: 0, count: phase === 'invite' ? 1 : 2, briefing: true,
        confirmed: phase === 'invite' ? 0 : 1, canBrief: phase === 'briefing' && !first } : null,
      objectives: phase === 'field' ? [first ? 'Tu baliza está confirmada. Espera al compañero.' : 'Confirma la baliza del almacén.'] :
        phase === 'reconnect' ? ['La operación continuará cuando vuelva tu compañero.'] :
        phase === 'return' ? ['Volved los dos al cuartel para cerrar el encargo.'] : [],
      settlement: phase === 'paid' ? { name: contract.name, amount: contract.pay, completed: exampleProgress.length + 1,
        progress: 'Operación registrada' } : null,
      cache: { label: 'Vespucci', hint: 'Junto al paseo que bordea los canales.', claimed: false },
      world: { key: 'auxilio_mirror', name: 'Auxilio en Mirror Park', kind: 'Auxilio', zone: 'Mirror Park',
        brief: 'Ayuda a un conductor con una avería y acompáñalo hasta el punto de recogida.', pay: 480, canStart: !active }
    }
    const mode = viewSelect.value
    const showHud = mode !== 'menu'
    const remaining = phase === 'field' ? 18 : 0
    timerEnds = Date.now() + remaining * 1000
    app.hidden = showHud
    previewRibbon.hidden = !showHud
    document.body.classList.toggle('preview-hud', showHud)
    if (showHud) previewRibbon.append(controls)
    else status.after(controls)
    safeSelect.hidden = !showHud
    const flight = mode === 'air'
    window.DuoHud.preview({
      visible: showHud,
      telemetry: { mode, safeZone: Number(safeSelect.value), health: 78, armor: 46,
        ammo: mode === 'foot' ? 60 : null, clip: mode === 'foot' ? 12 : null,
        speed: flight ? 189 : 84, gear: flight ? null : 4, damaged: mode === 'road', altitude: 223 },
      mission: flight ? { name: 'Cartografía del Álamo', objective: 'Cruza el control sobre el lago.',
        checkpoint: 'Punto de observación norte', remaining: 0 } :
        active ? { name: contract.name, objective: snapshot.objectives[0] || 'Confirma la salida desde el cuartel.',
          detail: phase === 'field' ? (first ? 'Tu baliza confirmada · Compañero pendiente' : 'Tu baliza pendiente · Compañero confirmado') :
            phase === 'reconnect' ? 'Tu compañero tiene cinco minutos para volver.' : '', remaining } : null,
      prompt: phase === 'field' && !first && mode === 'foot' ? { key: 'E', text: 'Confirmar baliza del almacén' } : null
    })
    status.textContent = 'Vista previa local'
    render()
  }
  phaseSelect.addEventListener('change', preview)
  playerSelect.addEventListener('change', preview)
  viewSelect.addEventListener('change', preview)
  safeSelect.addEventListener('change', preview)
  setPreviewView = view => { viewSelect.value = view; preview() }
  selectSection(location.hash.slice(1) || 'hq')
  preview()
}
