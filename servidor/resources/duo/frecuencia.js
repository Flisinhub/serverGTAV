Duo.story2 = {
  name: 'Frecuencia fantasma',
  start: 4,
  intro: 'Una llamada interrumpida dejó a un transportista sin rastro. Mara os pide reconstruir su último recorrido.',
  rewardPaint: 'frecuencia'
}

Duo.chapters.push(
  {
    name: 'La llamada',
    missions: ['turno_interrumpido', 'ecos_vespucci', 'pasajero_madrugada'],
    intro: 'Mara ha recuperado el inicio de una llamada. Un transportista salió de La Mesa y solicitó ayuda antes de llegar a Vespucci.'
  },
  {
    name: 'Marea baja',
    missions: ['dos_muelles', 'furgoneta_gemela', 'contrapeso'],
    intro: 'El testigo reconoce un sello del puerto. Dos muelles comparten numeración y alguien movió la carga durante el cambio de turno.'
  },
  {
    name: 'Fuera de cobertura',
    missions: ['tres_balizas', 'camino_sal', 'ultimo_relevo'],
    intro: 'La última nota del transportista apunta a Sandy Shores. Fuera de la ciudad, las balizas son la única pista que sigue dando señal.'
  },
  {
    name: 'Volver al aire',
    missions: ['la_prueba', 'dos_destinos', 'frecuencia_fantasma'],
    intro: 'Iria está a salvo. Ahora faltan el original del manifiesto y dos copias para que su versión de los hechos llegue a la ciudad.'
  }
)

Duo.paints.frecuencia = {
  name: 'Azul frecuencia',
  rgb: [32, 118, 169],
  swatch: '#2076a9',
  requires: 'story2'
}

Object.assign(Duo.briefs, {
  turno_interrumpido: ['Campaña', 'Reconstruid el último trayecto con dos fragmentos de una llamada.'],
  ecos_vespucci: ['Campaña', 'Dividid la búsqueda y localizad el vehículo antes de que retiren los restos.'],
  pasajero_madrugada: ['Campaña', 'Recoged a Nico y llevadlo al refugio cerca de la central.'],
  dos_muelles: ['Campaña', 'Contrastad los registros de dos muelles y reunid los documentos.'],
  furgoneta_gemela: ['Campaña', 'Distinguid la furgoneta correcta por las pistas del testigo y escoltadla.'],
  contrapeso: ['Campaña', 'Elegid por dónde sacar la carga y llevadla al punto de pesaje.'],
  tres_balizas: ['Campaña', 'Seguid tres señales y cruzad las pistas hasta encontrar la posición de Iria.'],
  camino_sal: ['Campaña', 'Recoged a Iria junto al lago y llevadla al puesto del aeródromo.'],
  ultimo_relevo: ['Campaña', 'Llevad el manifiesto a tiempo. Cambiad de conductor a mitad del trayecto.'],
  la_prueba: ['Campaña', 'Recoged el original en East Los Santos y verificad el sello en La Mesa.'],
  dos_destinos: ['Campaña', 'Preparad dos copias y repartid las entregas a pie en Mission Row.'],
  frecuencia_fantasma: ['Campaña', 'Elegid cómo llevar el manifiesto a la ciudad y cerrad la investigación.']
})

Object.assign(Duo.contracts, {
  turno_interrumpido: {
    name: 'Turno interrumpido', pay: 1080, vehicle: 'speedo', type: 'automobile',
    intro: 'Mara · La llamada duró siete segundos. El primer sonido venía de La Mesa. Empezad por el taller.',
    stops: [
      {
        at: [821.32, -1045.69, 26.57], text: 'Recoge en La Mesa la primera nota de ruta',
        dialogue: 'Mara · Ya tengo el tramo de salida. En el segundo fragmento se oye agua cerca.'
      },
      {
        at: [-1211.51, -891.25, 12.87], text: 'Sigue las pistas hasta el último punto de reparto',
        search: [[-1192.35, -882.42, 13.55], [-1238.12, -903.80, 12.30]],
        clues: [
          'La nota sitúa la parada entre el punto más al este y el más al oeste.',
          'El testigo dibujó la parada casi a la altura del acceso norte; descartad la más al sur.'
        ],
        dialogue: 'Mara · Es la parada de reparto. Buscad el sobre de ruta y traedlo al siguiente punto.'
      },
      {
        at: [-1295.98, -377.43, 36.64], text: 'Entrega el sobre al contacto de Del Perro',
        dialogue: 'Mara · Tenemos la matrícula. El vehículo aún puede estar cerca de los canales.'
      }
    ]
  },
  ecos_vespucci: {
    name: 'Ecos de Vespucci', pay: 1220, vehicle: 'granger', type: 'automobile',
    intro: 'Mara · Un vecino avisó de una furgoneta abandonada. Revisad los dos accesos antes de acercaros.',
    stops: [
      {
        at: [-1059.45, -1224.12, 2.86], text: 'Revisa el paso junto al canal',
        parallel: [-1045.20, -1210.00, 3.06], parallelText: 'Revisa la entrada por el paseo',
        roles: ['Busca marcas en el paso del canal', 'Pregunta por el vehículo en el paseo'],
        dialogue: 'Mara · Si cada uno revisa un acceso, podremos saber hacia dónde salió el transportista.'
      },
      {
        at: [-1245.44, -1494.56, 4.32], text: 'Comprueba la matrícula del vehículo abandonado',
        scene: [{ model: 'speedo', at: [-1248.68, -1496.62, 4.32, 35] }],
        dialogue: 'Mara · Coincide. Hay una nota de Nico, el vigilante. Dice que vio quién se llevó la carga.'
      },
      { at: [-1614.12, -1015.20, 13.13], text: 'Deja la nota a resguardo en Del Perro' }
    ]
  },
  pasajero_madrugada: {
    name: 'El pasajero de madrugada', pay: 1340, vehicle: 'taxi', type: 'automobile',
    passenger: 'a_m_y_business_02',
    intro: 'Mara · Nico os espera en Mission Row. Dejad libre el asiento trasero derecho para que suba.',
    stops: [
      {
        at: [307.19, -765.16, 29.25, 250], text: 'Recoge a Nico en Mission Row',
        dialogue: 'Nico · Vi salir dos furgonetas iguales. Solo una llevaba el sello antiguo de los estibadores.'
      },
      {
        at: [-138.44, -1056.01, 27.29], text: 'Deja a Nico en el refugio cerca de la central',
        dialogue: 'Nico · Buscad las hojas de entrada en los muelles. Allí figuran los números de las dos furgonetas.'
      }
    ]
  },
  dos_muelles: {
    name: 'Dos muelles', pay: 1500, vehicle: 'granger', type: 'automobile',
    intro: 'Mara · Los dos registros tienen la misma hora. Comparad los dos ejemplares y guardad las firmas.',
    stops: [
      {
        at: [823.06, -2988.17, 5.90], text: 'Consulta el registro de la entrada del puerto',
        dialogue: 'Mara · El original y la copia están a ambos lados de la explanada.'
      },
      {
        at: [1125.90, -3303.40, 5.90], text: 'Recoge el registro del muelle oeste',
        parallel: [1175.30, -3304.90, 5.90], parallelText: 'Recoge el registro del muelle este',
        roles: ['Comprueba la firma del muelle oeste', 'Comprueba el sello del muelle este'],
        dialogue: 'Mara · Quiero ver los dos papeles juntos antes de descartar una furgoneta.'
      },
      {
        at: [874.84, -3203.73, 5.90], text: 'Compara ambos registros en control de mercancías',
        dialogue: 'Mara · La copia está mal fechada. Ya sabemos en qué zona espera el vehículo correcto.'
      }
    ]
  },
  furgoneta_gemela: {
    name: 'La furgoneta gemela', pay: 1680, vehicle: 'granger', type: 'automobile',
    intro: 'Mara · El conductor del vehículo correcto accede a colaborar si lo acompañamos a la salida.',
    stops: [
      {
        at: [1151.52, -3305.59, 5.90], text: 'Reconoce la furgoneta a partir de los registros',
        search: [[1125.90, -3303.40, 5.90], [1175.30, -3304.90, 5.90]],
        scene: [
          { model: 'burrito', at: [1125.9, -3307.4, 5.9, 90] },
          { model: 'burrito', at: [1151.5, -3309.6, 5.9, 90] },
          { model: 'burrito', at: [1175.3, -3308.9, 5.9, 90] }
        ],
        clues: [
          'Nico vio la furgoneta entre las plazas de los extremos.',
          'La furgoneta correcta estaba unos metros más al sur que las otras dos.'
        ],
        dialogue: 'Mara · Buscad la plaza que encaja con ambos datos. El conductor os verá llegar.',
        checkpoint: true
      },
      {
        at: [887.44, -3204.20, 5.90, 90], text: 'Confirma la salida con el transportista',
        escort: 'burrito',
        dialogue: 'Transportista · Os llevo a control. Allí podéis comprobar el peso y el número del envío.'
      },
      {
        at: [807.46, -2992.10, 5.90], text: 'Acompaña al transportista hasta el control',
        roles: ['Mantén el vehículo de escolta cerca de la furgoneta', 'Confirma que la furgoneta ha llegado'],
        dialogue: 'Transportista · Ya estáis en la lista de entrada. La carga del otro turno sigue dentro.'
      }
    ]
  },
  contrapeso: {
    name: 'Contrapeso', pay: 1820, vehicle: 'bison', type: 'automobile',
    intro: 'Mara · Hay dos salidas habilitadas. Elegid una y llevad la carga a La Mesa.',
    stops: [
      {
        at: [874.84, -3203.73, 5.90], text: 'Carga el envío junto al control de mercancías',
        dialogue: 'Mara · Podéis validar la salida por el acceso terrestre o por el muelle exterior.',
        checkpoint: true
      },
      {
        at: [823.06, -2988.17, 5.90], text: 'Elige uno de los dos controles de salida',
        choice: [
          { at: [823.06, -2988.17, 5.90], text: 'Registra la salida por el acceso terrestre' },
          { at: [1151.52, -3305.59, 5.90], text: 'Registra la salida por el muelle exterior' }
        ],
        dialogue: 'Mara · El control enviará el pesaje a La Mesa. Conservad el resguardo.'
      },
      {
        at: [821.32, -1045.69, 26.57], text: 'Entrega la carga y coteja el pesaje en La Mesa',
        dialogue: 'Mara · El resguardo lleva el nombre de Iria. Su siguiente parada era Sandy Shores.'
      }
    ]
  },
  tres_balizas: {
    name: 'Tres balizas', pay: 2000, vehicle: 'bison', type: 'automobile',
    intro: 'Mara · Iria dejó tres balizas de reparto. Solo una de las señales indica su refugio.',
    stops: [
      {
        at: [1731.73, 3710.04, 34.14], text: 'Activa el receptor en Sandy Shores',
        dialogue: 'Mara · El receptor distingue tres señales. La más intensa no es necesariamente la reciente.'
      },
      {
        at: [1553.53, 3814.67, 30.85], text: 'Inspecciona las tres señales junto al lago',
        search: [[1530.70, 3798.30, 32.10], [1578.30, 3800.20, 31.50]],
        clues: [
          'El receptor sitúa la señal reciente al norte de las otras dos.',
          'Las dos señales al sur son de almacenes vacíos; buscad el punto más cerca de la orilla.'
        ],
        dialogue: 'Mara · Si encontráis la baliza correcta, la copia de la nota tendrá el punto de recogida.'
      },
      {
        at: [1735.69, 3302.90, 41.22], text: 'Lleva las coordenadas al puesto del aeródromo',
        dialogue: 'Mara · Tenemos el punto de recogida. Iria os espera junto al cobertizo del lago.'
      }
    ]
  },
  camino_sal: {
    name: 'Camino de sal', pay: 2130, vehicle: 'granger', type: 'automobile',
    passenger: 'a_f_y_tourist_01',
    intro: 'Mara · Iria está junto al lago. Dejad libre el asiento trasero derecho y llevadla al aeródromo.',
    stops: [
      {
        at: [1553.53, 3814.67, 30.85, 30], text: 'Recoge a Iria en el cobertizo junto al lago',
        dialogue: 'Iria · Me quedé sin cobertura, pero guardé un duplicado del manifiesto en Grapeseed.'
      },
      {
        at: [1735.69, 3302.90, 41.22], text: 'Deja a Iria en el puesto del aeródromo',
        dialogue: 'Iria · Estoy bien. Llevad el duplicado a la central para que nadie pueda cambiar la versión de los hechos.'
      }
    ]
  },
  ultimo_relevo: {
    name: 'Último relevo', pay: 2320, vehicle: 'bison', type: 'automobile', timeLimit: 360,
    intro: 'Mara · Hay seis minutos entre la recogida y la entrega. El copiloto confirma cada control; intercambiad asientos en Sandy Shores.',
    stops: [
      {
        at: [1685.18, 4919.15, 42.08], text: 'Recoge el duplicado en Grapeseed e inicia el reloj',
        dialogue: 'Mara · Duplicado recogido. Sandy Shores será el punto de relevo.'
      },
      {
        at: [1731.73, 3710.04, 34.14], text: 'Confirma el primer tramo y cambia de conductor',
        relay: true,
        roles: ['Conduce hasta Sandy Shores', 'Confirma el relevo y toma el volante'],
        dialogue: 'Mara · Primer tramo registrado. El segundo conductor lleva el duplicado al aeródromo.'
      },
      {
        at: [1735.69, 3302.90, 41.22], text: 'Entrega el duplicado con el segundo conductor',
        relay: true,
        roles: ['Navega y confirma el último control', 'Conduce el segundo tramo'],
        dialogue: 'Mara · El duplicado está en custodia. Ahora podemos buscar el original.'
      }
    ]
  },
  la_prueba: {
    name: 'La prueba', pay: 2450, vehicle: 'granger', type: 'automobile',
    intro: 'Mara · El original está en un almacén de East Los Santos. Llevadlo al taller para verificar el sello.',
    stops: [
      {
        at: [955.07, -1569.69, 30.72], text: 'Recupera el manifiesto original del almacén',
        gang: 'Vagos',
        model: 'g_m_y_mexgoon_03',
        dialogue: 'Mara · Esperad a poder acceder al almacén y comprobad que el manifiesto conserve el sello.'
      },
      {
        at: [821.32, -1045.69, 26.57], text: 'Verifica el sello del manifiesto en el taller',
        dialogue: 'Mara · El sello coincide. Tenemos que hacer llegar dos copias a dos personas distintas.'
      }
    ]
  },
  dos_destinos: {
    name: 'Dos destinos', pay: 2600, vehicle: 'speedo', type: 'automobile',
    intro: 'Mara · Hay dos sobres en el taller. Repartid las entregas y reuníos en el punto de encuentro.',
    stops: [
      {
        at: [821.32, -1045.69, 26.57], text: 'Recoge los dos sobres en La Mesa',
        dialogue: 'Mara · Un sobre para el archivo y otro para Nico. Confirmad cada entrega por separado.',
        checkpoint: true
      },
      {
        at: [307.19, -765.16, 29.25], text: 'Entrega la primera copia en el archivo',
        parallel: [329.44, -784.90, 29.28], parallelText: 'Entrega la segunda copia a Nico',
        roles: ['Lleva la primera copia al archivo', 'Lleva la segunda copia a Nico'],
        dialogue: 'Mara · Aparcad entre ambos destinos. Podéis hacer el último tramo a pie.'
      },
      {
        at: [-584.01, -872.32, 25.85], text: 'Reúnete con el enlace de Little Seoul',
        dialogue: 'Mara · Ambas copias han llegado. Solo nos queda cerrar la investigación con el original.'
      }
    ]
  },
  frecuencia_fantasma: {
    name: 'Frecuencia fantasma', pay: 3200, vehicle: 'granger', type: 'automobile',
    intro: 'Mara · Iria y Nico ya han dado su versión. Queda llevar el original al punto de difusión.',
    stops: [
      {
        at: [821.32, -1045.69, 26.57], text: 'Recoge el original sellado en La Mesa',
        dialogue: 'Mara · Hay dos relevos disponibles. Nico cubre el centro e Iria os espera en la costa.',
        checkpoint: true
      },
      {
        at: [307.19, -765.16, 29.25], text: 'Escoge el relevo del centro o de la costa',
        choice: [
          { at: [307.19, -765.16, 29.25], text: 'Pasa el control de Nico en Mission Row' },
          { at: [-1211.51, -891.25, 12.87], text: 'Pasa el control de Iria en Vespucci' }
        ],
        dialogue: 'Mara · Relevo confirmado. Llevad el original al punto de difusión en Little Seoul.'
      },
      {
        at: [-584.01, -872.32, 25.85], text: 'Entrega el original y confirma la difusión',
        roles: ['Lleva el original hasta Little Seoul', 'Confirma la entrega y avisa a la central'],
        dialogue: 'Mara · Original recibido. Cuando volváis a la central, la frecuencia queda libre.'
      }
    ]
  }
})
