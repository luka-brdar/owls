import { exec } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

// GUI-launched Electron apps don't inherit the shell PATH, so Homebrew/other
// install locations must be added explicitly for `mkcert` to be found.
const EXTRA_PATHS = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin']

/**
 * Compute mkcert's default CA root for the current platform. mkcert derives
 * this from the user config/data dir, which a GUI-launched Electron process may
 * fail to resolve ("failed to find the default CA location"), so we set it
 * explicitly.
 */
export function defaultCARoot() {
  if (process.env.CAROOT) {
    return process.env.CAROOT
  }

  const home = process.env.HOME || os.homedir()

  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'mkcert')
  }

  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local')
    return path.join(base, 'mkcert')
  }

  const base = process.env.XDG_DATA_HOME || path.join(home, '.local', 'share')
  return path.join(base, 'mkcert')
}

function buildEnv() {
  const current = process.env.PATH || ''
  const merged = [...EXTRA_PATHS, ...current.split(':')].filter(Boolean)
  return {
    ...process.env,
    PATH: Array.from(new Set(merged)).join(':'),
    CAROOT: defaultCARoot()
  }
}

function run(command, options = {}) {
  return new Promise(resolve => {
    exec(command, { windowsHide: true, env: buildEnv(), ...options }, (error, stdout, stderr) => {
      resolve({
        code: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
        stdout: (stdout || '').trim(),
        stderr: (stderr || '').trim()
      })
    })
  })
}

/**
 * Resolve the mkcert binary: prefer an absolute path that exists, otherwise
 * fall back to the bare command (resolved via PATH).
 */
function mkcertBin() {
  for (const dir of EXTRA_PATHS) {
    const candidate = path.join(dir, 'mkcert')
    try {
      if (fs.existsSync(candidate)) {
        return candidate
      }
    } catch (error) {
      // ignore
    }
  }
  return 'mkcert'
}

export async function isAvailable() {
  const result = await run(`"${mkcertBin()}" -version`)
  return result.code === 0
}

/**
 * Generate a certificate/key pair for the given hostnames using the local
 * mkcert CA. Returns the PEM contents (not written to any persistent location).
 * @param {string[]} hostnames
 * @returns {Promise<{ok: boolean, certificate?: string, certificateKey?: string, message?: string}>}
 */
export async function generate(hostnames) {
  const names = (hostnames || []).map(h => h.trim()).filter(Boolean)
  if (names.length === 0) {
    return { ok: false, message: 'Please provide at least one hostname.' }
  }

  let dir
  try {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'owls-mkcert-'))
  } catch (error) {
    return { ok: false, message: `Could not create a temp directory: ${error.message}` }
  }

  const certFile = path.join(dir, 'cert.pem')
  const keyFile = path.join(dir, 'key.pem')
  const quotedNames = names.map(n => `"${n}"`).join(' ')

  const result = await run(
    `"${mkcertBin()}" -cert-file "${certFile}" -key-file "${keyFile}" ${quotedNames}`,
    { cwd: dir }
  )

  try {
    if (result.code !== 0) {
      return {
        ok: false,
        message: result.stderr || result.stdout || 'mkcert failed to generate a certificate.'
      }
    }

    const certificate = fs.readFileSync(certFile, 'utf8')
    const certificateKey = fs.readFileSync(keyFile, 'utf8')
    return { ok: true, certificate, certificateKey }
  } catch (error) {
    return { ok: false, message: `Could not read generated certificate: ${error.message}` }
  } finally {
    try {
      fs.rmSync(dir, { recursive: true, force: true })
    } catch (error) {
      // ignore cleanup failure
    }
  }
}

export default {
  isAvailable,
  generate,
  defaultCARoot
}
