import { execFileSync } from 'node:child_process'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

import {
  PYTHON_CODE_MAX_BYTES,
  PYTHON_CODE_TOO_LARGE_OUTPUT,
  PYTHON_OUTPUT_MAX_BYTES,
  PYTHON_TIMEOUT_OUTPUT,
  PythonUnavailableError,
  pythonAnswer,
  runPython,
  sandboxArguments,
  trimCode,
  type PythonSandbox
} from './python.js'

/**
 * A stand-in for the container CLI: `run` runs the mounted code.py with sh instead of Python,
 * `rm` does nothing. Enough to see how runs end without a container.
 */
const fakeDir = mkdtempSync(join(tmpdir(), 'justcampus-fake-cli-'))
afterAll(() => rmSync(fakeDir, { recursive: true, force: true }))

function fakeCli(): string {
  const cli = join(fakeDir, 'docker')
  writeFileSync(
    cli,
    `#!/bin/sh
[ "$1" = rm ] && exit 0
for arg; do case "$arg" in *:/work:ro) work="\${arg%:/work:ro}";; esac; done
exec sh "$work/code.py"
`
  )
  chmodSync(cli, 0o755)
  return cli
}

const fake: PythonSandbox = { command: fakeCli(), image: 'image' }

describe('translator Python runs', () => {
  it("starts HAWKI's container", () => {
    expect(
      sandboxArguments({ command: 'docker', image: 'img', runtime: 'runsc' }, 'n', '/tmp/w')
    ).toEqual([
      'run',
      '--rm',
      '--name=n',
      '--pull=never',
      '--network=none',
      '--read-only',
      '--cap-drop=ALL',
      '--security-opt=no-new-privileges',
      '--memory=256m',
      '--memory-swap=256m',
      '--cpus=1',
      '--tmpfs=/tmp:size=64m',
      '--pids-limit=64',
      '--user=sandboxuser',
      '-v',
      '/tmp/w:/work:ro',
      '-w',
      '/work',
      '--runtime=runsc',
      'img',
      'python',
      '/work/code.py'
    ])
  })

  it('shows stdout, or the error output, --- and stdout, as HAWKI does', () => {
    expect(pythonAnswer(false, '42\n', 'warn\n')).toEqual({ success: true, output: '42\n' })
    expect(pythonAnswer(true, 'a\n', 'E')).toEqual({ success: false, output: 'E\n---\na\n' })
    expect(pythonAnswer(true, 'vor Exit\n', '')).toEqual({ success: false, output: 'vor Exit\n' })
    expect(pythonAnswer(true, '', '')).toEqual({ success: false, output: '' })
  })

  it('tells how the code ended', async () => {
    await expect(runPython('echo 42; echo warn >&2', fake)).resolves.toEqual({
      success: true,
      output: '42\n'
    })
    await expect(runPython('echo vorher; echo Fehler >&2; exit 1', fake)).resolves.toEqual({
      success: false,
      output: 'Fehler\n\n---\nvorher\n'
    })
  })

  it('trims the code as Laravel trims request strings', () => {
    expect(trimCode('\u00a0\u200b\t  print(1)\n\n  \u3000\ufeff\u200e')).toBe('print(1)')
    expect(trimCode('  if x:\n    print(1)\n')).toBe('if x:\n    print(1)')
    expect(trimCode('\u200b \r\n')).toBe('')
  })

  it('does not run code over 256 KB, counted in UTF-8 bytes, as HAWKI does', async () => {
    await expect(runPython(`#${'x'.repeat(PYTHON_CODE_MAX_BYTES - 1)}`, fake)).resolves.toEqual({
      success: true,
      output: ''
    })
    const tooLarge = { success: false, output: PYTHON_CODE_TOO_LARGE_OUTPUT }
    await expect(runPython(`#${'x'.repeat(PYTHON_CODE_MAX_BYTES)}`, fake)).resolves.toEqual(
      tooLarge
    )
    // 'ä' takes two bytes: 131 073 characters are 262 145 bytes.
    await expect(runPython(`#${'ä'.repeat(PYTHON_CODE_MAX_BYTES / 2)}`, fake)).resolves.toEqual(
      tooLarge
    )
  })

  it('cuts an output that is too long and stops the run', async () => {
    const answer = await runPython(
      `head -c ${PYTHON_OUTPUT_MAX_BYTES + 10} /dev/zero | tr '\\0' x; exec sleep 5`,
      fake
    )
    expect(answer.success).toBe(false)
    expect(answer.output).toBe(`${'x'.repeat(PYTHON_OUTPUT_MAX_BYTES)}\n[truncated]`)
  })

  it('stops code that runs too long', async () => {
    const started = Date.now()
    await expect(runPython('echo start; exec sleep 20', fake)).resolves.toEqual({
      success: false,
      output: PYTHON_TIMEOUT_OUTPUT
    })
    expect(Date.now() - started).toBeLessThan(12_000)
  }, 15_000)

  it('rejects when no container can be started', async () => {
    await expect(
      runPython('echo 1', { command: '/nonexistent/docker', image: 'image' })
    ).rejects.toBeInstanceOf(PythonUnavailableError)
    await expect(
      runPython('echo "Unable to find image \'x\' locally" >&2; exit 125', fake)
    ).rejects.toBeInstanceOf(PythonUnavailableError)
  })
})

/** The real sandbox, when its image is built on this machine (`bun run sandbox:build`). */
const sandbox: PythonSandbox = { command: 'docker', image: 'justcampus-python-sandbox:latest' }
const sandboxBuilt = (() => {
  try {
    execFileSync(sandbox.command, ['image', 'inspect', sandbox.image], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

describe.skipIf(!sandboxBuilt)('the Python sandbox', () => {
  it('runs Python with subprocesses and without network, as HAWKI does', async () => {
    const answer = await runPython(
      [
        'import subprocess, sys, urllib.request',
        'print(subprocess.run([sys.executable, "-c", "print(42)"], capture_output=True, text=True).stdout, end="")',
        'try:',
        '    urllib.request.urlopen("https://example.com", timeout=2)',
        'except Exception as e:',
        '    print(type(e).__name__ + ": " + str(e))'
      ].join('\n'),
      sandbox
    )
    expect(answer).toEqual({
      success: true,
      output: '42\nURLError: <urlopen error [Errno 101] Network is unreachable>\n'
    })
  }, 30_000)

  it('gives every run a fresh file system', async () => {
    await runPython('open("/tmp/r.txt", "w").write("Runde")', sandbox)
    const answer = await runPython('print(open("/tmp/r.txt").read())', sandbox)
    expect(answer.success).toBe(false)
    expect(answer.output).toContain('FileNotFoundError')
    expect(answer.output).toContain('File "/work/code.py", line 1')
  }, 30_000)

  it('shows only stdout after sys.exit(1) without error output', async () => {
    await expect(runPython('import sys\nprint("vor Exit")\nsys.exit(1)', sandbox)).resolves.toEqual(
      { success: false, output: 'vor Exit\n' }
    )
  }, 30_000)
})
