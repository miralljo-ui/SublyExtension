type DriveFile = {
  id: string
  name?: string
  modifiedTime?: string
}

type DriveFilesListResponse = {
  files?: DriveFile[]
}

type DriveCreateFileResponse = {
  id: string
}

type DriveUploadResponse = {
  id: string
  modifiedTime?: string
}

function isExtension() {
  return typeof chrome !== 'undefined' && !!chrome.identity
}

async function getAuthToken(interactive: boolean): Promise<string> {
  if (!isExtension()) throw new Error('Google Drive backup requires Chrome Extension environment.')

  return await new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      const err = chrome.runtime.lastError
      if (err) {
        reject(new Error(err.message || 'OAuth token error'))
        return
      }
      if (!token) {
        reject(new Error('No OAuth token received'))
        return
      }
      resolve(token)
    })
  })
}

async function removeCachedToken(token: string): Promise<void> {
  if (!isExtension()) return
  await new Promise<void>((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve())
  })
}

async function driveApiRequest<T>(args: {
  token: string
  method: 'GET' | 'POST' | 'PATCH'
  url: string
  body?: unknown
  headers?: Record<string, string>
}): Promise<T> {
  const res = await fetch(args.url, {
    method: args.method,
    headers: {
      Authorization: `Bearer ${args.token}`,
      ...(args.body ? { 'Content-Type': 'application/json' } : {}),
      ...(args.headers ?? {}),
    },
    body: args.body ? JSON.stringify(args.body) : undefined,
  })

  const text = await res.text()
  if (!res.ok) {
    const msg = text || `${res.status} ${res.statusText}`
    throw new Error(msg)
  }
  return (text ? (JSON.parse(text) as T) : (undefined as T))
}

async function driveMediaRequest(args: {
  token: string
  method: 'GET' | 'PATCH'
  url: string
  body?: string
  contentType?: string
}): Promise<{ text: string; headers: Headers }> {
  const res = await fetch(args.url, {
    method: args.method,
    headers: {
      Authorization: `Bearer ${args.token}`,
      ...(args.method === 'PATCH'
        ? { 'Content-Type': args.contentType ?? 'application/octet-stream' }
        : {}),
    },
    body: args.body,
  })

  const text = await res.text()
  if (!res.ok) {
    const msg = text || `${res.status} ${res.statusText}`
    throw new Error(msg)
  }

  return { text, headers: res.headers }
}

const DEFAULT_BACKUP_NAME = 'subly-state.json'

export type DriveBackupResult = {
  fileId: string
  modifiedTime?: string
}

async function findBackupFileId(token: string, name: string): Promise<DriveBackupResult | null> {
  const q = [`name='${name.replace(/'/g, "\\'")}'`, 'trashed=false'].join(' and ')
  const url = new URL('https://www.googleapis.com/drive/v3/files')
  url.searchParams.set('spaces', 'appDataFolder')
  url.searchParams.set('q', q)
  url.searchParams.set('pageSize', '5')
  url.searchParams.set('fields', 'files(id,name,modifiedTime)')

  const list = await driveApiRequest<DriveFilesListResponse>({
    token,
    method: 'GET',
    url: url.toString(),
  })

  const file = (list.files ?? [])[0]
  if (!file?.id) return null
  return { fileId: file.id, modifiedTime: file.modifiedTime }
}

async function createBackupFile(token: string, name: string): Promise<DriveBackupResult> {
  const created = await driveApiRequest<DriveCreateFileResponse>({
    token,
    method: 'POST',
    url: 'https://www.googleapis.com/drive/v3/files',
    body: {
      name,
      parents: ['appDataFolder'],
      mimeType: 'application/json',
    },
  })
  return { fileId: created.id }
}

async function uploadBackupFile(token: string, fileId: string, json: string): Promise<DriveBackupResult> {
  const url = new URL(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}`)
  url.searchParams.set('uploadType', 'media')
  url.searchParams.set('fields', 'id,modifiedTime')

  const res = await driveMediaRequest({
    token,
    method: 'PATCH',
    url: url.toString(),
    body: json,
    contentType: 'application/json; charset=utf-8',
  })

  const parsed = res.text ? (JSON.parse(res.text) as DriveUploadResponse) : ({ id: fileId } as DriveUploadResponse)
  return { fileId: parsed.id || fileId, modifiedTime: parsed.modifiedTime }
}

async function downloadBackupFile(token: string, fileId: string): Promise<{ jsonText: string }> {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`)
  url.searchParams.set('alt', 'media')
  const res = await driveMediaRequest({ token, method: 'GET', url: url.toString() })
  return { jsonText: res.text }
}

export async function driveSaveAppStateJson(args: {
  json: string
  fileId?: string
  fileName?: string
  interactive?: boolean
}): Promise<DriveBackupResult> {
  const interactive = args.interactive ?? true
  const name = String(args.fileName || DEFAULT_BACKUP_NAME).trim() || DEFAULT_BACKUP_NAME

  let token: string | undefined
  try {
    token = await getAuthToken(interactive)

    let fileId = args.fileId
    let modifiedTime: string | undefined

    if (!fileId) {
      const found = await findBackupFileId(token, name)
      if (found) {
        fileId = found.fileId
        modifiedTime = found.modifiedTime
      }
    }

    if (!fileId) {
      const created = await createBackupFile(token, name)
      fileId = created.fileId
    }

    const uploaded = await uploadBackupFile(token, fileId, args.json)
    return { fileId: uploaded.fileId, modifiedTime: uploaded.modifiedTime ?? modifiedTime }
  } catch (e) {
    if (token) await removeCachedToken(token)
    throw e
  }
}

export async function driveLoadAppStateJson(args: {
  fileId?: string
  fileName?: string
  interactive?: boolean
}): Promise<{ fileId: string; modifiedTime?: string; jsonText: string }> {
  const interactive = args.interactive ?? true
  const name = String(args.fileName || DEFAULT_BACKUP_NAME).trim() || DEFAULT_BACKUP_NAME

  let token: string | undefined
  try {
    token = await getAuthToken(interactive)

    let fileId = args.fileId
    let modifiedTime: string | undefined

    if (!fileId) {
      const found = await findBackupFileId(token, name)
      if (!found) throw new Error('No backup file found in Drive app data.')
      fileId = found.fileId
      modifiedTime = found.modifiedTime
    }

    const { jsonText } = await downloadBackupFile(token, fileId)
    return { fileId, modifiedTime, jsonText }
  } catch (e) {
    if (token) await removeCachedToken(token)
    throw e
  }
}
