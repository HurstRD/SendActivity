import {loaded} from './document-ready'

let stats: PlatformBrowserStat[] = []

export function sendStats(stat: PlatformBrowserStat, flushImmediately = false): void {
  if (stat.timestamp === undefined) stat.timestamp = new Date().getTime()
  stat.loggedIn = isLoggedIn()
  stat.staff = isStaff()
  stats.push(stat)

  if (flushImmediately) {
    flushStats()
  } else {
    scheduleSendStats()
  }
}

let queued: number | null = null

async function scheduleSendStats() {
  await loaded
  if (queued == null) {
    queued = window.requestIdleCallback(flushStats)
  }
}

function flushStats() {
  queued = null
  if (!stats.length) {
    return
  }

  const url = document.head?.querySelector<HTMLMetaElement>('meta[name="browser-stats-url"]')?.content
  if (!url) {
    return
  }

  const data = JSON.stringify({stats})
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, data)
    }
  } catch {
    // Silently ignore errors: https://github.com/github/github/issues/178088#issuecomment-829936461
  }
  stats = []
}

function isLoggedIn(): boolean {
  return !!document.head?.querySelector<HTMLMetaElement>('meta[name="user-login"]')?.content
}

function isStaff(): boolean {
  return !!document.head?.querySelector<HTMLMetaElement>('meta[name="user-staff"]')?.content
}

// Flush stats before users navigate away from the page
document.addEventListener('pagehide', flushStats)
document.addEventListener('visibilitychange', flushStats)
