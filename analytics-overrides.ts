function queryLast<T extends Element>(selector: string): T | undefined {
  const list = document.querySelectorAll<T>(selector)
  if (list.length > 0) {
    return list[list.length - 1]
  }
}

function pagePathname() {
  const locationOverride = queryLast<HTMLMetaElement>('meta[name=analytics-location]')
  if (locationOverride) {
    return locationOverride.content
  } else {
    return window.location.pathname
  }
}

function pageQuery() {
  const stripParams = queryLast<HTMLMetaElement>('meta[name=analytics-location-query-strip]')
  let search = ''

  if (!stripParams) {
    search = window.location.search
  }

  const extraParams = queryLast<HTMLMetaElement>('meta[name=analytics-location-params]')
  if (extraParams) {
    search += (search ? '&' : '?') + extraParams.content
  }

  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name=analytics-param-rename]')) {
    const names = meta.content.split(':', 2)
    search = search.replace(new RegExp(`(^|[?&])${names[0]}($|=)`, 'g'), `$1${names[1]}$2`)
  }

  return search
}

export function requestUri() {
  return `${window.location.protocol}//${window.location.host}${pagePathname() + pageQuery()}`
}
