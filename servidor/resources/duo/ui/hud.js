(() => {
  'use strict'

  const defaults = { mode: 'full', scale: 100, contrast: false, reducedMotion: false }
  const preferenceKey = 'duo.hud.preferences'
  let settings = { ...defaults }
  try {
    const saved = JSON.parse(localStorage.getItem(preferenceKey))
    if (saved) {
      settings = {
        mode: saved.mode === 'compact' ? 'compact' : 'full',
        scale: Number.isFinite(saved.scale) ? Math.min(120, Math.max(85, saved.scale)) : defaults.scale,
        contrast: saved.contrast === true,
        reducedMotion: saved.reducedMotion === true
      }
    }
  } catch {}

  const root = document.createElement('aside')
  root.id = 'duo-hud'
  root.hidden = true
  root.setAttribute('aria-label', 'HUD táctico')
  root.innerHTML = `
    <section class="duo-hud-panel duo-hud-mission" hidden aria-label="Misión activa">
      <div class="duo-hud-mission-header">
        <h2 data-hud="mission-name"></h2>
        <time class="duo-hud-clock" data-hud="clock" aria-label="Tiempo restante" hidden></time>
      </div>
      <p class="duo-hud-objective" data-hud="objective"></p>
      <p class="duo-hud-team" data-hud="detail" hidden></p>
    </section>
    <section class="duo-hud-cluster" hidden aria-label="Estado y munición">
      <div class="duo-hud-panel duo-hud-vitals">
        <div class="duo-hud-stat duo-hud-health">
          <span>Salud</span><strong data-hud="health"></strong>
          <div class="duo-hud-meter" data-hud="health-meter" role="progressbar" aria-label="Salud" aria-valuemin="0" aria-valuemax="100"></div>
        </div>
        <div class="duo-hud-stat">
          <span>Blindaje</span><strong data-hud="armor"></strong>
          <div class="duo-hud-meter" data-hud="armor-meter" role="progressbar" aria-label="Blindaje" aria-valuemin="0" aria-valuemax="100"></div>
        </div>
      </div>
      <div class="duo-hud-panel duo-hud-ammo" data-hud="ammo-panel" hidden aria-label="Munición">
        <span>Munición</span>
        <strong data-hud="clip"></strong><span data-hud="ammo"></span>
      </div>
    </section>
    <section class="duo-hud-panel duo-hud-vehicle" hidden aria-label="Instrumentación">
      <div class="duo-hud-instruments">
        <div class="duo-hud-speed"><strong data-hud="speed"></strong><span>km/h</span></div>
        <div class="duo-hud-instrument" data-hud="gear-panel" hidden>
          <span>Marcha</span><strong data-hud="gear"></strong>
        </div>
        <div class="duo-hud-instrument" data-hud="altitude-panel" hidden>
          <span>Altitud</span><strong data-hud="altitude"></strong>
        </div>
      </div>
      <p class="duo-hud-checkpoint" data-hud="checkpoint" hidden></p>
      <p class="duo-hud-damage" data-hud="damage" hidden>Vehículo dañado</p>
    </section>
    <p class="duo-hud-panel duo-hud-prompt" hidden><kbd data-hud="key"></kbd><span data-hud="prompt"></span></p>
    <div class="duo-hud-toast-wrap" role="status"><p class="duo-hud-panel duo-hud-toast" hidden></p></div>
  `
  document.body.prepend(root)

  const missionPanel = root.querySelector('.duo-hud-mission')
  const cluster = root.querySelector('.duo-hud-cluster')
  const vehiclePanel = root.querySelector('.duo-hud-vehicle')
  const promptPanel = root.querySelector('.duo-hud-prompt')
  const toast = root.querySelector('.duo-hud-toast')
  const fields = Object.fromEntries(Array.from(root.querySelectorAll('[data-hud]'), node => [node.dataset.hud, node]))
  const clockFormatter = new Intl.NumberFormat('es-ES', { minimumIntegerDigits: 2, useGrouping: false })
  const readNumber = value => typeof value === 'number' && Number.isFinite(value)
  let timerEnds = 0
  let mode = 'foot'
  let checkpoint = ''
  let toastTimer = 0
  const toastQueue = []

  function write(node, value) {
    const text = String(value)
    if (node.textContent !== text) node.textContent = text
  }

  function showText(node, value) {
    const text = typeof value === 'string' ? value.trim() : ''
    node.hidden = text === ''
    write(node, text)
  }

  function applySettings() {
    root.dataset.mode = settings.mode
    root.classList.toggle('duo-hud-contrast', settings.contrast)
    root.classList.toggle('duo-hud-static', settings.reducedMotion)
    root.style.setProperty('--duo-hud-scale', String(settings.scale / 100))
  }

  function saveSettings(changes) {
    settings = { ...settings, ...changes }
    try { localStorage.setItem(preferenceKey, JSON.stringify(settings)) } catch {}
    applySettings()
  }

  function mountSettings(container) {
    const form = document.createElement('fieldset')
    form.className = 'hud-settings'
    const legend = document.createElement('legend')
    legend.textContent = 'HUD táctico'
    form.append(legend)

    function addField(label, control) {
      const row = document.createElement('label')
      row.append(label, control)
      form.append(row)
      return row
    }

    const density = document.createElement('select')
    density.add(new Option('Completo', 'full'))
    density.add(new Option('Compacto', 'compact'))
    density.value = settings.mode
    density.addEventListener('change', () => saveSettings({ mode: density.value }))
    addField('Modo de HUD', density)

    const scale = document.createElement('input')
    const scaleValue = document.createElement('output')
    scale.type = 'range'
    scale.min = '85'
    scale.max = '120'
    scale.step = '5'
    scale.value = settings.scale
    scaleValue.textContent = settings.scale + '%'
    scale.addEventListener('input', () => {
      scaleValue.textContent = scale.value + '%'
      saveSettings({ scale: Number(scale.value) })
    })
    addField('Escala del HUD', scale).append(scaleValue)

    function toggle(label, key) {
      const input = document.createElement('input')
      input.type = 'checkbox'
      input.checked = settings[key]
      input.addEventListener('change', () => saveSettings({ [key]: input.checked }))
      addField(label, input)
      return input
    }

    const contrast = toggle('Contraste alto', 'contrast')
    const motion = toggle('Movimiento reducido', 'reducedMotion')
    const reset = document.createElement('button')
    reset.type = 'button'
    reset.textContent = 'Restablecer HUD'
    reset.addEventListener('click', () => {
      saveSettings(defaults)
      density.value = settings.mode
      scale.value = settings.scale
      scaleValue.textContent = settings.scale + '%'
      contrast.checked = settings.contrast
      motion.checked = settings.reducedMotion
    })
    form.append(reset)
    container.append(form)
    return form
  }

  function updateMeter(name, value) {
    const number = Math.min(100, Math.max(0, Math.round(readNumber(value) ? value : 0)))
    const meter = fields[name + '-meter']
    write(fields[name], number)
    if (meter.getAttribute('aria-valuenow') !== String(number)) {
      meter.setAttribute('aria-valuenow', number)
      meter.style.setProperty('--duo-hud-level', number + '%')
    }
    if (name === 'health') cluster.classList.toggle('duo-hud-injury', number <= 25)
  }

  function updateCheckpoint() {
    showText(fields.checkpoint, mode === 'air' && checkpoint !== fields.objective.textContent ? checkpoint : '')
  }

  function updateTelemetry(data) {
    if (!data) {
      cluster.hidden = vehiclePanel.hidden = true
      return
    }
    mode = ['road', 'air'].includes(data.mode) ? data.mode : 'foot'
    const safeZone = readNumber(data.safeZone) ? Math.min(1, Math.max(0.9, data.safeZone)) : 1
    root.style.setProperty('--duo-hud-inset', ((1 - safeZone) * 50).toFixed(2))
    cluster.hidden = false
    updateMeter('health', data.health)
    updateMeter('armor', data.armor)
    fields['ammo-panel'].hidden = !readNumber(data.clip) && !readNumber(data.ammo)
    fields.clip.hidden = !readNumber(data.clip)
    fields.ammo.hidden = !readNumber(data.ammo)
    write(fields.clip, Math.max(0, Math.round(data.clip || 0)))
    write(fields.ammo, (readNumber(data.clip) ? ' / ' : '') + Math.max(0, Math.round(data.ammo || 0)))

    vehiclePanel.hidden = mode === 'foot'
    if (vehiclePanel.hidden) return
    write(fields.speed, Math.max(0, Math.round(data.speed || 0)))
    fields['gear-panel'].hidden = mode !== 'road' || !readNumber(data.gear)
    write(fields.gear, data.gear < 0 ? 'R' : data.gear === 0 ? 'N' : data.gear)
    fields['altitude-panel'].hidden = mode !== 'air' || !readNumber(data.altitude)
    write(fields.altitude, Math.round(data.altitude || 0) + ' m')
    fields.damage.hidden = !data.damaged
    updateCheckpoint()
  }

  function updateClock() {
    const seconds = Math.max(0, Math.ceil((timerEnds - performance.now()) / 1000))
    fields.clock.hidden = !timerEnds
    if (!fields.clock.hidden) write(fields.clock, Math.floor(seconds / 60) + ':' + clockFormatter.format(seconds % 60))
  }

  function updateMission(data) {
    missionPanel.hidden = !data?.name
    checkpoint = data?.checkpoint || ''
    timerEnds = data?.remaining > 0 ? performance.now() + data.remaining * 1000 : 0
    if (!missionPanel.hidden) {
      write(fields['mission-name'], data.name)
      showText(fields.objective, data.objective)
      showText(fields.detail, data.detail)
      updateClock()
    }
    updateCheckpoint()
  }

  function updatePrompt(text, key) {
    promptPanel.hidden = !text
    if (!promptPanel.hidden) {
      write(fields.prompt, text)
      showText(fields.key, key)
    }
  }

  function nextToast() {
    toast.hidden = true
    const text = toastQueue.shift()
    if (!text) {
      toastTimer = 0
      write(toast, '')
      return
    }
    write(toast, text)
    toast.hidden = false
    toastTimer = window.setTimeout(nextToast, 3600)
  }

  function pushToast(text) {
    if (typeof text !== 'string' || !text.trim() || toastQueue.includes(text) || toast.textContent === text) return
    if (toastQueue.length >= 3) toastQueue.shift()
    toastQueue.push(text)
    if (!toastTimer) nextToast()
  }

  const resource = typeof GetParentResourceName === 'function' ? GetParentResourceName() : ''
  async function ping(endpoint) {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 2000)
    try {
      const response = await fetch('https://' + resource + '/' + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: controller.signal
      })
      return response.ok && (await response.json()).ok !== false
    } catch {
      return false
    } finally {
      clearTimeout(timeout)
    }
  }

  window.addEventListener('message', ({ data }) => {
    switch (data?.type) {
      case 'hud:visibility':
        root.hidden = !data.visible
        if (root.hidden) updatePrompt()
        break
      case 'hud:telemetry': updateTelemetry(data.data); break
      case 'hud:mission': updateMission(data.data); break
      case 'hud:prompt': updatePrompt(data.text, data.key); break
      case 'hud:toast': pushToast(data.text); break
    }
  })
  window.setInterval(() => { if (!root.hidden && timerEnds) updateClock() }, 125)
  applySettings()

  if (resource) {
    let ready = false
    let pending = false
    async function announce() {
      if (pending) return
      pending = true
      ready = await ping(ready ? 'hudHeartbeat' : 'hudReady')
      pending = false
    }
    announce()
    window.setInterval(announce, 3000)
  }

  window.DuoHud = {
    mountSettings,
    preview({ telemetry, mission, prompt, toast: message, visible = true } = {}) {
      if (resource) return
      root.hidden = !visible
      updateTelemetry(telemetry)
      updateMission(mission)
      updatePrompt(prompt?.text, prompt?.key)
      if (message) pushToast(message)
    }
  }
})()
