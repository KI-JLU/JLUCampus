import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveStaticFile } from './static'

const directories: string[] = []

function rendererWith(files: Record<string, string>): string {
  const directory = mkdtempSync(join(tmpdir(), 'justcampus-renderer-'))
  directories.push(directory)
  for (const [file, contents] of Object.entries(files))
    writeFileSync(join(directory, file), contents)
  return directory
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('resolveStaticFile', () => {
  it('uses index.html for SPA routes and identifies static mime types', () => {
    const renderer = rendererWith({ 'index.html': '<main />', 'app.js': 'export {}' })

    expect(resolveStaticFile(renderer, '/dashboard')?.path).toBe(join(renderer, 'index.html'))
    expect(resolveStaticFile(renderer, '/app.js')?.mimeType).toBe('text/javascript; charset=utf-8')
  })
})
