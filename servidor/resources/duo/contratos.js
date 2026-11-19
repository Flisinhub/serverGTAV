globalThis.Duo = {
  base: [-42.12, -1097.03, 26.42, 70],
  garage: [-35.21, -1091.52, 26.42, 70],
  shop: [-48.12, -1095.10, 26.42],
  contracts: {
    mensajeria: {
      name: 'Mensajeria urbana', pay: 420, vehicle: 'speedo', type: 'automobile',
      stops: [
        { at: [-584.01, -872.32, 25.85], text: 'Recoge los paquetes en Little Seoul' },
        { at: [-1211.51, -891.25, 12.87], text: 'Entrega el primer paquete en Vespucci' },
        { at: [-1295.98, -377.43, 36.64], text: 'Entrega el segundo paquete en Del Perro' }
      ]
    },
    taxi: {
      name: 'Taxi de barrio', pay: 550, vehicle: 'taxi', type: 'automobile',
      stops: [
        { at: [307.19, -765.16, 29.25, 250], text: 'Recoge al cliente en Mission Row' },
        { at: [-530.23, -258.50, 35.32], text: 'Lleva al cliente al centro cultural' }
      ],
      passenger: 'a_m_y_business_02'
    },
    taller: {
      name: 'Asistencia en carretera', pay: 680, vehicle: 'towtruck', type: 'automobile',
      stops: [
        { at: [821.32, -1045.69, 26.57], text: 'Recoge las herramientas en La Mesa' },
        { at: [1171.77, -326.47, 69.18], text: 'Presta asistencia en Mirror Park' }
      ]
    },
    puerto: {
      name: 'Contenedores desaparecidos', pay: 1050, vehicle: 'granger', type: 'automobile',
      stops: [
        { at: [823.06, -2988.17, 5.90], text: 'Cruza el puerto y recupera el manifiesto',
          gang: 'Los del Puerto', model: 'g_m_y_mexgoon_01' },
        { at: [1151.52, -3305.59, 5.90], text: 'Recupera la carga en la terminal',
          gang: 'Los del Puerto', model: 'g_m_y_mexgoon_02' }
      ]
    },
    barrio: {
      name: 'La tregua de Davis', pay: 1250, vehicle: 'granger', type: 'automobile',
      stops: [
        { at: [107.38, -1941.48, 20.83], text: 'Recupera las pruebas en Grove Street',
          gang: 'Ballas', model: 'g_m_y_ballaeast_01' },
        { at: [-119.20, -1575.14, 34.18], text: 'Recupera el segundo expediente en Forum Drive',
          gang: 'Families', model: 'g_m_y_famca_01' }
      ]
    },
    desierto: {
      name: 'Ultima parada en Sandy Shores', pay: 1600, vehicle: 'bison', type: 'automobile',
      stops: [
        { at: [1731.73, 3710.04, 34.14], text: 'Recoge el paquete en Sandy Shores' },
        { at: [1553.53, 3814.67, 30.85], text: 'Inspecciona el almacen junto al lago',
          gang: 'Lost MC', model: 'g_m_y_lost_01' }
      ]
    }
  }
}
