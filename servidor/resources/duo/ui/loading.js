(() => {
  const progress = document.getElementById('entry-progress')
  const percent = document.getElementById('entry-percent')
  const status = document.getElementById('entry-status')

  window.addEventListener('message', ({ data }) => {
    if (data?.eventName !== 'loadProgress' || !Number.isFinite(data.loadFraction)) return
    const fraction = Math.max(0, Math.min(1, data.loadFraction))
    progress.value = fraction
    const displayPercent = fraction === 1 ? 100 : Math.min(99, Math.round(fraction * 100))
    percent.textContent = displayPercent + ' %'
    const phase = fraction === 1 ? 'Entrando en Los Santos…' : 'Cargando la sesión'
    if (status.textContent !== phase) status.textContent = phase
  })
})()
