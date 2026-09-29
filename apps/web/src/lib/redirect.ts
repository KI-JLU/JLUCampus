export interface LoginSearch {
  /** Where to return after signing in. */
  redirect?: string
  /** Set by Better-Auth when the OAuth flow failed. */
  error?: string
}

export function parseLoginSearch(search: Record<string, unknown>): LoginSearch {
  const result: LoginSearch = {}
  if (typeof search.redirect === 'string') result.redirect = search.redirect
  if (typeof search.error === 'string') result.error = search.error
  return result
}

/** Only same-origin paths are followed after sign-in. */
export function safeRedirect(target: string | undefined): string {
  return target && target.startsWith('/') && !target.startsWith('//') ? target : '/'
}
