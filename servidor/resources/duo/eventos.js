Duo.worldEvents = [
  {
    key: 'evento_auxilio_mirror', name: 'Un cable en Mirror Park', kind: 'Auxilio', zone: 'Mirror Park',
    brief: 'Recoge el sedán averiado en Mirror Park y remólcalo hasta La Mesa.',
    pay: 720, vehicle: 'towtruck', type: 'automobile',
    stops: [
      { at: [1171.77, -326.47, 69.18, 100], text: 'Alinea la grúa con el sedán averiado', tow: 'asea' },
      { at: [821.32, -1045.69, 26.57], text: 'Entrega el sedán en el taller de La Mesa' }
    ]
  },
  {
    key: 'evento_busqueda_vespucci', name: 'La bolsa del repartidor', kind: 'Búsqueda', zone: 'Vespucci',
    brief: 'Un repartidor perdió su bolsa cerca de los canales. Comprueba los avisos y recupérala.',
    pay: 550, vehicle: 'speedo', type: 'automobile',
    stops: [
      {
        at: [-1059.45, -1224.12, 2.86], text: 'Localiza la bolsa en los accesos a los canales',
        search: [[-1039.20, -1215.40, 2.70], [-1077.30, -1241.80, 2.40]]
      },
      { at: [-1211.51, -891.25, 12.87], text: 'Devuelve la bolsa al repartidor en Vespucci' }
    ]
  },
  {
    key: 'evento_escolta_puerto', name: 'Relevo de estibadores', kind: 'Escolta', zone: 'Terminal',
    brief: 'Acompaña a la furgoneta de relevo desde la explanada hasta el acceso al puerto.',
    pay: 760, vehicle: 'granger', type: 'automobile',
    stops: [
      { at: [887.44, -3204.20, 5.90, 90], text: 'Reúnete con la furgoneta de los estibadores', escort: 'burrito' },
      { at: [807.46, -2992.10, 5.90], text: 'Confirma que la furgoneta ha llegado al acceso' }
    ]
  },
  {
    key: 'evento_auxilio_aerodromo', name: 'Avería en la pista', kind: 'Auxilio', zone: 'Sandy Shores',
    brief: 'Retira el coche de servicio averiado junto al aeródromo y llévalo al punto de asistencia.',
    pay: 850, vehicle: 'towtruck', type: 'automobile',
    stops: [
      { at: [1735.69, 3302.90, 41.22, 15], text: 'Engancha el coche de servicio junto al aeródromo', tow: 'primo' },
      { at: [1731.73, 3710.04, 34.14], text: 'Lleva el coche hasta el punto de asistencia de Sandy Shores' }
    ]
  },
  {
    key: 'evento_busqueda_terminal', name: 'Albarán extraviado', kind: 'Búsqueda', zone: 'Terminal',
    brief: 'El control de mercancías necesita el albarán perdido en el depósito de contenedores.',
    pay: 630, vehicle: 'speedo', type: 'automobile',
    stops: [
      {
        at: [1151.52, -3305.59, 5.90], text: 'Revisa los avisos de la terminal para recuperar el albarán',
        search: [[1125.90, -3303.40, 5.90], [1175.30, -3304.90, 5.90]]
      },
      { at: [874.84, -3203.73, 5.90], text: 'Entrega el albarán al control de mercancías' }
    ]
  },
  {
    key: 'evento_escolta_davis', name: 'Ruta de reparto comunitaria', kind: 'Escolta', zone: 'Davis',
    brief: 'Acompaña una furgoneta de reparto de Grove Street a Forum Drive.',
    pay: 700, vehicle: 'granger', type: 'automobile',
    stops: [
      { at: [107.38, -1941.48, 20.83, 315], text: 'Confirma la salida del reparto desde Grove Street', escort: 'burrito' },
      { at: [-119.20, -1575.14, 34.18], text: 'Acompaña la furgoneta hasta el punto de reparto de Forum Drive' }
    ]
  },
  {
    key: 'evento_auxilio_little_seoul', name: 'Una rueda menos', kind: 'Auxilio', zone: 'Little Seoul',
    brief: 'Retira un coche en Little Seoul y llévalo hasta la zona de carga de Mission Row.',
    pay: 690, vehicle: 'towtruck', type: 'automobile',
    stops: [
      { at: [-584.01, -872.32, 25.85, 180], text: 'Alinea la grúa detrás del coche de Little Seoul', tow: 'ingot' },
      { at: [307.19, -765.16, 29.25], text: 'Entrega el coche en la zona de carga de Mission Row' }
    ]
  },
  {
    key: 'evento_busqueda_alamo', name: 'Caja sin etiqueta', kind: 'Búsqueda', zone: 'Alamo Sea',
    brief: 'Busca una caja de repuestos junto al lago y llévala al punto de suministro en Sandy Shores.',
    pay: 780, vehicle: 'bison', type: 'automobile',
    stops: [
      {
        at: [1553.53, 3814.67, 30.85], text: 'Inspecciona las zonas de descarga junto al lago',
        search: [[1530.70, 3798.30, 32.10], [1578.30, 3800.20, 31.50], [1558.80, 3839.60, 31.40]]
      },
      { at: [1731.73, 3710.04, 34.14], text: 'Entrega los repuestos en el punto de suministro' }
    ]
  },
  {
    key: 'evento_escolta_sandy', name: 'Suministros hasta el lago', kind: 'Escolta', zone: 'Sandy Shores',
    brief: 'Guía una furgoneta de suministros desde Sandy Shores hasta el almacén junto al lago.',
    pay: 740, vehicle: 'bison', type: 'automobile',
    stops: [
      { at: [1731.73, 3710.04, 34.14, 25], text: 'Encuentra la furgoneta de suministros en Sandy Shores', escort: 'burrito' },
      { at: [1553.53, 3814.67, 30.85], text: 'Comprueba que los suministros llegan al almacén' }
    ]
  }
]
