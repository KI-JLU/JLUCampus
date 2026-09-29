import {
  COMPONENT_SECRETS,
  type AdminComponent,
  type ComponentInput,
  type ComponentType
} from '@justcampus/shared'

/** What the admin form holds for one secret: a new value typed in, or the removal of the saved one. */
export interface SecretDraft {
  value: string
  remove: boolean
}

/** Drafts keyed by secret; a secret without a draft stays as it is. */
export type SecretDrafts = Partial<Record<string, SecretDraft>>

/** A secret change as `componentInputSchema` takes it: a string sets it, `null` removes it. */
export type SecretsPatch = Record<string, string | null>

/** The secrets a component type keeps, in `COMPONENT_SECRETS` order. */
export function secretKeysOf(type: ComponentType): readonly string[] {
  return COMPONENT_SECRETS[type]
}

/**
 * Only changed secrets go into the input: a typed value sets the secret, a
 * marked removal clears it, and an empty field keeps what is saved. `undefined`
 * when nothing changes, so the input can leave `secrets` out altogether.
 */
export function secretsPatch(
  keys: readonly string[],
  drafts: SecretDrafts
): SecretsPatch | undefined {
  const patch: SecretsPatch = {}
  for (const key of keys) {
    const draft = drafts[key]
    if (!draft) continue
    if (draft.remove) patch[key] = null
    else if (draft.value.trim()) patch[key] = draft.value
  }
  return Object.keys(patch).length > 0 ? patch : undefined
}

/**
 * What saving the form will do to one secret. `saved` and `unset` are the
 * state on the server; the others describe the pending change.
 */
export type SecretStatus = 'saved' | 'unset' | 'replace' | 'set' | 'remove'

export function secretStatus(isSet: boolean, draft: SecretDraft | undefined): SecretStatus {
  if (draft?.remove && isSet) return 'remove'
  if (draft?.value.trim()) return isSet ? 'replace' : 'set'
  return isSet ? 'saved' : 'unset'
}

/** Whether a component's secret is set on the server. Components of other types have none. */
export function isSecretSet(component: AdminComponent | null, key: string): boolean {
  if (!component) return false
  const secrets: Partial<Record<string, boolean>> = component.secrets
  return secrets[key] === true
}

/**
 * A listed component as it will be after `input` is saved, for optimistic
 * updates. The status of each secret follows the input's changes; the secret
 * values themselves never reach the list.
 */
export function applyComponentInput(
  component: AdminComponent,
  input: ComponentInput
): AdminComponent {
  const secrets: Record<string, boolean> = { ...component.secrets }
  const changes: Partial<Record<string, string | null>> =
    ('secrets' in input ? input.secrets : undefined) ?? {}
  for (const [key, change] of Object.entries(changes)) {
    if (change !== undefined && Object.hasOwn(secrets, key)) secrets[key] = change !== null
  }
  return { ...component, ...input, secrets } as AdminComponent
}
