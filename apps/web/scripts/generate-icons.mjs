// Renders the PWA icons in public/icons from public/icon.svg. Run with
// `node scripts/generate-icons.mjs` after changing the SVG; the PNGs are committed.
import { mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const publicDir = fileURLToPath(new URL('../public/', import.meta.url))
const outDir = `${publicDir}icons/`
/** JLU blue, the icon's own background. */
const BACKGROUND = '#0056b3'

const svg = await readFile(`${publicDir}icon.svg`)
await mkdir(outDir, { recursive: true })

const render = (size) => sharp(svg, { density: 384 }).resize(size, size).png()

await render(192).toFile(`${outDir}icon-192.png`)
await render(512).toFile(`${outDir}icon-512.png`)
await render(180).toFile(`${outDir}apple-touch-icon.png`)

// Maskable: full-bleed background, the mark inside the 80% safe zone.
const inner = await render(368).toBuffer()
await sharp({ create: { width: 512, height: 512, channels: 4, background: BACKGROUND } })
  .composite([{ input: inner, gravity: 'center' }])
  .png()
  .toFile(`${outDir}icon-512-maskable.png`)

console.log('Icons written to public/icons')
