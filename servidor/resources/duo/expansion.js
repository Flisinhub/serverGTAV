Duo.motorPool = [-22.3, -1096.9, 26.67]
Duo.parking = [[-17.7, -1091.6, 26.67, 69], [-16.3, -1088.0, 26.67, 69]]
Duo.cars = {
  blista: { name: 'Dinka Blista', kind: 'Urbano', price: 0 },
  sultan: { name: 'Karin Sultan', kind: 'Deportivo · tracción total', price: 1550 },
  dominator: { name: 'Vapid Dominator', kind: 'Muscle', price: 2250 },
  elegy2: { name: 'Annis Elegy RH8', kind: 'Deportivo', price: 2900 },
  sandking: { name: 'Vapid Sandking XL', kind: 'Todoterreno · cuatro plazas', price: 3500 },
  comet2: { name: 'Pfister Comet', kind: 'Deportivo · dos plazas', price: 4200 },
  kuruma: { name: 'Karin Kuruma', kind: 'Deportivo · cuatro plazas', price: 4850 },
  jester: { name: 'Dinka Jester', kind: 'Deportivo · dos plazas', price: 5700 }
}
Duo.paints = {
  grafito: { name: 'Grafito', rgb: [44, 49, 54], swatch: '#343b43' },
  petroleo: { name: 'Verde petróleo', rgb: [24, 88, 76], swatch: '#18584c' },
  cobre: { name: 'Cobre', rgb: [170, 77, 40], swatch: '#aa4d28' },
  hielo: { name: 'Blanco hielo', rgb: [224, 235, 238], swatch: '#e0ebee' },
  indigo: { name: 'Índigo', rgb: [61, 66, 157], swatch: '#474eb0' }
}
Duo.briefs = {
  mensajeria: ['Trabajo', 'Recoge paquetes en Little Seoul y repártelos entre Vespucci y Del Perro.'],
  taxi: ['Trabajo', 'Recoge al cliente en Mission Row. Dejad libre el asiento trasero derecho.'],
  taller: ['Trabajo', 'Carga las herramientas en La Mesa y atiende una avería en Mirror Park.'],
  puerto: ['Banda', 'Recuperad un manifiesto y la carga desaparecida en dos terminales del puerto.'],
  barrio: ['Banda', 'Recuperad dos expedientes de los Ballas y las Families en Davis.'],
  desierto: ['Banda', 'Llevad un paquete a Sandy Shores y revisad un almacén vigilado por Lost MC.'],
  costa: ['Trabajo', 'Lleva material de salvamento desde Vespucci hasta los equipos de Chumash.'],
  nocturno: ['Banda', 'Recupera dos piezas robadas en East Los Santos y el polígono de El Burro.'],
  rural: ['Trabajo', 'Transporta semillas y suministros entre Grapeseed y el aeródromo de Sandy Shores.'],
  rally: ['Contrarreloj', 'Conductor y copiloto comparten un cronómetro. Cruzad los controles en orden.']
}

Object.assign(Duo.contracts, {
  costa: {
    name: 'Guardia de la costa', pay: 960, vehicle: 'bison', type: 'automobile',
    stops: [
      { at: [-1245.44, -1494.56, 4.32], text: 'Recoge el material en Vespucci' },
      { at: [-1614.12, -1015.20, 13.13], text: 'Entrega el equipo en Del Perro' },
      { at: [-3167.22, 1085.56, 20.83], text: 'Deja los suministros en Chumash' }
    ]
  },
  nocturno: {
    name: 'Repuestos de medianoche', pay: 1850, vehicle: 'granger', type: 'automobile',
    stops: [
      { at: [955.07, -1569.69, 30.72], text: 'Localiza las piezas en East Los Santos',
        gang: 'Vagos', model: 'g_m_y_mexgoon_02' },
      { at: [1509.13, -2146.27, 76.63], text: 'Recupera la segunda pieza en El Burro',
        gang: 'Vagos', model: 'g_m_y_mexgoon_03' }
    ]
  },
  rural: {
    name: 'Suministro a Grapeseed', pay: 1220, vehicle: 'bison', type: 'automobile',
    stops: [
      { at: [1685.18, 4919.15, 42.08], text: 'Recoge las semillas en Grapeseed' },
      { at: [2447.20, 4977.42, 46.81], text: 'Entrega los sacos en la granja' },
      { at: [1735.69, 3302.90, 41.22], text: 'Recoge el albaran junto al aerodromo' }
    ]
  },
  rally: {
    name: 'Vuelta a Vinewood', pay: 1350, vehicle: 'sultan', type: 'automobile', timeLimit: 240,
    stops: [
      { at: [260.40, 180.67, 104.16], text: 'Salida | Vinewood' },
      { at: [260.56, 260.15, 105.65], text: 'Control 1 | Legion de Vinewood' },
      { at: [96.28, 325.70, 112.10], text: 'Control 2 | Alta Street' },
      { at: [-177.00, 338.70, 111.50], text: 'Control 3 | Las Lagunas' },
      { at: [-404.80, 280.50, 83.20], text: 'Meta | West Vinewood' }
    ]
  }
})
Duo.caches = [
  { label: 'Vespucci', hint: 'Junto al paseo que bordea los canales.', at: [-1059.45, -1224.12, 2.86], area: [-1045.2, -1210.0] },
  { label: 'Sandy Shores', hint: 'En el camino junto al aeródromo.', at: [1727.10, 3291.73, 41.17], area: [1744.9, 3297.4] },
  { label: 'Mirror Park', hint: 'Busca junto al camino del parque.', at: [1103.12, -470.18, 66.61], area: [1115.8, -456.3] },
  { label: 'Del Perro', hint: 'En las inmediaciones del paseo marítimo.', at: [-1606.68, -1044.09, 13.02], area: [-1595.2, -1032.4] }
]
Duo.cachePay = 350
