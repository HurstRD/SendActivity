interface Cookie {
  key: string
  value: string
}

/**
 * Get a cookie by name.
 * @param name
 * @returns a cookie object or undefined if not found.
 */
export function getCookie(name: string): Cookie | undefined {
  return getCookies(name)[0]
}

/**
 * Get all cookies by name.
 * @param name
 * @returns
 */
export function getCookies(name: string): Cookie[] {
  const cookies = []
  for (const cookie of readCookies()) {
    const [key, value] = cookie.trim().split('=')
    if (name === key && typeof value !== 'undefined') {
      cookies.push({key, value})
    }
  }
  return cookies
}

function readCookies(): string[] {
  try {
    return document.cookie.split(';')
  } catch {
    // Cookie access disabled.
    return []
  }
}

/**
 * Set a new cookie with sensible defaults like secure.
 * @param name
 * @param value
 * @param expiration
 * @param strictDomain
 * @param samesite
 */
export function setCookie(
  name: string,
  value: string,
  expiration: string | null = null,
  strictDomain = false,
  samesite = 'lax'
) {
  let domain = document.domain
  if (domain == null) {
    throw new Error('Unable to get document domain')
  }

  // Share cookies with test environments.
  if (domain.endsWith('.github.com')) {
    domain = 'github.com'
  }

  const secure = location.protocol === 'https:' ? '; secure' : ''
  const expire = expiration ? `; expires=${expiration}` : ''
  if (strictDomain === false) {
    domain = `.${domain}`
  }
  try {
    document.cookie = `${name}=${value}; path=/; domain=${domain}${expire}${secure}; samesite=${samesite}`
  } catch {
    // Cookie access disabled.
  }
}

/**
 * Delete a given cookie with sensible defaults like secure.
 * This sets the expires value to a second ago to delete the cookie.
 * @param name
 * @param strictDomain
 */
export function deleteCookie(name: string, strictDomain = false) {
  let domain = document.domain
  if (domain == null) {
    throw new Error('Unable to get document domain')
  }

  // Share cookies with test environments.
  if (domain.endsWith('.github.com')) {
    domain = 'github.com'
  }

  const time = new Date().getTime()
  const expiration = new Date(time - 1).toUTCString()
  const secure = location.protocol === 'https:' ? '; secure' : ''
  const expire = `; expires=${expiration}`
  if (strictDomain === false) {
    domain = `.${domain}`
  }
  try {
    document.cookie = `${name}=''; path=/; domain=${domain}${expire}${secure}`
  } catch {
    // Cookie access disabled.
  }
}
