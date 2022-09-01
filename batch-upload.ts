import type {Attachment, default as FileAttachmentElement} from '@github/file-attachment-element'
import type {AttachmentUploadDelegate, UploadError, UploadPolicyData} from './attachment-upload'

import AttachmentUpload from './attachment-upload'
import type Batch from './batch'
// eslint-disable-next-line no-restricted-imports
import {fire} from 'delegated-events'

export async function upload(batch: Batch, container: FileAttachmentElement) {
  const delegate = createDelegate(batch, container)
  for (const attachment of batch.attachments) {
    const policy = await validate(batch, attachment, container)
    if (!policy) return
    try {
      const uploader = new AttachmentUpload(attachment, policy)
      await uploader.process(delegate)
    } catch {
      fire(container, 'upload:error', {batch, attachment})
      resetState(container, 'is-failed')
      return
    }
  }
}

async function validate(batch: Batch, attachment: Attachment, container: Element): Promise<UploadPolicyData | null> {
  const form = policyForm(attachment, container)
  const preprocess: Array<Promise<unknown>> = []
  fire(container, 'upload:setup', {batch, attachment, form, preprocess})

  try {
    await Promise.all(preprocess)
    const response = await fetch(policyRequest(form, container))
    if (response.ok) {
      return await response.json()
    }
    fire(container, 'upload:invalid', {batch, attachment})
    const body = await response.text()
    const status = response.status
    const {state, messaging} = policyErrorState({status, body}, attachment.file)
    resetState(container, state, messaging)
  } catch {
    fire(container, 'upload:invalid', {batch, attachment})
    resetState(container, 'is-failed')
  }
  return null
}

function policyForm(attachment: Attachment, container: Element): FormData {
  const token = container.querySelector<HTMLInputElement>('.js-data-upload-policy-url-csrf')!.value
  const repoId = container.getAttribute('data-upload-repository-id')
  const subjectType = container.getAttribute('data-subject-type')
  const subject = container.getAttribute('data-subject-param')
  const file = attachment.file

  const form = new FormData()
  form.append('name', file.name)
  form.append('size', String(file.size))
  form.append('content_type', file.type)
  // eslint-disable-next-line github/authenticity-token
  form.append('authenticity_token', token)
  if (subjectType) form.append('subject_type', subjectType)
  if (subject) form.append('subject', subject)
  if (repoId) {
    form.append('repository_id', repoId)
  }
  if (attachment.directory) {
    form.append('directory', attachment.directory)
  }

  return form
}

function policyRequest(form: FormData, container: Element): Request {
  return new Request(container.getAttribute('data-upload-policy-url')!, {
    method: 'POST',
    body: form,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    }
  })
}

function createDelegate(batch: Batch, container: Element): AttachmentUploadDelegate {
  return {
    attachmentUploadDidStart(attachment, policy) {
      attachment.saving(0)
      resetState(container, 'is-uploading')
      fire(container, 'upload:start', {batch, attachment, policy})
    },
    attachmentUploadDidProgress(attachment, percent) {
      attachment.saving(percent)
      fire(container, 'upload:progress', {batch, attachment})
    },
    attachmentUploadDidComplete(attachment, policy, result) {
      attachment.saved(savedAttributes(result, policy))
      fire(container, 'upload:complete', {batch, attachment})
      if (batch.isFinished()) {
        resetState(container, 'is-default')
      }
    },
    attachmentUploadDidError(attachment, response) {
      fire(container, 'upload:error', {batch, attachment})
      const {state} = policyErrorState(response)
      resetState(container, state)
    }
  }
}

// Extracts the uploaded attachment's attributes that reference the stored
// file on the server. These can come from the upload response in the case of
// our Enterprise Alambic file server or from the initial policy creation,
// prior to file upload, in the case of Amazon S3 used by github.com.
function savedAttributes(
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  result: any,
  policy: UploadPolicyData
): {id: string | null; href: string | null; name: string | null} {
  const id =
    /* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
    // @ts-ignore
    (result.id == null ? null : String(result.id)) || (policy.asset.id == null ? null : String(policy.asset.id))
  const href =
    (typeof result.href === 'string' ? result.href : null) ||
    /* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
    // @ts-ignore
    (typeof policy.asset.href === 'string' ? policy.asset.href : null)
  return {id, href, name: policy.asset.name}
}

type PolicyErrorMessaging = {
  message: string
  target: string
}

type PolicyErrorState = {
  state: string
  messaging?: PolicyErrorMessaging
}

// Create a CSS class name that matches the errors coming from the policy
// POST. The /upload/policies/* resource returns a 422 response with a JSON
// body describing why the policy is invalid.
function policyErrorState(response: UploadError, file?: File): PolicyErrorState {
  // Amazon S3 error.
  if (response.status === 400) {
    return {state: 'is-bad-file'}
  }

  if (response.status !== 422) {
    return {state: 'is-failed'}
  }

  const hash = JSON.parse(response.body)

  // If we have the expected JSON response with errors key, try to find the right
  // error message. If there's a server-side error or user got logged out, we
  // won't have hash.errors, so skip this and return generic failure message.
  if (!hash || !hash.errors) {
    return {state: 'is-failed'}
  }

  for (const error of hash.errors) {
    switch (error.field) {
      case 'size': {
        const size = file ? file.size : null
        if (size != null && size === 0) {
          return {state: 'is-empty'}
        }
        return {
          state: 'is-too-big',
          messaging: {
            message: trimSizeErrorMessage(error.message),
            target: '.js-upload-too-big'
          }
        }
      }
      case 'file_count':
        return {state: 'is-too-many'}
      case 'width':
      case 'height':
        return {state: 'is-bad-dimensions'}
      case 'name':
        if (error.code === 'already_exists') {
          return {state: 'is-duplicate-filename'}
        }
        return {state: 'is-bad-file'}
      case 'content_type':
        return {state: 'is-bad-file'}
      case 'uploader_id':
        return {state: 'is-bad-permissions'}
      case 'repository_id':
        return {state: 'is-repository-required'}
      case 'format':
        return {state: 'is-bad-format'}
    }
  }
  return {state: 'is-failed'}
}

/**
Due to limitations on the server, size errors may be returned with the string
'size ' prepended on the error message we want from the server. If the message
starts with `size` then chop it off with its leading space and return the error
we want from the server.

Examples:

'size Yowza that's a big file' => 'Yowza that's a big file'
'Yowza that's a big file' => 'Yowza that's a big file'
 */
const trimSizeErrorMessage = (message: string) => {
  return message.startsWith('size') ? message.substring(5) : message
}

const possibleStates = [
  'is-default',
  'is-uploading',
  'is-bad-file',
  'is-duplicate-filename',
  'is-too-big',
  'is-too-many',
  'is-hidden-file',
  'is-failed',
  'is-bad-dimensions',
  'is-empty',
  'is-bad-permissions',
  'is-repository-required',
  'is-bad-format'
]

export function resetState(container: Element, state: string, messaging?: PolicyErrorMessaging) {
  if (messaging) {
    const {message, target} = messaging
    const el = container.querySelector(target)
    if (el) el.innerHTML = message
  }
  container.classList.remove(...possibleStates)
  container.classList.add(state)
}
