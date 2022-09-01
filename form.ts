// eslint-disable-next-line no-restricted-imports
import {on} from 'delegated-events'
import {persistSubmitButtonValue} from './remote-submit'
import {showGlobalError} from './behaviors/ajax-error'

type TextField = HTMLInputElement | HTMLTextAreaElement
type Button = HTMLInputElement | HTMLButtonElement

on('click', '.js-remote-submit-button', async function (event) {
  const button = event.currentTarget as HTMLButtonElement
  const form = button.form as HTMLFormElement
  event.preventDefault()
  let response
  try {
    response = await fetch(form.action, {
      method: form.method,
      body: new FormData(form),
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
  } catch {
    // Ignore network errors
  }
  if (response && !response.ok) {
    showGlobalError()
  }
})

function fire(target: HTMLElement, name: string, cancelable: boolean): boolean {
  return target.dispatchEvent(
    new CustomEvent(name, {
      bubbles: true,
      cancelable
    })
  )
}

// Submit a form while ensuring that `submit` event is also triggered.
//
// Calling native `form.submit()` method immediately submits the form without triggering the `submit` event.
// As a result, code that wants to hook into form submits would never execute.
//
// This method first triggers the `submit` event and, if that event wasn't `preventDefault`d, submits the
// form natively.
export function requestSubmit(form: HTMLFormElement, submitter?: Button) {
  if (submitter) {
    checkButtonValidity(form, submitter)
    persistSubmitButtonValue(submitter)
  }
  if (fire(form, 'submit', true)) {
    form.submit()
  }
}

// Check submitter validity for form.requestSubmit compatibility.
// See https://html.spec.whatwg.org/#dom-form-requestsubmit.
function checkButtonValidity(form: HTMLFormElement, submitter: Button) {
  if (!(form instanceof HTMLFormElement)) throw new TypeError('The specified element is not of type HTMLFormElement.')
  if (!(submitter instanceof HTMLElement)) throw new TypeError('The specified element is not of type HTMLElement.')
  if (submitter.type !== 'submit') throw new TypeError('The specified element is not a submit button.')
  if (!form || form !== submitter.form) throw new Error('The specified element is not owned by the form element.')
}

// Set a form field value while ensuring that `change` event is also triggered.
//
// Having the `change` event fire is important for various behaviors to react, such as form validation.
export function changeValue(input: TextField, value: string | boolean) {
  if (typeof value === 'boolean') {
    if (input instanceof HTMLInputElement) {
      input.checked = value
    } else {
      throw new TypeError('only checkboxes can be set to boolean value')
    }
  } else {
    if (input.type === 'checkbox') {
      throw new TypeError("checkbox can't be set to string value")
    } else {
      input.value = value
    }
  }
  fire(input, 'change', false)
}

// Fill multiple form fields by item name.
export function fillFormValues(form: HTMLFormElement, fields: {[key: string]: string}) {
  for (const name in fields) {
    const value = fields[name]
    const element = form.elements.namedItem(name)

    if (element instanceof HTMLInputElement) {
      element.value = value
    } else if (element instanceof HTMLTextAreaElement) {
      element.value = value
    }
  }
}

// Test if element is a form field.
export function isFormField(element: Node): boolean {
  if (!(element instanceof HTMLElement)) {
    return false
  }

  const name = element.nodeName.toLowerCase()
  const type = (element.getAttribute('type') || '').toLowerCase()
  return (
    name === 'select' ||
    name === 'textarea' ||
    (name === 'input' && type !== 'submit' && type !== 'reset') ||
    element.isContentEditable
  )
}

function searchParamsFromFormData(formData: FormData): URLSearchParams {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new URLSearchParams(formData as any)
}

// Get a `?` search string for a URL for a GET form, using its `action` attribute as well as its other fields.
export function combineGetFormSearchParams(formAction: URL, formData: FormData): string {
  const allSearchParams = new URLSearchParams(formAction.search)
  const searchParamsFromInputs = searchParamsFromFormData(formData)
  for (const [key, value] of searchParamsFromInputs) {
    allSearchParams.append(key, value)
  }
  return allSearchParams.toString()
}

// Serialize form data into string.
export function serialize(form: HTMLFormElement): string {
  return searchParamsFromFormData(new FormData(form)).toString()
}
