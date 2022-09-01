/**
 * A Fetch function which will automatically add the correct headers for
 * making requests to GitHub application servers
 *
 * ## Example
 *
 *     const onClick = async () => {
 *       const resp = await verifiedFetch('/foo', {method: 'POST'})
 *       if (resp.ok) console.log('The response was', await resp.text())
test.
 *     }
 */
export function verifiedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (path.match(/^https?:/)) {
    throw new Error('Can not make cross-origin requests from verifiedFetch')
  }

  const headers: HeadersInit = {
    ...init.headers,
    'GitHub-Verified-Fetch': 'true',
    'X-Requested-With': 'XMLHttpRequest'
  }

  return fetch(path, {...init, headers})
}

interface JSONRequestInit extends Omit<RequestInit, 'body'> {
  body?: unknown
}

/**
 * A Fetch function which will automatically add the correct headers for
 * making JSON requests
 *
 * Will also `JSON.stringify` the request body if provided.

 * ## Example
 *
 *     const onClick = async () => {
 *       const resp = await verifiedFetchJSON('/foo', {body: {foo: 'bar'}, method: 'POST'})
 *       if (resp.ok) console.log('The response was', await resp.json())
 *     }
 */
export function verifiedFetchJSON(path: string, init?: JSONRequestInit): Promise<Response> {
  const initHeaders: HeadersInit = init?.headers ?? {}

  const headers: HeadersInit = {
    ...initHeaders,
    Accept: 'application/json',
    'Content-Type': 'application/json'
  }

  const body = init?.body ? JSON.stringify(init.body) : undefined

  return verifiedFetch(path, {...init, body, headers})
}
