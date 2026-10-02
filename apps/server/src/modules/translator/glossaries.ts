import {
  TRANSLATOR_GLOSSARY_DEFAULT_CATEGORY,
  TRANSLATOR_GLOSSARY_NEW_NAME_MAX,
  TRANSLATOR_GLOSSARY_ROLES,
  translatorGlossaryDetailSchema,
  translatorGlossaryRoleSchema,
  translatorGlossarySchema,
  translatorGlossaryVisibilitySchema,
  type TranslatorGlossary,
  type TranslatorGlossaryDetail,
  type TranslatorGlossaryEntry,
  type TranslatorGlossaryRole,
  type TranslatorGlossaryVisibility,
  type TranslatorLanguage
} from '@justcampus/shared'
import { and, asc, eq, getTableColumns, inArray, ne, or, sql, type SQL } from 'drizzle-orm'

import { db } from '../../db/index.js'
import { translatorGlossary, user } from '../../db/schema.js'

export type GlossaryRow = typeof translatorGlossary.$inferSelect

/** One term as a translation uses it, in the direction of that translation. */
export interface GlossaryPair {
  source: string
  target: string
}

/**
 * Who asks: the owner edits their glossaries, so do the users of a glossary's editor role, and
 * either may share it. `roles` are the viewer's roles of HAWKI's (see `glossaryRoles`).
 */
export interface GlossaryViewer {
  userId: string
  roles: readonly TranslatorGlossaryRole[]
}

/**
 * The Keycloak names that give each of HAWKI's roles: realm roles and the last part of group
 * paths, in any case. Besides HAWKI's slugs and names these are JLU's groups (Beschaeftigte).
 */
const ROLE_NAMES: Record<TranslatorGlossaryRole, readonly string[]> = {
  admin: ['admin', 'administrator'],
  student: ['student', 'studierende'],
  lecturer: ['lecturer', 'lehrende'],
  staff: ['staff', 'mitarbeiter', 'beschaeftigte'],
  guest: ['guest', 'gast'],
  mod: ['mod', 'moderator']
}

/** HAWKI's roles a user holds by their Keycloak roles and groups; Campus admins are admins. */
export function glossaryRoles(
  roles: readonly string[],
  groups: readonly string[],
  isAdmin: boolean
): TranslatorGlossaryRole[] {
  const names = new Set(
    [...roles, ...groups.map((group) => group.split('/').filter(Boolean).at(-1) ?? group)].map(
      (name) => name.toLowerCase()
    )
  )
  return TRANSLATOR_GLOSSARY_ROLES.filter(
    (role) => (role === 'admin' && isAdmin) || ROLE_NAMES[role].some((name) => names.has(name))
  )
}

/** The viewer of a signed-in user, with their roles. */
export async function glossaryViewer(userId: string, isAdmin: boolean): Promise<GlossaryViewer> {
  const [row] = await db
    .select({ roles: user.keycloakRoles, groups: user.keycloakGroups })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  return { userId, roles: glossaryRoles(row?.roles ?? [], row?.groups ?? [], isAdmin) }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- lists count the terms instead of loading them
const { entries, ...summaryColumns } = getTableColumns(translatorGlossary)

const listColumns = {
  ...summaryColumns,
  entryCount: sql<number>`jsonb_array_length(${translatorGlossary.entries})`.mapWith(Number),
  creatorName: user.name
}

type GlossarySummaryRow = Omit<GlossaryRow, 'entries'> & { entryCount: number; creatorName: string }

/**
 * The module's glossaries the viewer sees: their own, public ones, those shared with a role of
 * theirs, and those a role of theirs edits.
 */
function visibleTo(componentId: string, viewer: GlossaryViewer): SQL | undefined {
  const roles = [...viewer.roles]
  return and(
    eq(translatorGlossary.componentId, componentId),
    or(
      eq(translatorGlossary.userId, viewer.userId),
      eq(translatorGlossary.visibility, 'public'),
      ...(roles.length > 0
        ? [
            and(
              eq(translatorGlossary.visibility, 'organization'),
              inArray(translatorGlossary.visibleTo, roles)
            ),
            and(
              ne(translatorGlossary.visibility, 'private'),
              inArray(translatorGlossary.editorRole, roles)
            )
          ]
        : [])
    )
  )
}

function glossaryVisibility(value: string): TranslatorGlossaryVisibility {
  const parsed = translatorGlossaryVisibilitySchema.safeParse(value)
  return parsed.success ? parsed.data : 'private'
}

function glossaryRole(value: string | null): TranslatorGlossaryRole | null {
  const parsed = translatorGlossaryRoleSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/** Whether the viewer may change a glossary: its owner, or a user of its editor role. */
export function canEditGlossary(
  row: Pick<GlossaryRow, 'userId' | 'visibility' | 'editorRole'>,
  viewer: GlossaryViewer
): boolean {
  if (row.userId === viewer.userId) return true
  const role = glossaryRole(row.editorRole)
  return row.visibility !== 'private' && role !== null && viewer.roles.includes(role)
}

export function publicGlossary(
  row: GlossarySummaryRow,
  viewer: GlossaryViewer
): TranslatorGlossary {
  const visibility = glossaryVisibility(row.visibility)
  return translatorGlossarySchema.parse({
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    visibility,
    visibleTo: visibility === 'organization' ? glossaryRole(row.visibleTo) : null,
    editorRole: visibility === 'private' ? null : glossaryRole(row.editorRole),
    entryCount: row.entryCount,
    creatorName: row.creatorName,
    canEdit: canEditGlossary(row, viewer),
    canDelete: row.userId === viewer.userId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  })
}

/** The rights a glossary has after a change: a role only where its visibility uses one. */
export function glossaryRights(
  current: Pick<GlossaryRow, 'visibility' | 'visibleTo' | 'editorRole'>,
  change: {
    visibility?: TranslatorGlossaryVisibility
    visibleTo?: TranslatorGlossaryRole | null
    editorRole?: TranslatorGlossaryRole | null
  }
): {
  visibility: TranslatorGlossaryVisibility
  visibleTo: string | null
  editorRole: string | null
} {
  const visibility = change.visibility ?? glossaryVisibility(current.visibility)
  return {
    visibility,
    visibleTo:
      visibility === 'organization'
        ? change.visibleTo === undefined
          ? current.visibleTo
          : change.visibleTo
        : null,
    editorRole:
      visibility === 'private'
        ? null
        : change.editorRole === undefined
          ? current.editorRole
          : change.editorRole
  }
}

export function glossaryDetail(
  row: GlossaryRow & { creatorName: string },
  viewer: GlossaryViewer
): TranslatorGlossaryDetail {
  return translatorGlossaryDetailSchema.parse({
    ...publicGlossary({ ...row, entryCount: row.entries.length }, viewer),
    entries: row.entries
  })
}

/** The glossaries the viewer can use, oldest first as in HAWKI. */
export async function listGlossaries(
  componentId: string,
  viewer: GlossaryViewer
): Promise<TranslatorGlossary[]> {
  const rows = await db
    .select(listColumns)
    .from(translatorGlossary)
    .innerJoin(user, eq(translatorGlossary.userId, user.id))
    .where(visibleTo(componentId, viewer))
    .orderBy(asc(translatorGlossary.createdAt), asc(translatorGlossary.id))
  return rows.map((row) => publicGlossary(row, viewer))
}

/** One glossary the viewer can use, with its terms. */
export async function findGlossary(
  id: string,
  componentId: string,
  viewer: GlossaryViewer
): Promise<(GlossaryRow & { creatorName: string }) | undefined> {
  const [row] = await db
    .select({ ...getTableColumns(translatorGlossary), creatorName: user.name })
    .from(translatorGlossary)
    .innerJoin(user, eq(translatorGlossary.userId, user.id))
    .where(and(eq(translatorGlossary.id, id), visibleTo(componentId, viewer)))
    .limit(1)
  return row
}

/**
 * HAWKI stores a new glossary under its name plus a 14-character suffix in a column of 255, so a
 * name over `TRANSLATOR_GLOSSARY_NEW_NAME_MAX` fails in its database, and its page shows the
 * database's message. This is that message, for creating (`create`) or importing (`import`).
 */
export function newGlossaryNameError(
  action: 'create' | 'import',
  values: { name: string; description: string; visibility: TranslatorGlossaryVisibility },
  userId: string,
  now = new Date()
): string | null {
  if ([...values.name].length <= TRANSLATOR_GLOSSARY_NEW_NAME_MAX) return null
  // PHP's uniqid(): seconds and microseconds in hex; the time as MySQL writes it in Giessen.
  const seconds = Math.floor(now.getTime() / 1000).toString(16)
  const micros = ((now.getTime() % 1000) * 1000).toString(16).padStart(5, '0')
  const suffix = `${seconds}${micros}`
  const time = now.toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' })
  const columns = [
    'unique_name',
    'display_name',
    'domain',
    'description',
    'visibility',
    'created_by',
    'updated_at',
    'created_at'
  ]
  const row = [
    `${values.name}_${suffix}`,
    values.name,
    TRANSLATOR_GLOSSARY_DEFAULT_CATEGORY,
    values.description,
    values.visibility,
    userId,
    time,
    time
  ]
  return (
    `Failed to ${action} glossary: SQLSTATE[22001]: String data, right truncated: 1406 Data too ` +
    `long for column 'unique_name' at row 1 (Connection: mysql, SQL: insert into ` +
    `\`translate_glossaries\` (${columns.map((column) => `\`${column}\``).join(', ')}) values ` +
    `(${row.join(', ')}))`
  )
}

export async function insertGlossary(values: {
  componentId: string
  userId: string
  name: string
  description: string
  visibility: TranslatorGlossaryVisibility
  entries: TranslatorGlossaryEntry[]
}): Promise<GlossaryRow> {
  const [row] = await db.insert(translatorGlossary).values(values).returning()
  return row!
}

/**
 * The terms of the glossaries a request applies, those the user may not use left out. They come
 * in list order, oldest glossary first, whatever order the ids were sent in. The viewer is only
 * looked up when there are glossaries to apply.
 */
export async function glossaryEntries(
  ids: readonly string[],
  componentId: string,
  viewer: () => Promise<GlossaryViewer>
): Promise<TranslatorGlossaryEntry[]> {
  if (ids.length === 0) return []
  const rows = await db
    .select({ entries: translatorGlossary.entries })
    .from(translatorGlossary)
    .where(and(inArray(translatorGlossary.id, [...ids]), visibleTo(componentId, await viewer())))
    .orderBy(asc(translatorGlossary.createdAt), asc(translatorGlossary.id))
  return rows.flatMap((row) => row.entries)
}

/** The glossary language of a translator language: English without its region. */
export function glossaryLanguage(language: TranslatorLanguage): string {
  return language.split('-')[0]!
}

/**
 * The terms that apply from `source` to `target`, each turned to that direction: an entry written
 * the other way round counts too. With the source unknown every entry into the target counts.
 * A term given twice takes its last translation, so of two active glossaries the newer one wins,
 * as in HAWKI.
 */
export function glossaryPairs(
  entries: readonly TranslatorGlossaryEntry[],
  source: TranslatorLanguage | null,
  target: TranslatorLanguage
): GlossaryPair[] {
  const from = source ? glossaryLanguage(source) : null
  const to = glossaryLanguage(target)
  const pairs = new Map<string, GlossaryPair>()
  const add = (term: string, translation: string): void => {
    pairs.set(term.toLowerCase(), { source: term, target: translation })
  }
  for (const entry of entries) {
    if (entry.targetLanguage === to && (from === null || entry.sourceLanguage === from)) {
      if (entry.sourceLanguage !== to) add(entry.sourceTerm, entry.targetTerm)
    } else if (entry.sourceLanguage === to && (from === null || entry.targetLanguage === from)) {
      if (entry.targetLanguage !== to) add(entry.targetTerm, entry.sourceTerm)
    }
  }
  return [...pairs.values()]
}

/** The terms that apply to a text in `language` that is rewritten in the same language. */
export function glossaryTerms(
  entries: readonly TranslatorGlossaryEntry[],
  language: TranslatorLanguage | null
): GlossaryPair[] {
  const code = language ? glossaryLanguage(language) : null
  const terms = new Map<string, GlossaryPair>()
  for (const entry of entries) {
    for (const [lang, term] of [
      [entry.sourceLanguage, entry.sourceTerm],
      [entry.targetLanguage, entry.targetTerm]
    ] as const) {
      if ((code === null || lang === code) && !terms.has(term.toLowerCase())) {
        terms.set(term.toLowerCase(), { source: term, target: term })
      }
    }
  }
  return [...terms.values()]
}
