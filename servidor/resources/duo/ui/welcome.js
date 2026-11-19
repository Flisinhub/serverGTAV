window.DuoWelcome = (() => {
  const storageKey = 'los-santos-a-dos.welcome.dismissed'
  let dismissed = false

  function hasDismissed() {
    try {
      return dismissed || localStorage.getItem(storageKey) === '1'
    } catch {
      return dismissed
    }
  }

  function dismiss() {
    dismissed = true
    try {
      localStorage.setItem(storageKey, '1')
    } catch {
      // Availability of persistent storage depends on the client.
    }
  }

  function node(tag, text) {
    const element = document.createElement(tag)
    if (text) element.textContent = text
    return element
  }

  function mount(container, { onDismiss, onLocate, menuKey = 'F6', offer = false } = {}) {
    if (offer && hasDismissed()) return null

    const guide = node('section')
    guide.className = 'welcome-guide'
    const heading = node('header')
    heading.append(node('h2', 'Bienvenido a Los Santos a Dos'),
      node('p', 'Tres pasos para preparar vuestra primera salida.'))
    const steps = node('ol')
    const entries = [
      ['Abre la central', 'Pulsa ' + menuKey + ' para abrir el menú del equipo.'],
      ['Ve al cuartel general', 'Busca la central en el mapa. Allí están el tablón de encargos y la mesa de operaciones.'],
      ['Únete a tu compañero', 'Cuando tu compañero prepare un encargo, abre el cuartel en el menú y elige «Unirse al contrato».']
    ]
    for (const [index, [title, description]] of entries.entries()) {
      const step = node('li')
      step.append(node('h3', title), node('p', description))
      if (index === 1 && onLocate) {
        const locate = node('button', 'Marcar cuartel')
        locate.type = 'button'
        locate.addEventListener('click', onLocate)
        step.append(locate)
      }
      steps.append(step)
    }

    const actions = node('div')
    actions.className = 'welcome-actions'
    const close = node('button', 'Entendido')
    close.type = 'button'
    close.className = 'primary'
    close.addEventListener('click', () => {
      dismiss()
      if (onDismiss) onDismiss()
      else guide.remove()
    })
    actions.append(close)
    guide.append(heading, steps, actions)
    container.append(guide)
    return guide
  }

  return { mount, hasDismissed, dismiss }
})()
