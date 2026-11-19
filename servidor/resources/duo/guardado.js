globalThis.DuoStore = (() => {
  const fs = require('fs')
  const path = require('path')
  const { randomUUID } = require('crypto')
  const root = GetResourcePath(GetCurrentResourceName())
  const profilePattern = /^perfil-[0-9a-f]+\.json$/
  const payoutPattern = /^pago-[0-9a-f-]+\.json$/

  function read(file) {
    try {
      return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, ''))
    } catch (error) {
      if (error.code === 'ENOENT') return undefined
      return null
    }
  }

  function write(file, value) {
    const target = path.join(root, file)
    const temporary = target + '.' + randomUUID() + '.tmp'
    try {
      const handle = fs.openSync(temporary, 'wx')
      try {
        fs.writeFileSync(handle, JSON.stringify(value), 'utf8')
        fs.fsyncSync(handle)
      } finally {
        fs.closeSync(handle)
      }
      fs.renameSync(temporary, target)
      return true
    } catch (error) {
      try { fs.unlinkSync(temporary) } catch {}
      console.error('[duo] No se pudo guardar ' + file.split('-')[0] + ' (' + (error.code || 'EIO') + ').')
      return false
    }
  }

  function load(key) {
    if (!profilePattern.test(key || '')) return null
    const valid = value => value && Number.isSafeInteger(value.cash) && value.cash >= 0 &&
      Number.isSafeInteger(value.completed) && value.completed >= 0
    const saved = read(key)
    const backup = valid(saved) ? undefined : read(key.replace('.json', '.bak.json'))
    const data = valid(saved) ? saved : valid(backup) ? backup :
      saved === undefined && backup === undefined ? { cash: 500, completed: 0 } : null
    if (!data) return null
    return {
      ...data,
      cars: data.cars && typeof data.cars === 'object' && !Array.isArray(data.cars)
        ? data.cars : { blista: 'grafito' },
      bestRally: data.bestRally || 0,
      campaign: Array.isArray(data.campaign) ? data.campaign : [],
      receipts: Array.isArray(data.receipts) ? data.receipts : []
    }
  }

  function save(key, data) {
    if (!profilePattern.test(key || '') || !write(key, data)) return false
    write(key.replace('.json', '.bak.json'), data)
    return true
  }

  function record(id, payout) {
    const file = 'pago-' + id + '.json'
    return payoutPattern.test(file) && write(file, payout)
  }

  function settle(file) {
    if (!payoutPattern.test(file)) return []
    const payout = read(file)
    if (!payout || !Array.isArray(payout.entries) || !Number.isSafeInteger(payout.pay) || payout.pay < 0) return []
    const settled = []
    const receipt = file.slice(5, -5)
    let pending = false
    for (const entry of payout.entries) {
      const data = load(entry.key)
      if (!data) {
        pending = true
        continue
      }
      if (data.receipts.includes(receipt)) continue
      data.cash += payout.pay
      data.completed++
      data.receipts.push(receipt)
      if (entry.campaign && !data.campaign.includes(entry.campaign)) data.campaign.push(entry.campaign)
      const record = payout.rallyTime && (!data.bestRally || payout.rallyTime < data.bestRally)
      if (record) data.bestRally = payout.rallyTime
      if (save(entry.key, data)) settled.push({ key: entry.key, cash: data.cash, record, pay: payout.pay, name: payout.name })
      else pending = true
    }
    if (!pending) {
      try { fs.unlinkSync(path.join(root, file)) } catch {}
    }
    return settled
  }

  function recover() {
    try {
      return fs.readdirSync(root).filter(name => payoutPattern.test(name)).flatMap(settle)
    } catch (error) {
      console.error('[duo] No se pudieron revisar los pagos (' + (error.code || 'EIO') + ').')
      return []
    }
  }

  return { load, save, record, settle, recover, id: randomUUID }
})()
