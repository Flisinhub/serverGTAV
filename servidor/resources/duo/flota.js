Duo.supplies = {
  bocadillo: { label: 'Bocadillo', price: 55, heal: 25, detail: 'Recupera hasta 25 puntos de salud. Guárdalo para el camino.' },
  barrita: { label: 'Barrita energética', price: 25, heal: 12, detail: 'Recupera hasta 12 puntos de salud cuando la consumes.' },
  blindaje: { label: 'Chaleco', price: 180, detail: 'Repone el blindaje al máximo.' },
  botiquin: { label: 'Botiquín', price: 140, detail: 'Recupera toda la salud.' },
  carabina: { label: 'Carabina', price: 850, weapon: 'WEAPON_CARBINERIFLE', ammo: 180 },
  pistolacombate: { label: 'Pistola de combate', price: 320, weapon: 'WEAPON_COMBATPISTOL', ammo: 84 },
  escopeta: { label: 'Escopeta de corredera', price: 560, weapon: 'WEAPON_PUMPSHOTGUN', ammo: 40 },
  subfusil: { label: 'Subfusil PDW', price: 720, weapon: 'WEAPON_COMBATPDW', ammo: 150 },
  carabinaespecial: { label: 'Carabina especial', price: 1150, weapon: 'WEAPON_SPECIALCARBINE', ammo: 180 },
  tirador: { label: 'Fusil de tirador', price: 1320, weapon: 'WEAPON_MARKSMANRIFLE', ammo: 48 }
}

Duo.hangar = {
  at: [1714.8, 3254.7, 41.1],
  parking: [[1708.3, 3271.8, 41.2, 103], [1689.6, 3271.2, 41.2, 103]]
}

Object.assign(Duo.cars, {
  cuban800: { name: 'Cuban 800', kind: 'Bimotor', type: 'plane', price: 8500 },
  mammatus: { name: 'Mammatus', kind: 'Avioneta', type: 'plane', price: 6600 },
  dodo: { name: 'Dodo', kind: 'Hidroavión', type: 'plane', price: 11800 },
  maverick: { name: 'Maverick', kind: 'Helicóptero', type: 'heli', price: 10200 }
})

Object.assign(Duo.cars, {
  buffalo: { name: 'Bravado Buffalo', kind: 'Deportivo · cuatro plazas', price: 2050 },
  futo: { name: 'Karin Futo', kind: 'Cupé ligero', price: 1750 },
  banshee: { name: 'Bravado Banshee', kind: 'Deportivo · dos plazas', price: 5100 },
  feltzer2: { name: 'Benefactor Feltzer', kind: 'Deportivo · dos plazas', price: 5900 },
  gauntlet: { name: 'Bravado Gauntlet', kind: 'Muscle', price: 2800 },
  mesa: { name: 'Canis Mesa', kind: 'Todoterreno · cuatro plazas', price: 2400 },
  rebel2: { name: 'Karin Rebel', kind: 'Camioneta · dos plazas', price: 2700 },
  zentorno: { name: 'Pegassi Zentorno', kind: 'Superdeportivo · dos plazas', price: 9800 }
})

Object.assign(Duo.briefs, {
  correo_aereo: ['Aviación', 'Lleva correo en un Cuban 800 desde Sandy Shores hasta Grapeseed.'],
  cartografia: ['Aviación', 'Vuela en una Mammatus por dos puntos de observación y regresa al aeródromo.'],
  costa_aerea: ['Aviación', 'Transporta un parte meteorológico en un Dodo entre la costa y el desierto.'],
  helipuentes: ['Aviación', 'Usa un Maverick para llegar a dos puestos de observación junto al lago.'],
  urgente_rural: ['Trabajo', 'Lleva material de taller en una Rebel por dos puntos de Blaine County.'],
  traslado_sur: ['Trabajo', 'Recoge un vehículo de enlace y confirma su itinerario por el sur de la ciudad.']
})

const sandyApron = [1736.0, 3276.6, 41.2, 100]
const grapeApron = [2139.0, 4797.0, 41.0, 118]
Object.assign(Duo.contracts, {
  correo_aereo: {
    name: 'Correo aéreo de Blaine', pay: 1450, vehicle: 'cuban800', type: 'plane',
    launch: sandyApron, returnAt: grapeApron,
    stops: [
      { at: sandyApron, text: 'Sube al Cuban 800 en Sandy Shores' },
      { at: [1940, 3950, 205], text: 'Cruza el control sobre el lago', air: true }
    ]
  },
  cartografia: {
    name: 'Cartografía del Álamo', pay: 1850, vehicle: 'mammatus', type: 'plane',
    launch: sandyApron, returnAt: sandyApron,
    stops: [
      { at: sandyApron, text: 'Sube a la Mammatus en Sandy Shores' },
      { at: [1220, 3780, 202], text: 'Confirma el primer punto sobre el lago', air: true },
      { at: [920, 3360, 238], text: 'Confirma el segundo punto sobre el desierto', air: true }
    ]
  },
  costa_aerea: {
    name: 'Informe de la costa', pay: 2300, vehicle: 'dodo', type: 'plane',
    launch: grapeApron, returnAt: sandyApron,
    stops: [
      { at: grapeApron, text: 'Sube al Dodo en Grapeseed' },
      { at: [3110, 4140, 220], text: 'Confirma el punto de observación costero', air: true },
      { at: [2540, 3330, 204], text: 'Envía el parte desde el segundo control', air: true }
    ]
  },
  helipuentes: {
    name: 'Enlace del lago', pay: 2050, vehicle: 'maverick', type: 'heli',
    launch: [1770.9, 3239.5, 42.1, 106], returnAt: [1770.9, 3239.5, 42.1, 106],
    stops: [
      { at: [1770.9, 3239.5, 42.1], text: 'Sube al Maverick en el aeródromo' },
      { at: [1690, 3700, 128], text: 'Confirma el enlace oriental desde el aire', air: true },
      { at: [1040, 3860, 140], text: 'Confirma el enlace occidental desde el aire', air: true }
    ]
  },
  urgente_rural: {
    name: 'Repuestos de Blaine', pay: 1050, vehicle: 'rebel2', type: 'automobile',
    stops: [
      { at: [1685.18, 4919.15, 42.08], text: 'Recoge los repuestos en Grapeseed' },
      { at: [1731.73, 3710.04, 34.14], text: 'Entrega los repuestos en Sandy Shores' }
    ]
  },
  traslado_sur: {
    name: 'Enlace de Mission Row', pay: 790, vehicle: 'buffalo', type: 'automobile',
    stops: [
      { at: [307.19, -765.16, 29.25], text: 'Recoge el parte de ruta en Mission Row' },
      { at: [-119.20, -1575.14, 34.18], text: 'Confirma el relevo en Forum Drive' }
    ]
  }
})
