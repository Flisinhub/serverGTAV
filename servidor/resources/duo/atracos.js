// El catálogo es compartido con la NUI. Las combinaciones se generan solo en el servidor.
Duo.heists = ['caja_cierre', 'camara_ecos', 'proyecto_eclipse']
Duo.eclipse = {
  pad: [-2346.9, 3268.4, 32.8, 150],
  handler: [-2225.1, 3131.5, 32.8, 45],
  cargo: [[-2221, 3142, 32.8], [-2230, 3150, 32.8], [-2239, 3158, 32.8]],
  landing: [-1112.4, -2883.6, 13.95]
}
const heistBriefing = { at: Duo.base, text: 'Confirmad el atraco en el tablón de Pillbox', briefing: true }
const heistJobs = [
  { key: 'caja_cierre', name: 'Caja de cierre', area: 'Strawberry', category: 'Tienda', minutes: '5–8',
    roles: ['Mano del dial', 'Lectura de símbolos'], vehicle: 'speedo', vehicleName: 'Vapid Speedo',
    sites: [[25.7,-1345.5,29.5],[30.4,-1339.8,29.5]], pay: 1350, extra: 650,
    intro: 'Un dial y una tira de símbolos. Uno gira el dial y el otro dicta la secuencia. Podéis asegurar la primera caja o abrir un segundo compartimento.' },
  { key: 'camara_ecos', name: 'Cámara de ecos', area: 'Pacific Standard', category: 'Banco', minutes: '12–18',
    roles: ['Terminal Ámbar', 'Terminal Lima'], vehicle: 'granger', vehicleName: 'Declasse Granger',
    sites: [[242.1,225.2,106.3],[255.8,217.2,106.3]], pay: 2700, extra: 1250,
    intro: 'Cada sala tiene media matriz. Lee la pista de tu compañero y pulsa el símbolo en tu tablero. Cada pulso cambia las casillas del otro lado.' },
  { key: 'proyecto_eclipse', name: 'Proyecto Eclipse', area: 'Fort Zancudo', category: 'Base militar', minutes: '18–25',
    roles: ['Piloto del Cargobob', 'Operador de grúa'], vehicle: 'cargobob', vehicleName: 'Cargobob y HVY Handler',
    sites: [Duo.eclipse.pad,Duo.eclipse.handler], pay: 4200, extra: 0,
    intro: 'La tripulación aérea ve emblemas. En tierra, la grúa lee identificadores. Cruzad las dos lecturas para enganchar el prototipo y entregarlo juntos en el aeropuerto.' }
]
for (const job of heistJobs) {
  Duo.contracts[job.key] = { ...job, heist: true, duoOnly: true, type: job.key === 'proyecto_eclipse' ? 'heli' : 'automobile',
    stops: [heistBriefing, { at: job.sites[0], text: 'Ocupa tu puesto y abre la consola de F6' }] }
  Duo.briefs[job.key] = ['Atraco',job.intro]
}
