Duo.chapters = [
  { name: 'La central', missions: ['carga', 'averia'] },
  { name: 'El puerto', missions: ['contenedor', 'salida'] },
  { name: 'La ruta del desierto', missions: ['puesto', 'relevo'] },
  { name: 'El último encargo', missions: ['cruce', 'ultimo'] }
]

Object.assign(Duo.briefs, {
  carga: ['Campaña', 'Carga los repuestos en La Mesa y completa dos entregas en cuatro minutos.'],
  averia: ['Campaña', 'Recoge un coche averiado en Mirror Park y llévalo en grúa al taller de La Mesa.'],
  contenedor: ['Campaña', 'Cruza el puerto, localiza el contenedor correcto y lleva el manifiesto a control.'],
  salida: ['Campaña', 'Reúnete con los estibadores y acompaña su furgoneta hasta la salida de la terminal.'],
  puesto: ['Campaña', 'Rastrea un depósito de suministros junto al lago y abastece el aeródromo.'],
  relevo: ['Campaña', 'Lleva un envío de Grapeseed a Sandy Shores. Cambiad de conductor en el relevo.'],
  cruce: ['Campaña', 'Recuperad dos registros en Davis y llevadlos al punto de encuentro.'],
  ultimo: ['Campaña', 'Recupera el archivo que une los encargos y completa la extracción por etapas.']
})

Object.assign(Duo.contracts, {
  carga: {
    name: 'Carga urgente', pay: 780, vehicle: 'speedo', type: 'automobile', timeLimit: 240,
    stops: [
      {
        at: [821.32, -1045.69, 26.57], text: 'Carga los repuestos en La Mesa e inicia el cronómetro',
        roles: ['Coloca la furgoneta junto al taller', 'Confirma la recogida para iniciar el reloj']
      },
      {
        at: [307.19, -765.16, 29.25], text: 'Entrega el primer pedido en Mission Row',
        roles: ['Estaciona junto al punto de entrega', 'Baja y confirma la primera entrega']
      },
      {
        at: [-584.01, -872.32, 25.85], text: 'Entrega el último pedido en Little Seoul',
        roles: ['Acerca la furgoneta al último punto', 'Confirma la última entrega antes de que acabe el tiempo']
      }
    ]
  },
  averia: {
    name: 'Avería nocturna', pay: 910, vehicle: 'towtruck', type: 'automobile',
    stops: [
      { at: [1171.77, -326.47, 69.18, 100], text: 'Alinea la grúa con el coche averiado en Mirror Park', tow: 'asea' },
      { at: [821.32, -1045.69, 26.57], text: 'Entrega el coche averiado en el taller de La Mesa' }
    ]
  },
  contenedor: {
    name: 'Contenedor 17', pay: 1150, vehicle: 'granger', type: 'automobile',
    stops: [
      { at: [823.06, -2988.17, 5.90], text: 'Consulta el registro de entradas del puerto' },
      {
        at: [1151.52, -3305.59, 5.90], text: 'Revisa las ubicaciones posibles del contenedor 17',
        search: [[1125.9, -3303.4, 5.90], [1175.3, -3304.9, 5.90]]
      },
      { at: [874.84, -3203.73, 5.90], text: 'Entrega el manifiesto en el control de mercancías' }
    ]
  },
  salida: {
    name: 'Salida de la terminal', pay: 1400, vehicle: 'granger', type: 'automobile',
    stops: [
      { at: [1151.52, -3305.59, 5.90], text: 'Reúnete con el transportista en la explanada' },
      {
        at: [887.44, -3204.20, 5.90, 90], text: 'Confirma la salida de la furgoneta de los estibadores',
        escort: 'burrito'
      },
      {
        at: [807.46, -2992.10, 5.90], text: 'Acompaña la furgoneta hasta el control de salida',
        roles: ['Mantén vuestro coche cerca de la furgoneta', 'Confirma que la furgoneta ha llegado al control']
      }
    ]
  },
  puesto: {
    name: 'Puesto perdido', pay: 1580, vehicle: 'bison', type: 'automobile',
    stops: [
      { at: [1731.73, 3710.04, 34.14], text: 'Recoge la última posición conocida en Sandy Shores' },
      {
        at: [1553.53, 3814.67, 30.85], text: 'Localiza los suministros en los alrededores del almacén',
        search: [[1530.7, 3798.3, 32.1], [1578.3, 3800.2, 31.5], [1558.8, 3839.6, 31.4]]
      },
      { at: [1735.69, 3302.90, 41.22], text: 'Entrega los suministros junto al aeródromo' }
    ]
  },
  relevo: {
    name: 'Relevo en Sandy Shores', pay: 1740, vehicle: 'bison', type: 'automobile',
    stops: [
      { at: [1685.18, 4919.15, 42.08], text: 'Carga el envío en Grapeseed' },
      {
        at: [1731.73, 3710.04, 34.14], text: 'Registra el primer conductor en el punto de relevo',
        relay: true, roles: ['Presenta el vehículo en el punto de relevo', 'Confirma el primer relevo y cambia de asiento']
      },
      {
        at: [1735.69, 3302.90, 41.22], text: 'Llega al aeródromo con el segundo conductor',
        relay: true, roles: ['Guía al segundo conductor y confirma la entrega', 'Conduce el segundo tramo hacia el aeródromo']
      }
    ]
  },
  cruce: {
    name: 'Cruce de Davis', pay: 1910, vehicle: 'granger', type: 'automobile',
    stops: [
      {
        at: [107.38, -1941.48, 20.83], text: 'Abre paso hasta el escondite en Grove Street',
        gang: 'Ballas', model: 'g_m_y_ballaorig_01'
      },
      {
        at: [96.40, -1934.38, 20.79], text: 'Recupera el primer registro junto a Grove Street',
        parallel: [117.06, -1954.44, 20.75],
        parallelText: 'Recupera el segundo registro al otro lado de la calle',
        roles: ['Recoge el registro de Grove Street', 'Recoge el registro del punto secundario']
      },
      { at: [307.19, -765.16, 29.25], text: 'Entrega los dos registros en Mission Row' }
    ]
  },
  ultimo: {
    name: 'Último turno', pay: 2350, vehicle: 'granger', type: 'automobile',
    stops: [
      {
        at: [955.07, -1569.69, 30.72], text: 'Recoge el archivo en el almacén de East Los Santos',
        gang: 'Vagos', model: 'g_m_y_mexgoon_03'
      },
      {
        at: [821.32, -1045.69, 26.57], text: 'Pasa por el punto de extracción intermedio de La Mesa',
        roles: ['Acerca el coche al punto de transferencia', 'Confirma que el archivo está a bordo']
      },
      {
        at: [-584.01, -872.32, 25.85], text: 'Completa la entrega final en Little Seoul',
        roles: ['Estaciona en el punto de entrega final', 'Confirma la entrega y cierra el último encargo']
      }
    ]
  }
})
