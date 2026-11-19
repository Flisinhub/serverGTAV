const app = document.getElementById('app')
const content = document.getElementById('content')
const bar = document.getElementById('bar')
const objectives = document.getElementById('objectives')
const stories = document.getElementById('stories')
const chapters = document.getElementById('chapters')
const status = document.getElementById('status')
const tabs = document.getElementById('tabs')
const money = value => '$' + new Intl.NumberFormat('es-ES').format(value)
const standalone = typeof GetParentResourceName !== 'function'
let tab = 'campaign'
let filter = 'Todos'
let snapshot
let selectedStory
const selectedChapters = new Map()
const expandedMissions = new Set()

function element(tag, text = '', classes = '') {
  const node = document.createElement(tag)
  node.textContent = text
  node.className = classes
  return node
}

async function call(endpoint, data = {}) {
  if (standalone) {
    if (endpoint === 'cierra') app.hidden = true
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
  const control = button(title, () => call('accion', { operation, value }), enabled, primary)
  control.dataset.focus = operation + ':' + JSON.stringify(value)
  return control
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
  for (const kind of ['Todos', 'Trabajo', 'Banda', 'Contrarreloj']) {
    const option = button(kind, () => { filter = kind; render() })
    option.dataset.focus = 'filter-' + kind
    option.setAttribute('aria-pressed', String(kind === filter))
    filters.append(option)
  }
  bar.append(filters)
  contractControls()
  const story = new Set((Duo.chapters || []).flatMap(chapter => chapter.missions))
  const available = Object.entries(Duo.contracts).filter(([key]) => !story.has(key))
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

function garage() {
  const label = snapshot.atGarage ? 'Pintura gratuita' : 'Acércate al garaje para comprar o sacar un coche.'
  bar.append(element('span', label))
  if (snapshot.activeCar) {
    const controls = element('div', '', 'garage-controls')
    controls.append(action('Localizar coche', 'locateCar', null, true),
      action('Guardar coche', 'park', null, snapshot.atGarage, false))
    bar.append(controls)
  }
  for (const [key, car] of Object.entries(Duo.cars)) {
    const owned = Object.hasOwn(snapshot.cars, key)
    const active = snapshot.activeCar === key
    const lost = snapshot.lostCar === key
    let control
    if (active) control = element('span', 'En la calle', 'vehicle-status')
    else if (lost) control = action('Recuperar', 'recoverCar', key, snapshot.atGarage && !snapshot.activeCar)
    else if (owned) control = action('Sacar', 'pull', key, snapshot.atGarage && !snapshot.activeCar && !snapshot.lostCar)
    else control = action('Comprar', 'buyCar', key, snapshot.atGarage && snapshot.cash >= car.price)
    const detail = active ? 'Vehículo activo' : lost ? 'Destruido · Recupéralo en el garaje'
      : owned ? 'En propiedad' : 'Disponible en el garaje'
    const article = card(car.kind, car.name, detail,
      owned ? 'En propiedad' : money(car.price), control)
    if (!owned) continue
    const swatches = element('div', '', 'swatches')
    for (const [paint, color] of Object.entries(Duo.paints)) {
      const locked = color.requires === 'story2' && !snapshot.story2Reward
      const option = action('', 'paint', { model: key, paint }, snapshot.atGarage && !locked, false)
      option.style.setProperty('--swatch', color.swatch)
      option.title = locked ? color.name + ' · Completa Frecuencia fantasma' : color.name
      option.setAttribute('aria-label', option.title)
      option.setAttribute('aria-pressed', String(snapshot.cars[key] === paint))
      swatches.append(option)
    }
    article.insertBefore(swatches, article.lastChild)
  }
}

function shop() {
  if (!snapshot.atShop) bar.append(element('span', 'Acércate al marcador verde de suministros.'))
  for (const [key, title, detail, cost] of [
    ['blindaje', 'Chaleco', 'Repone el blindaje al máximo.', 180],
    ['botiquin', 'Botiquín', 'Recupera toda la salud al comprarlo.', 140],
    ['carabina', 'Carabina', 'Incluye 180 cartuchos para la partida.', 850]
  ]) {
    card('Suministros', title, detail, money(cost), action('Comprar', 'buy', key, snapshot.atShop && snapshot.cash >= cost))
  }
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

function render() {
  if (!snapshot) return
  const focus = document.activeElement?.dataset.focus
  document.getElementById('cash').textContent = snapshot.cash == null ? 'Perfil sin cargar' : money(snapshot.cash)
  document.getElementById('completed').textContent = snapshot.completed + ' completados'
  document.getElementById('headline').textContent = snapshot.ongoing
    ? ['En curso', snapshot.ongoing, snapshot.phase].filter(Boolean).join(' · ')
    : 'Campaña cooperativa y mundo libre'
  document.getElementById('best').textContent = snapshot.bestRally
    ? 'Vinewood · ' + (snapshot.bestRally / 1000).toFixed(1) + ' s' : ''
  bar.replaceChildren()
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
  if (snapshot.ongoing && (goals.length || snapshot.dialogue || routes.length || snapshot.retryAvailable || snapshot.routeLabel)) {
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
  if (tab === 'campaign') campaign()
  if (tab === 'contracts') contracts()
  if (tab === 'garage') garage()
  if (tab === 'shop') shop()
  if (tab === 'world') world()
  if (focus) {
    const control = Array.from(app.querySelectorAll('[data-focus]'))
      .find(candidate => !candidate.disabled && candidate.dataset.focus === focus)
    const destination = control || tabs.querySelector('[aria-pressed="true"]')
    destination?.focus({ preventScroll: true })
  }
}

tabs.addEventListener('click', event => {
  if (!event.target.dataset.tab) return
  tab = event.target.dataset.tab
  for (const control of tabs.children) control.setAttribute('aria-pressed', String(control === event.target))
  document.getElementById('viewport').scrollTop = 0
  render()
})

document.getElementById('close').addEventListener('click', () => call('cierra'))
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !app.hidden) call('cierra')
})

window.addEventListener('message', event => {
  const data = event.data
  if (data?.type === 'visible') {
    app.hidden = !data.visible
    if (data.visible) {
      status.textContent = 'Consultando la central…'
      tabs.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true })
    }
  }
  if (data?.type === 'snapshot') {
    snapshot = data.snapshot
    if (status.textContent === 'Consultando la central…') status.textContent = ''
    render()
  }
  if (data?.type === 'notice') status.textContent = data.text
})

if (standalone) {
  app.hidden = false
  status.textContent = 'Vista previa local'
  const exampleChapter = Duo.story2?.start ?? 1
  const exampleProgress = Duo.chapters?.slice(0, exampleChapter).flatMap(chapter => chapter.missions) || []
  snapshot = {
    cash: 3250, completed: exampleProgress.length, cars: { blista: 'grafito', sultan: 'petroleo' },
    bestRally: 58500, activeCar: 'sultan', lostCar: null, featured: 'nocturno',
    campaign: exampleProgress, unlockedChapter: exampleChapter, objectives: [],
    atBase: true, atGarage: true, atShop: true, ongoing: null,
    cache: { label: 'Vespucci', hint: 'Junto al paseo que bordea los canales.', claimed: false },
    world: { key: 'auxilio_mirror', name: 'Auxilio en Mirror Park', kind: 'Auxilio', zone: 'Mirror Park',
      brief: 'Ayuda a un conductor con una avería y acompáñalo hasta el punto de recogida.', pay: 480, canStart: true }
  }
  render()
}

