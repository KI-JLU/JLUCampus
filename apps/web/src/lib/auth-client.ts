import { createAuthClient } from 'better-auth/react'
import { API } from '@justcampus/shared'
import { apiBase } from './api'

/**
 * Better-Auth 1.7 registers generic OAuth providers (Keycloak) as ordinary
 * social providers, so the client needs no plugin: sign-in is
 * `signIn.social({ provider: KEYCLOAK_PROVIDER_ID })`.
 */
export const authClient = createAuthClient({
  baseURL: `${apiBase() || window.location.origin}${API.auth}`
})
