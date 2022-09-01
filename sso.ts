import {dialog} from './details-dialog'
import {fetchSafeDocumentFragment} from './fetch'
// eslint-disable-next-line no-restricted-imports
import {observe} from 'selector-observer'

function waitForDialogClose(dialogEl: HTMLElement): Promise<unknown> {
  return new Promise(resolve => {
    dialogEl.addEventListener('dialog:remove', resolve, {once: true})
  })
}

function setModalStatus(success: boolean) {
  const modal = document.querySelector('.sso-modal')
  if (!modal) return

  modal.classList.remove('success', 'error')

  if (success) modal.classList.add('success')
  else modal.classList.add('error')
}

function updateExpiresAroundTag(expiresAround: string) {
  const expiryTag = document.querySelector('meta[name=sso-expires-around]')
  if (expiryTag) expiryTag.setAttribute('content', expiresAround)
}

// Asks the user to perform single sign-on for the current organization. SSO
// take place in a new window so we'll need to set up a way for the other window
// to tell us when SSO is complete and whether or not it was successful.
async function ssoPrompt() {
  const link = document.querySelector<HTMLLinkElement>('link[rel=sso-modal]')!
  const prompt = await dialog({content: fetchSafeDocumentFragment(document, link.href), dialogClass: 'sso-modal'})

  let sso = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, compat/compat
  const external: any = window.external

  // Expose callback method for the SSO window to invoke with its status when complete.
  external.ssoComplete = function (data: {error: boolean; expiresAround: string}) {
    if (data.error) {
      sso = false
      setModalStatus(sso)
    } else {
      sso = true
      setModalStatus(sso)
      updateExpiresAroundTag(data.expiresAround)
      window.focus()
    }

    // Remove the external function now that it's served its purpose
    external.ssoComplete = null
  }

  await waitForDialogClose(prompt)

  if (!sso) {
    throw new Error('sso prompt canceled')
  }
}

// Watch for modal complete elements. This is shown as the final step of the
// single sign-on process that happens in a separate window. Once we see this
// we know SSO is complete and we can try to tell the original window what the
// status is before closing the SSO window.
observe('.js-sso-modal-complete', function (el) {
  if (window.opener && window.opener.external.ssoComplete) {
    const error = el.getAttribute('data-error')
    const expiresAround = el.getAttribute('data-expires-around')

    window.opener.external.ssoComplete({
      error,
      expiresAround
    })
    window.close()
  } else {
    const fallback = el.getAttribute('data-fallback-url')
    if (fallback) window.location.href = fallback
  }
})

function expiresSoon(expiresTag: Element | null): boolean {
  if (!(expiresTag instanceof HTMLMetaElement)) return true

  const expiresAround = parseInt(expiresTag.content)
  const now = new Date().getTime() / 1000

  return now > expiresAround
}

// Remotely checks the single-sign on status for the current page. If the link tags are
// not present in the <head>, the current page is not enforced and the status is considered good.
async function fetchSsoStatus(): Promise<boolean> {
  const sessionTag = document.querySelector('link[rel=sso-session]')
  const expiryTag = document.querySelector('meta[name=sso-expires-around]')

  if (!(sessionTag instanceof HTMLLinkElement)) return true // No SSO enforcement head tags. SSO not enforced.
  if (!expiresSoon(expiryTag)) return true // Don't bother checking unless we're nearing SSO session expiry

  const url = sessionTag.href
  const response = await fetch(url, {headers: {Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest'}})
  const result: boolean = await response.json()
  return result
}

let activeSsoPrompt: Promise<void> | null = null

function clearActiveSsoPrompt() {
  activeSsoPrompt = null
}

// Checks to see if the user has a valid single sign-on session for the current
// page. If not and the page is enforced, it blocks the callback until the user
// renews their SSO session.
/* eslint-disable-next-line import/no-anonymous-default-export */
export default async function () {
  const sso = await fetchSsoStatus()

  if (!sso) {
    if (!activeSsoPrompt) {
      activeSsoPrompt = ssoPrompt()
        /* eslint-disable-next-line github/no-then */
        .then(clearActiveSsoPrompt)
        /* eslint-disable-next-line github/no-then */
        .catch(clearActiveSsoPrompt)
    }

    await activeSsoPrompt
  }
}
