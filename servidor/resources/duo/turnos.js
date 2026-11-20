const shiftBriefing = { at: Duo.base, text: 'Confirma tu salida en el tablón', briefing: true }
Duo.pickups = [
  { text: 'Mercado de Davis', at: [115.6, -1941.9, 20.7], closes: 300, boxes: 2 },
  { text: 'Frutería de Vespucci', at: [-1214.8, -895.2, 12.6], closes: 480, boxes: 1 },
  { text: 'Recambios de La Mesa', at: [819.5, -1039.4, 26.6], closes: 660, boxes: 3 }
]
Duo.davis = [
  { text: 'June · Avería en Davis', at: [107.4, -1941.5, 20.8], follow: 'June os reconoce. Recoged un recambio en Strawberry.', next: [73.3,-1560.1,29.5], end: [820.5, -1040.2, 26.6] },
  { text: 'Luis · Tienda sin suministros', at: [-47.1, -1757.3, 29.4], follow: 'Luis os guarda un pedido. Recoged las cajas de su proveedor en La Mesa.', next: [819.5,-1039.4,26.6], end: [73.3, -1560.1, 29.5] },
  { text: 'Rosa · Traslado pendiente', at: [-118.8, -1574.5, 34.2], follow: 'Rosa vuelve a contar con vosotros. Llevadla a su nuevo trabajo en Vespucci.', next: [-1214.8,-895.2,12.6], end: [302.4, -585.6, 43.3] }
]
Duo.sea = { helipad: [1770.3, 3239.8, 42.1, 105], dock: [1311.0, 4221.6, 30.1, 70],
  search: [[1110, 4110, 30], [1450, 4020, 30], [950, 4210, 30]] }
Duo.operations.push('ultima_recogida', 'guardacostas')
Object.assign(Duo.contracts, {
  ultima_recogida: { shift: true, name: 'Última recogida', pay: 0, vehicle: 'burrito3', type: 'automobile', duoOnly: true,
    area: 'Los Santos', vehicleName: 'Furgoneta de reparto', roles: ['Conducción', 'Despacho y carga'],
    intro: 'El copiloto elige comercios en F6. Cada bulto entregado vale $320 por persona. Podéis volver antes del cierre.',
    stops: [shiftBriefing, { at: Duo.garage, text: 'Consultad la hoja de ruta' }] },
  guardacostas: { shift: true, name: 'Guardacostas de Alamo Sea', pay: 2650, vehicle: 'maverick', type: 'heli', duoOnly: true,
    area: 'Alamo Sea', vehicleName: 'Maverick y Dinghy', roles: ['Reconocimiento aéreo', 'Patrón de rescate'],
    intro: 'El piloto busca desde Sandy Shores. El patrón recoge la lancha en el lago. Compartid la posición por Teams.',
    stops: [shiftBriefing, { at: Duo.sea.dock, text: 'Localizad la embarcación' }, { at: Duo.sea.dock, text: 'Embarca al náufrago' },
      { at: Duo.sea.dock, text: 'Detén la lancha y entrega al náufrago en el embarcadero' }] },
  noche_davis: { shift: true, name: 'Una noche en Davis', pay: 1250, vehicle: 'granger', type: 'automobile',
    intro: 'Tres vecinos piden ayuda. La primera visita abre un favor distinto en el próximo turno.',
    stops: [{ at: Duo.base, choice: Duo.davis, text: 'Elegid a quién ayudar desde F6' }, { at: Duo.base, text: 'Atiende el aviso del barrio' }] }
})
Object.assign(Duo.briefs, {
  ultima_recogida: ['Operación para dos', Duo.contracts.ultima_recogida.intro],
  guardacostas: ['Operación para dos', Duo.contracts.guardacostas.intro],
  noche_davis: ['Trabajo', Duo.contracts.noche_davis.intro]
})
Duo.exhibit = [[-32.4,-1093.6,26.4,68],[-38.3,-1090.8,26.4,68]]
Duo.hq[1].props.push(['prop_tourist_map_01', -44.62,-1102.85,26.24,70], ['prop_cs_documents_01', -44.35,-1102.85,26.24,70])
Duo.rescue = {
  meeting: [112.2,-1948.9,20.7], hospital: [299.5,-584.1,43.3],
  people: [[111.8,-1942.8,20.7],[-119.1,-1574.5,34.2]]
}
Duo.operations.push('ultima_ambulancia')
Duo.contracts.ultima_ambulancia = {
  shift:true, duoOnly:true, name:'Última ambulancia', area:'Davis y hospital de Pillbox',
  vehicle:'ambulance', type:'automobile', vehicleName:'Ambulancia', pay:1800,
  roles:['Conductor de emergencias','Rescatista y localización'],
  intro:'El rescatista recibe las ubicaciones. Acercad la ambulancia y recoged a un civil para cobrar $1.800 por persona. El segundo añade $800.',
  stops:[shiftBriefing,{at:Duo.rescue.meeting,text:'Buscad a los supervivientes en Davis'}]
}
Duo.briefs.ultima_ambulancia = ['Operación para dos',Duo.contracts.ultima_ambulancia.intro]
