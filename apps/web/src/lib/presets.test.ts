import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import type { LayoutPreset, PresetAudience } from '@justcampus/shared'
import { ApiRequestError } from './api'
import {
  audienceSuggestions,
  emptyPresetInput,
  initialPresetFormState,
  movedPresetOrder,
  presetServerErrors,
  splitPresets,
  validatePresetForm
} from './presets'

// Messages come back as their keys, so the tests see which one was chosen.
const t = ((key: string) => key) as unknown as TFunction

function preset(id: string, audience: PresetAudience): LayoutPreset {
  return {
    id,
    name: id,
    audience,
    sidebar: { componentIds: [] },
    dashboard: { tiles: [] },
    sortOrder: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z'
  }
}

const STUDENTS = preset('students', { kind: 'group', name: '/Studierende' })
const ADMINS = preset('admins', { kind: 'role', name: 'admin' })
const STAFF = preset('staff', { kind: 'group', name: '/Beschaeftigte' })
const EVERYONE = preset('everyone', { kind: 'everyone' })

describe('splitPresets', () => {
  it('keeps the ranked order and takes the fallback out wherever it is', () => {
    const { ranked, fallback } = splitPresets([STUDENTS, EVERYONE, ADMINS])
    expect(ranked.map((entry) => entry.id)).toEqual(['students', 'admins'])
    expect(fallback?.id).toBe('everyone')
    expect(splitPresets([ADMINS]).fallback).toBeNull()
  })
})

describe('movedPresetOrder', () => {
  it('swaps neighbours and keeps the fallback last', () => {
    const presets = [STUDENTS, ADMINS, STAFF, EVERYONE]
    expect(movedPresetOrder(presets, 1, -1)).toEqual(['admins', 'students', 'staff', 'everyone'])
    expect(movedPresetOrder(presets, 1, 1)).toEqual(['students', 'staff', 'admins', 'everyone'])
  })

  it('refuses moves past either end of the ranked presets', () => {
    const presets = [STUDENTS, ADMINS, EVERYONE]
    expect(movedPresetOrder(presets, 0, -1)).toBeNull()
    // The last ranked preset cannot swap with the fallback.
    expect(movedPresetOrder(presets, 1, 1)).toBeNull()
  })
})

describe('emptyPresetInput', () => {
  it('starts with an empty sidebar and dashboard', () => {
    expect(emptyPresetInput({ name: 'Alle', audience: { kind: 'everyone' } })).toEqual({
      name: 'Alle',
      audience: { kind: 'everyone' },
      sidebar: { componentIds: [] },
      dashboard: { tiles: [] }
    })
  })
})

describe('audienceSuggestions', () => {
  it('offers roles or groups by kind and nothing for everyone', () => {
    const suggestions = { roles: ['admin', 'user'], groups: ['/Studierende'] }
    expect(audienceSuggestions(suggestions, 'role')).toEqual(['admin', 'user'])
    expect(audienceSuggestions(suggestions, 'group')).toEqual(['/Studierende'])
    expect(audienceSuggestions(suggestions, 'everyone')).toEqual([])
    expect(audienceSuggestions(undefined, 'role')).toEqual([])
  })
})

describe('validatePresetForm', () => {
  it('builds a trimmed audience and drops the name for everyone', () => {
    const group = { name: ' Studierende ', kind: 'group', audienceName: ' /Studierende ' } as const
    expect(validatePresetForm(group, t)).toEqual({
      ok: true,
      details: { name: 'Studierende', audience: { kind: 'group', name: '/Studierende' } }
    })
    const everyone = { name: 'Alle', kind: 'everyone', audienceName: 'admin' } as const
    expect(validatePresetForm(everyone, t)).toEqual({
      ok: true,
      details: { name: 'Alle', audience: { kind: 'everyone' } }
    })
  })

  it('puts a missing name and a missing role on their fields', () => {
    const result = validatePresetForm({ name: '  ', kind: 'role', audienceName: '' }, t)
    expect(result).toEqual({
      ok: false,
      errors: {
        name: 'admin.presets.form.errors.name',
        audienceName: 'admin.presets.form.errors.audienceName'
      }
    })
  })
})

describe('initialPresetFormState', () => {
  it('starts empty for a new preset and from the preset otherwise', () => {
    expect(initialPresetFormState(null)).toEqual({ name: '', kind: 'role', audienceName: '' })
    expect(initialPresetFormState(STUDENTS)).toEqual({
      name: 'students',
      kind: 'group',
      audienceName: '/Studierende'
    })
    expect(initialPresetFormState(EVERYONE).audienceName).toBe('')
  })
})

describe('presetServerErrors', () => {
  it('explains a second everyone preset at the audience', () => {
    const conflict = new ApiRequestError(409, {
      error: { code: 'conflict', message: 'An everyone preset exists already' }
    })
    expect(presetServerErrors(conflict, t)).toEqual({
      audience: 'admin.presets.form.errors.everyoneTaken'
    })
  })

  it('maps validation issues and ignores other failures', () => {
    const invalid = new ApiRequestError(400, {
      error: {
        code: 'validation',
        message: 'Invalid',
        issues: [{ path: ['audience', 'name'], message: 'Too long' }]
      }
    })
    expect(presetServerErrors(invalid, t)).toEqual({
      audienceName: 'admin.presets.form.errors.audienceName'
    })
    expect(presetServerErrors(new ApiRequestError(500, null), t)).toBeNull()
    expect(presetServerErrors(new Error('offline'), t)).toBeNull()
  })
})
