import { normalizeHrFriend } from './hr-auto-reply.mjs'

export function snapshotMatchesDueMessage(friend, last) {
  return last?.isSelf === false && String(last.mid) === String(friend.lastMessageId)
}

// Full scans back up website message notifications; they never trigger proactive follow-ups.
export function createHrReplyPolling(options = {}) {
  const idleMs = () => (options.idleMinutes ?? 5) * 60000
  const observeMs = () => (options.observeMinutes ?? 5) * 60000
  const intervalMs = () => (options.observeIntervalSeconds ?? 5) * 1000
  let nextScanAt = 0, activeUntil = 0, lastScanAt = null
  const latest = new Map()
  return {
    observe(items, now = Date.now()) {
      const changes = []
      for (const source of items) {
        const item = normalizeHrFriend(source)
        const key = JSON.stringify([item.encryptBossId, item.encryptJobId])
        const signature = JSON.stringify([item.lastMessageId, item.lastIsSelf])
        const previous = latest.get(key)
        latest.set(key, signature)
        if (previous === signature) continue
        changes.push(item)
        if (observeMs() > 0 && !item.lastIsSelf && (previous !== undefined || item.unreadCount > 0)) {
          activeUntil = now + observeMs()
          nextScanAt = Math.min(nextScanAt, now + intervalMs())
        }
      }
      return changes
    },
    shouldScan(now = Date.now()) {
      if (observeMs() <= 0 && activeUntil) {
        activeUntil = 0
        nextScanAt = lastScanAt === null ? 0 : lastScanAt + idleMs()
      }
      if (now < nextScanAt) return false
      lastScanAt = now
      nextScanAt = now + (now < activeUntil ? intervalMs() : idleMs())
      return true
    },
    replied(now = Date.now()) {
      if (observeMs() <= 0) return
      activeUntil = now + observeMs()
      nextScanAt = Math.min(nextScanAt, now + intervalMs())
    }
  }
}

export async function watchHrMessages(page, receive) {
  await page.exposeFunction('__ggrHrMessagesChanged', receive)
  return page.evaluate(() => {
    const chat = document.querySelector('.main-wrap .chat-user')?.__vue__
    if (typeof chat?.$watch !== 'function') return false
    const snapshot = () => (chat.list || []).map(item => Object.fromEntries(['uniqueId', 'encryptBossId', 'encryptJobId', 'lastMessageId', 'lastMsgId', 'lastIsSelf', 'unreadCount', 'lastTS', 'updateTime', 'brandName', 'name', 'title'].map(key => [key, item[key]])))
    chat.$watch(() => JSON.stringify(snapshot()), () => {
      window.__ggrHrMessagesChanged(snapshot()).catch(() => {})
    })
    return true
  })
}
