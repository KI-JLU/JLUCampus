import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { chmod, chown, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { TranslatorPythonResponse } from '@justcampus/shared'

/**
 * Running a Python code block of the AI editor ("Code ausführen"), as HAWKI runs it: each run in a
 * fresh container of the sandbox image (infra/python-sandbox) with the same limits, no network, a
 * read-only file system but /tmp, and the code read-only at /work/code.py.
 */

/** How long a run may take, the container's start included, as in HAWKI. */
export const PYTHON_TIMEOUT_MS = 10_000

/** HAWKI's answer when the code ran too long. */
export const PYTHON_TIMEOUT_OUTPUT = `Execution timed out after ${PYTHON_TIMEOUT_MS} ms`

/** How much of stdout and of stderr is kept; more stops the run, as in HAWKI. */
export const PYTHON_OUTPUT_MAX_BYTES = 512 * 1024

/** The longest code HAWKI runs, in UTF-8 bytes. */
export const PYTHON_CODE_MAX_BYTES = 256 * 1024

/** HAWKI's answer to longer code, which its editor shows as the run's error output. */
export const PYTHON_CODE_TOO_LARGE_OUTPUT = 'code_exec: code too large (max 256 KB)'

/**
 * HAWKI's user and group of the code directory (its PHP's), unknown in the image: `/work` shows
 * as 100:101, and Python cannot name its owner. A server running as root hands the directory to
 * them; under rootless Podman the runtime wrapper (infra/python-sandbox/runsc-rootless) does.
 */
const WORK_UID = 100
const WORK_GID = 101

/**
 * The code as HAWKI runs it: Laravel trims every request string of white space (Unicode's
 * included) and of zero-width spaces, byte order marks and left-to-right marks at both ends.
 */
export function trimCode(code: string): string {
  return code.replace(/^[\s\u200B\u200E]+|[\s\u200B\u200E]+$/gu, '')
}

/** What HAWKI puts after an output it cut. */
const TRUNCATED = '\n[truncated]'

/** The container CLI (`docker` or `podman`), the sandbox image and an optional runtime (`runsc`). */
export interface PythonSandbox {
  command: string
  image: string
  runtime?: string
}

/** No container could be started: no CLI, no daemon or no image. */
export class PythonUnavailableError extends Error {}

/** `docker run` for one run, with HAWKI's options. */
export function sandboxArguments(sandbox: PythonSandbox, name: string, workDir: string): string[] {
  return [
    'run',
    '--rm',
    `--name=${name}`,
    // Only the image built for this; a missing one is not fetched from anywhere.
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
    `${workDir}:/work:ro`,
    '-w',
    '/work',
    ...(sandbox.runtime ? [`--runtime=${sandbox.runtime}`] : []),
    sandbox.image,
    'python',
    '/work/code.py'
  ]
}

/**
 * The answer for a run that ended by itself. A failed run shows its error output, `---` and what
 * it printed; without error output (`sys.exit(1)` after a print) only what it printed.
 */
export function pythonAnswer(
  failed: boolean,
  stdout: string,
  stderr: string
): TranslatorPythonResponse {
  if (!failed) return { success: true, output: stdout }
  return { success: false, output: stderr ? `${stderr}\n---\n${stdout}` : stdout }
}

/** An output stream kept up to `PYTHON_OUTPUT_MAX_BYTES`; `onFull` once it goes beyond. */
function collector(onFull: () => void): { add: (chunk: Buffer) => void; text: () => string } {
  const chunks: Buffer[] = []
  let size = 0
  let truncated = false
  return {
    add(chunk) {
      if (truncated) return
      const room = PYTHON_OUTPUT_MAX_BYTES - size
      if (chunk.length > room) {
        chunks.push(chunk.subarray(0, room))
        truncated = true
        onFull()
        return
      }
      chunks.push(chunk)
      size += chunk.length
    },
    text: () => Buffer.concat(chunks).toString('utf8') + (truncated ? TRUNCATED : '')
  }
}

/** Exit 125 with the CLI's own message: the container did not start (no daemon, no image). */
const CLI_ERROR = /^(docker: |Unable to find image|Error response from daemon|Error: )/m

function runContainer(sandbox: PythonSandbox, workDir: string): Promise<TranslatorPythonResponse> {
  return new Promise((resolve, reject) => {
    const name = `justcampus-python-${randomUUID()}`
    // stdin is empty, so `input()` ends in EOFError, as in HAWKI.
    const child = spawn(sandbox.command, sandboxArguments(sandbox, name, workDir), {
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let settled = false
    let stopped = false
    const remove = (): void => {
      spawn(sandbox.command, ['rm', '-f', name], { stdio: 'ignore' }).on('error', () => {})
    }
    // Killing the CLI would leave the container running: it is removed, which ends the run.
    const stop = (): void => {
      if (stopped) return
      stopped = true
      remove()
      child.kill('SIGKILL')
    }
    const stdout = collector(stop)
    const stderr = collector(stop)
    const timer = setTimeout(() => {
      stop()
      settled = true
      resolve({ success: false, output: PYTHON_TIMEOUT_OUTPUT })
    }, PYTHON_TIMEOUT_MS)
    child.stdout.on('data', stdout.add)
    child.stderr.on('data', stderr.add)
    child.on('error', (error) => {
      clearTimeout(timer)
      if (settled) return
      settled = true
      reject(new PythonUnavailableError(error.message))
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      // A container the CLI had not yet started when it was stopped is removed now.
      if (stopped) remove()
      if (settled) return
      settled = true
      const errorText = stderr.text()
      if (!stopped && code === 125 && CLI_ERROR.test(errorText)) {
        reject(new PythonUnavailableError(errorText.trim()))
        return
      }
      resolve(pythonAnswer(stopped || code !== 0, stdout.text(), errorText))
    })
  })
}

/**
 * Runs a Python code block (trimmed, see `trimCode`) in the sandbox; code over
 * `PYTHON_CODE_MAX_BYTES` is not run. Rejects with `PythonUnavailableError` only.
 */
export async function runPython(
  code: string,
  sandbox: PythonSandbox
): Promise<TranslatorPythonResponse> {
  if (Buffer.byteLength(code) > PYTHON_CODE_MAX_BYTES) {
    return { success: false, output: PYTHON_CODE_TOO_LARGE_OUTPUT }
  }
  const workDir = await mkdtemp(join(tmpdir(), 'justcampus-python-'))
  try {
    const file = join(workDir, 'code.py')
    await writeFile(file, code)
    // The sandbox user reads the code, and can only read it.
    await chmod(file, 0o644)
    await chmod(workDir, 0o755)
    if (process.getuid?.() === 0) {
      await chown(file, WORK_UID, WORK_GID)
      await chown(workDir, WORK_UID, WORK_GID)
    }
    return await runContainer(sandbox, workDir)
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}
