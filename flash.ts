import {deleteCookie, getCookies} from './cookies'
import {TemplateInstance} from '@github/template-parts'

const ALLOWED_FLASH_COOKIES = ['flash-notice', 'flash-error', 'flash-message', 'flash-warn']

// Find cookies named something like "flash-notice" and render the
// .js-flash-template template for them.
export function displayFlash(el: HTMLTemplateElement) {
  for (const {key, value} of ALLOWED_FLASH_COOKIES.flatMap(getCookies)) {
    deleteCookie(key)
    let message
    try {
      message = atob(decodeURIComponent(value))
    } catch {
      continue
    }
    el.after(new TemplateInstance(el, {className: key, message}))
  }
}
