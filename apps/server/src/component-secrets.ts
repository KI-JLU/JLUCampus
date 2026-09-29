import { isSingletonType, type ComponentType } from '@justcampus/shared'

export type StoredSecrets = Record<string, string>
export type SecretPatch = Record<string, string | null | undefined>

export function applySecretsPatch(
  stored: StoredSecrets,
  patch: SecretPatch | undefined,
  encrypt: (secretKey: string, value: string) => string
): StoredSecrets {
  if (!patch) return stored
  const next = { ...stored }
  for (const [secretKey, value] of Object.entries(patch)) {
    if (value === undefined) continue
    if (value === null) delete next[secretKey]
    else next[secretKey] = encrypt(secretKey, value)
  }
  return next
}

export function componentTypeChangeConflicts(
  stored: { type: string; singleton: boolean },
  nextType: ComponentType
): boolean {
  return stored.singleton ? stored.type !== nextType : isSingletonType(nextType)
}
