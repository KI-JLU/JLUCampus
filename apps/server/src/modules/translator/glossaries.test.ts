import { describe, expect, it } from 'vitest'

import {
  glossaryPairs,
  glossaryRights,
  glossaryRoles,
  glossaryTerms,
  newGlossaryNameError,
  publicGlossary
} from './glossaries.js'

const entries = [
  {
    sourceLanguage: 'de',
    sourceTerm: 'Prüfungsamt',
    targetLanguage: 'en',
    targetTerm: 'Examinations Office'
  },
  { sourceLanguage: 'en', sourceTerm: 'lecture', targetLanguage: 'de', targetTerm: 'Vorlesung' },
  { sourceLanguage: 'de', sourceTerm: 'Mensa', targetLanguage: 'fr', targetTerm: 'cantine' }
] as const

describe('translator glossaries', () => {
  it('turns every term into the direction of the translation', () => {
    expect(glossaryPairs(entries, 'de', 'en-gb')).toEqual([
      { source: 'Prüfungsamt', target: 'Examinations Office' },
      { source: 'Vorlesung', target: 'lecture' }
    ])
    expect(glossaryPairs(entries, 'en-us', 'de')).toEqual([
      { source: 'Examinations Office', target: 'Prüfungsamt' },
      { source: 'lecture', target: 'Vorlesung' }
    ])
  })

  it('lets the newer of two glossaries win a term both give', () => {
    const newer = [
      {
        sourceLanguage: 'de',
        sourceTerm: 'prüfungsamt',
        targetLanguage: 'en',
        targetTerm: 'Office'
      }
    ] as const
    expect(glossaryPairs([...entries, ...newer], 'de', 'en-gb')).toEqual([
      { source: 'prüfungsamt', target: 'Office' },
      { source: 'Vorlesung', target: 'lecture' }
    ])
  })

  it('takes every term into the target while the source is unknown', () => {
    expect(glossaryPairs(entries, null, 'fr')).toEqual([{ source: 'Mensa', target: 'cantine' }])
  })

  it('lists the terms of one language for rewriting', () => {
    expect(glossaryTerms(entries, 'de').map((term) => term.source)).toEqual([
      'Prüfungsamt',
      'Vorlesung',
      'Mensa'
    ])
  })
})

describe('new glossary names', () => {
  const values = { description: 'Mit, Komma', visibility: 'private' as const }

  it('fails a name over 241 characters with HAWKI’s database message', () => {
    expect(newGlossaryNameError('create', { ...values, name: 'N'.repeat(241) }, 'u1')).toBeNull()
    const name = 'N'.repeat(242)
    // 12:24:29.123 UTC is 14:24:29 in Giessen in summer.
    const now = new Date('2026-10-01T12:24:29.123Z')
    expect(newGlossaryNameError('import', { ...values, name }, 'u1', now)).toBe(
      "Failed to import glossary: SQLSTATE[22001]: String data, right truncated: 1406 Data too long for column 'unique_name' at row 1 (Connection: mysql, SQL: insert into `translate_glossaries` (`unique_name`, `display_name`, `domain`, `description`, `visibility`, `created_by`, `updated_at`, `created_at`) values (" +
        `${name}_${Math.floor(now.getTime() / 1000).toString(16)}1e078, ${name}, general, Mit, Komma, private, u1, 2026-10-01 14:24:29, 2026-10-01 14:24:29))`
    )
  })

  it('counts characters, not UTF-16 units', () => {
    expect(newGlossaryNameError('create', { ...values, name: '😀'.repeat(241) }, 'u1')).toBeNull()
  })
})

describe('glossary rights', () => {
  const row = {
    id: '123e4567-e89b-42d3-a456-426614174000',
    componentId: '123e4567-e89b-42d3-a456-426614174001',
    userId: 'owner',
    name: 'JLU Dictionary',
    description: '',
    category: 'general',
    visibility: 'public',
    visibleTo: null,
    editorRole: null,
    createdAt: new Date('2026-09-30T10:00:00Z'),
    updatedAt: new Date('2026-09-30T10:00:00Z'),
    entryCount: 409,
    creatorName: 'Admin'
  }
  const owner = { userId: 'owner', roles: [] }
  const staff = { userId: 'someone', roles: ['staff'] } as const

  it('lets only the owner edit or delete, a public glossary too', () => {
    expect(publicGlossary(row, owner)).toMatchObject({ canEdit: true, canDelete: true })
    expect(publicGlossary(row, { userId: 'someone', roles: ['admin'] })).toMatchObject({
      visibility: 'public',
      entryCount: 409,
      canEdit: false,
      canDelete: false
    })
  })

  it('lets the users of the editor role edit, but not delete', () => {
    const shared = { ...row, visibility: 'organization', editorRole: 'staff' }
    expect(publicGlossary(shared, staff)).toMatchObject({
      editorRole: 'staff',
      canEdit: true,
      canDelete: false
    })
    expect(publicGlossary({ ...shared, visibility: 'private' }, staff)).toMatchObject({
      editorRole: null,
      canEdit: false
    })
  })

  it('keeps a role only where the visibility uses it', () => {
    const shared = { visibility: 'organization', visibleTo: 'student', editorRole: 'admin' }
    expect(glossaryRights(shared, {})).toEqual(shared)
    expect(glossaryRights(shared, { visibility: 'public' })).toEqual({
      visibility: 'public',
      visibleTo: null,
      editorRole: 'admin'
    })
    expect(glossaryRights(shared, { visibility: 'private', editorRole: 'student' })).toEqual({
      visibility: 'private',
      visibleTo: null,
      editorRole: null
    })
  })

  it('gives HAWKI’s roles by Keycloak roles and groups, in HAWKI’s order', () => {
    expect(glossaryRoles(['offline_access', 'user'], ['/Studierende'], false)).toEqual(['student'])
    expect(glossaryRoles(['admin', 'user'], ['/Beschaeftigte'], true)).toEqual(['admin', 'staff'])
    expect(glossaryRoles(['Moderator'], ['/JLU/Lehrende', '/Gast'], false)).toEqual([
      'lecturer',
      'guest',
      'mod'
    ])
    expect(glossaryRoles([], [], true)).toEqual(['admin'])
  })
})
