Duo.operations = ['doble_baliza', 'relevo_nocturno', 'salida_coordinada']

const teamBriefing = { at: Duo.base, text: 'Confirma tu salida en el tablón del cuartel', briefing: true }

Object.assign(Duo.briefs, {
  doble_baliza: ['Operación para dos', 'Registrad dos balizas del lago dentro de la misma ventana de señal.'],
  relevo_nocturno: ['Operación para dos', 'Trasladad un registro al aeródromo intercambiando los papeles a mitad del recorrido.'],
  salida_coordinada: ['Operación para dos', 'Elegid la salida del puerto y acompañad la furgoneta hasta el puesto de recepción.']
})

Object.assign(Duo.contracts, {
  doble_baliza: {
    name: 'Doble baliza', pay: 1900, vehicle: 'bison', type: 'automobile', duoOnly: true,
    area: 'Sandy Shores y lago Álamo', vehicleName: 'Bravado Bison',
    roles: ['Equipo de orilla', 'Equipo de pista'],
    intro: 'Central · Dividid el trabajo al llegar al lago. Tenéis 25 segundos entre una confirmación y la otra.',
    stops: [
      teamBriefing,
      { at: [1731.73, 3710.04, 34.14], text: 'Recoged el equipo de señal en Sandy Shores', checkpoint: true },
      {
        at: [1530.70, 3798.30, 32.10], text: 'Sincronizad las balizas junto al lago',
        paired: { seconds: 25, sites: [
          { at: [1530.70, 3798.30, 32.10], text: 'Confirma la baliza de la orilla' },
          { at: [1553.53, 3814.67, 30.85], text: 'Confirma la baliza del almacén' }
        ] },
        dialogue: 'Central · Señal registrada. Entregad la lectura en el aeródromo.'
      },
      { at: [1735.69, 3302.90, 41.22], text: 'Entregad la lectura en el aeródromo' }
    ]
  },
  relevo_nocturno: {
    name: 'Relevo nocturno', pay: 2250, vehicle: 'granger', type: 'automobile', duoOnly: true,
    area: 'Grapeseed y aeródromo de Sandy Shores', vehicleName: 'Declasse Granger',
    roles: ['Piloto del primer tramo', 'Piloto del segundo tramo'],
    intro: 'Central · Uno conduce hasta Sandy Shores y el otro lleva el envío al aeródromo. El copiloto confirma cada relevo.',
    stops: [
      teamBriefing,
      { at: [1685.18, 4919.15, 42.08], text: 'Recoged el manifiesto en Grapeseed', checkpoint: true },
      {
        at: [1731.73, 3710.04, 34.14], text: 'Registrad el primer conductor y cambiad de asiento',
        relay: true, roles: ['Conduce el primer tramo', 'Confirma el relevo y toma el volante']
      },
      {
        at: [1735.69, 3302.90, 41.22], text: 'Entregad el manifiesto con el segundo conductor',
        relay: true, roles: ['Confirma la entrega desde el asiento de copiloto', 'Conduce hasta el aeródromo']
      }
    ]
  },
  salida_coordinada: {
    name: 'Salida coordinada', pay: 2600, vehicle: 'granger', type: 'automobile', duoOnly: true,
    area: 'Terminal del puerto', vehicleName: 'Declasse Granger',
    roles: ['Conducción y escolta', 'Navegación y contacto'],
    intro: 'Central · El copiloto elige el acceso al puerto en F6. Una vez allí, buscad la furgoneta de reparto.',
    stops: [
      teamBriefing,
      {
        at: [823.06, -2988.17, 5.90], text: 'El copiloto elige el acceso en F6',
        choice: [
          { at: [823.06, -2988.17, 5.90], text: 'Entra por el acceso principal' },
          { at: [1151.52, -3305.59, 5.90], text: 'Entra por el acceso de la terminal' }
        ], checkpoint: true
      },
      { at: [887.44, -3204.20, 5.90, 90], text: 'Confirmad la salida de la furgoneta', escort: 'burrito' },
      {
        at: [807.46, -2992.10, 5.90], text: 'Acompañad la furgoneta hasta recepción',
        roles: ['Mantén el coche cerca de la furgoneta', 'Confirma la llegada de la furgoneta']
      }
    ]
  }
})
