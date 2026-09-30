const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Whether a request may change state. The session cookie is `SameSite=None` (the desktop app
 * and a separately hosted web app need it), so any site could send a signed-in user's browser
 * to the API. CORS only hides the answer: simple requests (form posts, multipart uploads,
 * `text/plain` bodies) still arrive. Browsers send `Origin` with every such request, so a
 * state-changing request must come from a trusted origin; one without `Origin` is not from a
 * browser page and carries no ambient session to abuse.
 */
export function isTrustedRequest(
  method: string,
  origin: string | undefined,
  trusted: readonly string[]
): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return true
  if (origin === undefined) return true
  return trusted.includes(origin)
}
