globalThis.DuoHeist = (() => {
  const signs = ['Órbita', 'Sol', 'Prisma', 'Luna', 'Cometa', 'Anillo']
  const codes = ['AX-17', 'BX-48', 'CX-63']

  function shuffle(values) {
    const result = values.slice()
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
  }

  function puzzle(h, length) {
    h.sequence = shuffle(signs).slice(0,length)
    h.boards = [shuffle(signs), shuffle(signs)]
    h.cursor = 0
  }

  function create() {
    const h = { phase: 'arrival', rev: 0, ready: [false, false], votes: [false,false],
      optional: false, secured: 0, expires: 0,
      emblems: shuffle(signs).slice(0,3), ids: shuffle(codes), target: Math.floor(Math.random()*3) }
    puzzle(h,3)
    return h
  }

  function roleOf(run, player) {
    return Number(run.members.get(player) !== run.leadKey)
  }

  function isEclipse(run) { return run.key === 'proyecto_eclipse' }

  function closeTo(entity, at, radius) {
    if (!entity || !DoesEntityExist(entity)) return false
    const [x,y,z] = GetEntityCoords(entity)
    return Math.hypot(x-at[0], y-at[1], z-at[2]) <= radius
  }

  function inPosition(run, player) {
    const role = roleOf(run,player)
    const ped = GetPlayerPed(player)
    if (!ped || GetEntityHealth(ped) <= 0) return false
    if (isEclipse(run)) {
      const vehicle = role ? run.handler : run.vehicle
      return DoesEntityExist(vehicle) && GetPedInVehicleSeat(vehicle,-1) === ped &&
        closeTo(vehicle, Duo.eclipse.cargo[1], role ? 48 : 100)
    }
    return !GetVehiclePedIsIn(ped,false) && closeTo(ped,run.contract.sites[role],4)
  }

  function target(run, player) {
    const role = roleOf(run,player)
    if (run.step === 2) return { at: isEclipse(run) ? Duo.eclipse.landing : Duo.garage,
      text: isEclipse(run) ? 'Aterrizad juntos con el prototipo en LSIA' : 'Entregad juntos el botín en Pillbox' }
    if (!isEclipse(run)) return { at: run.contract.sites[role], text: 'Acércate a tu terminal y abre F6' }
    const ped = GetPlayerPed(player)
    const vehicle = role ? run.handler : run.vehicle
    if (!DoesEntityExist(vehicle) || GetPedInVehicleSeat(vehicle,-1) !== ped) return { at: DoesEntityExist(vehicle) ? GetEntityCoords(vehicle) : run.contract.sites[role], text: role ? 'Sube a la grúa Handler' : 'Toma el mando del Cargobob' }
    const at = Duo.eclipse.cargo[1]
    return { at: role ? at : [at[0],at[1],at[2]+18], text: role ? 'Acerca la grúa a los contenedores' : 'Sobrevuela la carga y lee los emblemas', air: !role }
  }

  function hint(run,player) {
    const h = run.heist
    const role = roleOf(run,player)
    if (run.step === 2) return target(run,player).text
    if (h.phase === 'hook') return role ? 'Mantén la grúa bajo el helicóptero' : 'Sitúate sobre la grúa y confirma el cable en F6'
    if (h.phase === 'arrival') return h.ready[role] ? 'Puesto listo. Espera al compañero.' : target(run,player).text
    if (h.phase === 'choice') return 'F6 · Asegurad la entrega o votad por la caja extra'
    if (isEclipse(run)) return role ? 'Localiza el ID correcto y engancha con F6' : 'Indica por Teams dónde ves el emblema solicitado'
    if (run.key === 'caja_cierre') return role ? 'Lee la secuencia del terminal a tu compañero' : 'Introduce los símbolos en el dial de F6'
    return h.cursor % 2 === role ? 'Pulsa el símbolo que te indique tu compañero' : 'Lee el eco de tu pantalla al otro puesto'
  }

  function view(run, player) {
    if (!run?.heist || !run.members.has(player) || run.step !== 1) return null
    const h = run.heist
    const role = roleOf(run,player)
    const online = run.members.size === 2
    const positioned = inPosition(run,player)
    const result = { id: run.id, rev: h.rev, title: run.contract.name, role: run.contract.roles[role],
      phase: h.phase, kind: run.key, eclipse: isEclipse(run), slots: run.key === 'camara_ecos' && h.phase === 'play' ? h.boards[role] : [], secured: h.secured, extra: run.contract.extra, hint: hint(run,player),
      reason: !online ? 'Esperando reconexión del compañero.' : !positioned ? 'Ocupa tu puesto para usar la consola.' : '',
      choices: [], readout: [], cursor: h.cursor, length: h.sequence.length }
    if (h.phase === 'hook') {
      result.readout = ['Enganche de carga · '+h.ids[h.target]]
      if (!role) result.choices = [['hook','Acoplar cable']]
    } else if (h.phase === 'arrival') {
      result.readout = h.ready.map((ready,i) => run.contract.roles[i]+' · '+(ready?'listo':'pendiente'))
      if (!h.ready[role]) result.choices = [['ready','Activar mi puesto']]
    } else if (h.phase === 'choice') {
      result.choices = [['leave','Entregar el botín']]
      if (!h.votes[role]) result.choices.push(['extra','Votar por la caja extra'])
      result.readout = ['Votos para continuar · '+h.votes.filter(Boolean).length+'/2']
    } else if (isEclipse(run)) {
      result.readout = role ? ['Prototipo · '+h.emblems[h.target]] : ['Lee los emblemas sobre los contenedores']
      if (role) result.choices = codes.map(code => [code,'Enganchar '+code])
    } else if (run.key === 'caja_cierre' && role) {
      result.readout = h.sequence
    } else if (run.key === 'camara_ecos' && role !== h.cursor % 2) {
      result.readout = ['Eco · '+h.sequence[h.cursor]]
    } else {
      result.choices = h.boards[role].map(sign => [sign,sign])
    }
    return result
  }

  function exitField(run) {
    run.step = 2
    run.heist.expires = 0
    run.dialogue = target(run,run.members.keys().next().value).text
  }

  function expire(run) {
    const h = run.heist
    if (!h.expires || Date.now() < h.expires) return false
    if (h.secured) { exitField(run); return 'return' }
    return 'failed'
  }

  function act(run,player,value) {
    const h = run.heist
    if (run.step !== 1 || run.members.size !== 2 || !run.members.has(player) || value?.id !== run.id) return
    // Independent confirmations from both terminals may arrive on the same revision.
    const parallel = (value.key === 'ready' && h.phase === 'arrival') || (value.key === 'extra' && h.phase === 'choice')
    if (value.rev !== h.rev && !(parallel && value.rev === h.rev-1)) return
    const viewNow = view(run,player)
    if (viewNow.reason) return viewNow.reason
    if (!viewNow.choices.some(([key]) => key === value.key)) return
    const role = roleOf(run,player)
    if (h.phase === 'arrival') {
      if (h.ready[1-role] && ![...run.members.keys()].every(id => inPosition(run,id))) return 'Tu compañero debe volver a su puesto.'
      h.ready[role] = true
      if (h.ready.every(Boolean)) {
        h.phase = 'play'
        h.expires = Date.now() + (isEclipse(run) ? 240 : 120)*1000
      }
    } else if (![...run.members.keys()].every(id => inPosition(run,id))) {
      return 'Ambos debéis estar en vuestro puesto.'
    } else if (h.phase === 'choice') {
      if (value.key === 'leave') exitField(run)
      else {
        h.votes[role] = true
        if (h.votes.every(Boolean)) {
          h.phase = 'play'
          h.optional = true
          puzzle(h,5)
          h.expires = Date.now()+60000
        }
      }
    } else if (h.phase === 'hook') {
      const [x,y,z] = GetEntityCoords(run.vehicle)
      const [cx,cy,cz] = GetEntityCoords(run.handler)
      if (Math.hypot(x-cx,y-cy)>12 || z-cz<4 || z-cz>28) return 'Centra el helicóptero sobre la grúa, entre 4 y 28 m de altura.'
      h.secured = run.contract.pay
      exitField(run)
    } else if (isEclipse(run)) {
      const index = h.ids.indexOf(value.key)
      const at = Duo.eclipse.cargo[index]
      if (!closeTo(run.handler,at,9) || !closeTo(run.vehicle,at,48)) return 'Alinead la grúa y el Cargobob con el contenedor elegido.'
      if (index !== h.target) h.expires -= 12000
      else h.phase = 'hook'
    } else if (value.key !== h.sequence[h.cursor]) {
      h.expires -= 10000
      puzzle(h,h.sequence.length)
      run.dialogue = 'La señal cambió. Leed la nueva combinación.'
    } else {
      h.cursor++
      if (h.cursor === h.sequence.length) {
        h.secured = run.contract.pay
        if (h.optional) {
          run.bonus = run.contract.extra
          h.secured += run.bonus
          exitField(run)
        } else {
          h.phase = 'choice'
          h.expires = Date.now()+45000
        }
      } else if (run.key === 'camara_ecos') h.boards[1-role] = shuffle(signs)
    }
    h.rev++
    return true
  }

  function canDeliver(run) {
    const members = [...run.members.keys()]
    if (members.length !== 2 || !run.heist.secured) return false
    const air = isEclipse(run)
    const at = air ? Duo.eclipse.landing : Duo.garage
    return (!air || Math.abs(GetEntityCoords(run.vehicle)[2]-at[2])<4) && closeTo(run.vehicle,at,air ? 12 : 18) && GetEntitySpeed(run.vehicle) < 2 &&
      members.every(player => {
        const ped = GetPlayerPed(player)
        if (!ped || GetEntityHealth(ped)<=0 || !closeTo(ped,at,air ? 12 : 10)) return false
        if (!air) return true
        return GetVehiclePedIsIn(ped,false) === run.vehicle &&
          (roleOf(run,player) !== 0 || GetPedInVehicleSeat(run.vehicle,-1) === ped)
      })
  }

  function cockpit(run, player) {
    if (!isEclipse(run) || run.step !== 1 || roleOf(run,player) !== 0 || run.members.size !== 2) return null
    const h = run.heist
    const key = h.phase === 'hook' ? 'hook' : h.phase === 'arrival' && !h.ready[0] ? 'ready' : null
    return key ? { id:run.id, rev:h.rev, key } : null
  }

  function cargo(run,player) {
    if (!run?.heist || !isEclipse(run) || run.step < 1) return null
    return { labels: roleOf(run,player) ? run.heist.ids : run.heist.emblems,
      lifted: run.step === 2 || run.heist.phase === 'hook' ? run.heist.target : null,
      onCrane: run.step === 1 && run.heist.phase === 'hook' }
  }
  return { create, view, target, hint, act, expire, cargo, cockpit, canDeliver }
})()
