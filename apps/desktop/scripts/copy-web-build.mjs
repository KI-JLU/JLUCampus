import { cp, rm, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const webDist = resolve(import.meta.dirname, '../../web/dist')
const rendererOut = resolve(import.meta.dirname, '../out/renderer')

try {
  await stat(webDist)
} catch {
  console.error('Build the web app first: bun run --filter @justcampus/web build')
  process.exit(1)
}

await rm(rendererOut, { recursive: true, force: true })
await cp(webDist, rendererOut, { recursive: true })
