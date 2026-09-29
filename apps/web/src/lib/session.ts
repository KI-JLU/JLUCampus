import { authClient } from './auth-client'
import { queryClient } from './queries'

export type SignOutResult = { ok: true; providerLogoutUrl?: string } | { ok: false }

/**
 * Ends the Better-Auth session. The server answers with Keycloak's
 * end-session URL when RP-initiated logout is configured; `disableRedirect`
 * keeps the client from following it on its own, so the caller decides
 * (the web app goes there, the desktop app does not).
 */
export async function signOut(): Promise<SignOutResult> {
  const { data, error } = await authClient.signOut({ disableRedirect: true })
  if (error) return { ok: false }
  queryClient.clear()
  return { ok: true, providerLogoutUrl: data?.url ?? undefined }
}
