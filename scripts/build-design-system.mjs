import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
 * The JLU design system is installed from a git tag and ships no prebuilt
 * `dist/`. npm builds it through its `prepare` script, but Bun installs git
 * packages without their devDependencies, so that build cannot run. This
 * builds it in a scratch copy and moves only `dist/` back: the build's own
 * React and type packages must not land beside the installed package, or the
 * web app would resolve a second React. Later installs skip it while `dist/`
 * is present. (Same approach as JLU Mail.)
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const candidates = [
  join(root, 'node_modules', '@ki4jlu', 'design-system'),
  join(root, 'apps', 'web', 'node_modules', '@ki4jlu', 'design-system')
]
// Bun's isolated layout links the package into `node_modules/.bun`; copy the target, not the link.
const linked = candidates.find((dir) => existsSync(dir))
const pkg = linked ? realpathSync(linked) : undefined

if (!pkg) process.exit(0)
if (existsSync(join(pkg, 'dist', 'index.js')) && existsSync(join(pkg, 'dist', 'tokens.css'))) {
  process.exit(0)
}

const scratch = mkdtempSync(join(tmpdir(), 'jlu-design-system-'))
try {
  cpSync(pkg, scratch, {
    recursive: true,
    filter: (source) => !source.startsWith(join(pkg, 'node_modules'))
  })
  for (const args of [
    ['install', '--no-save', '--ignore-scripts', '--no-audit', '--no-fund', '--loglevel=error'],
    ['run', 'build']
  ]) {
    const result = spawnSync('npm', args, {
      cwd: scratch,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    })
    if (result.status !== 0) process.exit(result.status ?? 1)
  }
  rmSync(join(pkg, 'dist'), { recursive: true, force: true })
  cpSync(join(scratch, 'dist'), join(pkg, 'dist'), { recursive: true })
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
