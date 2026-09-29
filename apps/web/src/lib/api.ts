import { apiErrorSchema, type ApiError, type ApiErrorCode } from '@justcampus/shared'

/** API origin: the desktop bridge's, else the build's, else same origin. */
export function apiBase(): string {
  return window.justCampus?.apiUrl ?? import.meta.env.VITE_API_URL ?? ''
}

/** A non-2xx response. `body` is the shared error shape when the server sent one. */
export class ApiRequestError extends Error {
  readonly status: number
  readonly body: ApiError | null

  constructor(status: number, body: ApiError | null) {
    super(body?.error.message ?? `Request failed with status ${status}`)
    this.name = 'ApiRequestError'
    this.status = status
    this.body = body
  }

  get code(): ApiErrorCode | undefined {
    return this.body?.error.code
  }
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 401
}

interface ApiFetchInit extends Omit<RequestInit, 'body'> {
  /** Sent as the JSON request body. */
  json?: unknown
}

export async function apiFetch<T>(path: string, init: ApiFetchInit = {}): Promise<T> {
  const { json, headers: initHeaders, ...rest } = init
  const headers = new Headers(initHeaders)
  headers.set('Accept', 'application/json')
  if (json !== undefined) headers.set('Content-Type', 'application/json')

  const response = await fetch(`${apiBase()}${path}`, {
    ...rest,
    headers,
    body: json === undefined ? undefined : JSON.stringify(json),
    credentials: 'include'
  })

  const text = response.status === 204 ? '' : await response.text()
  const data: unknown = text ? parseJson(text) : undefined

  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(data)
    throw new ApiRequestError(response.status, parsed.success ? parsed.data : null)
  }
  return data as T
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
