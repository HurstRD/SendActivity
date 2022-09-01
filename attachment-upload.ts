import type {Attachment} from '@github/file-attachment-element'
import {sendStats} from '../stats'

export type UploadError = {
  status: number
  body: string
}

// 204 No Content
type S3ResponseData = Record<string, unknown>

// 201 Created
type EnterpriseResponseData = {
  id: number
  href: string
}

type UploadResponseData = EnterpriseResponseData | S3ResponseData

type S3UploadPolicy = {
  asset_upload_url: string
  asset_upload_authenticity_token: string
  upload_authenticity_token: string
  upload_url: string
  form: Record<string, string>
  header: Record<string, string>
  same_origin: boolean
  asset: {
    id: number
    href: string
    name: string
  }
}

type EnterpriseUploadPolicy = {
  upload_authenticity_token: string
  upload_url: string
  form: {[key: string]: string}
  header: Record<string, string>
  same_origin: boolean
  asset: {
    name: string
  }
}

export type UploadPolicyData = S3UploadPolicy | EnterpriseUploadPolicy

export type AttachmentUploadDelegate = {
  attachmentUploadDidStart(attachment: Attachment, policy: UploadPolicyData): void
  attachmentUploadDidProgress(attachment: Attachment, percent: number): void
  attachmentUploadDidComplete(attachment: Attachment, policy: UploadPolicyData, data: UploadResponseData): void
  attachmentUploadDidError(attachment: Attachment, error: UploadError): void
}

export default class AttachmentUpload {
  attachment: Attachment
  policy: UploadPolicyData

  constructor(attachment: Attachment, policy: UploadPolicyData) {
    this.attachment = attachment
    this.policy = policy
  }

  async process(delegate: AttachmentUploadDelegate): Promise<void> {
    const startTime = window.performance.now()
    const headers = new Headers(this.policy.header || {})

    const xhr = new XMLHttpRequest()
    xhr.open('POST', this.policy.upload_url, true)

    for (const [key, value] of headers) {
      xhr.setRequestHeader(key, value)
    }

    xhr.onloadstart = () => {
      delegate.attachmentUploadDidStart(this.attachment, this.policy)
    }

    xhr.upload.onprogress = e => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100)
        delegate.attachmentUploadDidProgress(this.attachment, percent)
      }
    }

    await send(xhr, uploadForm(this.attachment, this.policy))

    if (xhr.status === 204) {
      markComplete(this.policy)
      delegate.attachmentUploadDidComplete(this.attachment, this.policy, {})
    } else if (xhr.status === 201) {
      markComplete(this.policy)
      delegate.attachmentUploadDidComplete(this.attachment, this.policy, JSON.parse(xhr.responseText))
    } else {
      delegate.attachmentUploadDidError(this.attachment, {status: xhr.status, body: xhr.responseText})
    }

    const endTime = window.performance.now()
    const timeDiff = endTime - startTime
    const uploadTiming: PlatformBrowserPerformanceUploadTiming = {
      duration: timeDiff,
      size: this.attachment?.file?.size,
      fileType: this.attachment?.file?.type,
      success: xhr.status === 204 || xhr.status === 201
    }
    sendStats({uploadTiming}, true)
  }
}

function send(xhr: XMLHttpRequest, body: FormData): Promise<XMLHttpRequest> {
  return new Promise((resolve, reject) => {
    xhr.onload = () => resolve(xhr)
    xhr.onerror = reject
    xhr.send(body)
  })
}

function uploadForm(attachment: Attachment, policy: UploadPolicyData): FormData {
  const form = new FormData()
  if (policy.same_origin) {
    // eslint-disable-next-line github/authenticity-token
    form.append('authenticity_token', policy.upload_authenticity_token)
  }
  for (const key in policy.form) {
    form.append(key, policy.form[key])
  }
  form.append('file', attachment.file)
  return form
}

function markComplete(policy: UploadPolicyData) {
  /* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
  // @ts-ignore
  const url = typeof policy.asset_upload_url === 'string' ? policy.asset_upload_url : null
  const token =
    /* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
    // @ts-ignore
    typeof policy.asset_upload_authenticity_token == 'string' ? policy.asset_upload_authenticity_token : null

  if (!(url && token)) return

  const form = new FormData()
  // eslint-disable-next-line github/authenticity-token
  form.append('authenticity_token', token)

  fetch(url, {
    method: 'PUT',
    body: form,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    }
  })
}
