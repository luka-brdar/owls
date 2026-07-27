import { exec } from 'child_process'
import path from 'path'
import { getComposePath } from './paths.js'

const CONTAINER_NAME = 'devproxy'
const NETWORK_NAME = 'devproxy-network'

/**
 * Run a shell command, resolving with { code, stdout, stderr } and never
 * rejecting so callers can inspect failures without try/catch everywhere.
 */
function run(command, options = {}) {
  return new Promise(resolve => {
    exec(command, { windowsHide: true, ...options }, (error, stdout, stderr) => {
      resolve({
        code: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
        stdout: (stdout || '').trim(),
        stderr: (stderr || '').trim()
      })
    })
  })
}

/**
 * Check whether the Docker CLI is installed and whether the daemon is running.
 * @returns {Promise<{installed: boolean, running: boolean}>}
 */
export async function isDockerAvailable() {
  const version = await run('docker --version')
  if (version.code !== 0) {
    return { installed: false, running: false }
  }

  const info = await run('docker info')
  return { installed: true, running: info.code === 0 }
}

/**
 * Whether the proxy container is currently up.
 */
export async function isProxyRunning() {
  const result = await run(
    `docker ps --filter "name=^/${CONTAINER_NAME}$" --format "{{.Names}}"`
  )
  return result.code === 0 && result.stdout.includes(CONTAINER_NAME)
}

/**
 * Whether the container exists at all (running or stopped).
 */
export async function containerExists() {
  const result = await run(
    `docker ps -a --filter "name=^/${CONTAINER_NAME}$" --format "{{.Names}}"`
  )
  return result.code === 0 && result.stdout.includes(CONTAINER_NAME)
}

/**
 * Detect which Docker Compose command is available on this system.
 * Prefers the V2 plugin (`docker compose`) and falls back to the standalone
 * `docker-compose` binary. Returns null if neither is available.
 */
export async function getComposeCommand() {
  const v2 = await run('docker compose version')
  if (v2.code === 0) {
    return 'docker compose'
  }

  const v1 = await run('docker-compose version')
  if (v1.code === 0) {
    return 'docker-compose'
  }

  return null
}

/**
 * Ensure the external network referenced by the compose file exists.
 */
export async function ensureNetwork() {
  const existing = await run(
    `docker network ls --filter "name=^${NETWORK_NAME}$" --format "{{.Name}}"`
  )

  if (existing.code === 0 && existing.stdout.includes(NETWORK_NAME)) {
    return { ok: true }
  }

  const created = await run(`docker network create ${NETWORK_NAME}`)
  if (created.code !== 0) {
    return { ok: false, message: created.stderr || `Failed to create the ${NETWORK_NAME} network.` }
  }

  return { ok: true }
}

/**
 * Start (and pull if necessary) the proxy container via compose. Falls back to
 * the legacy `docker-compose` binary if `docker compose` is unavailable.
 * @returns {Promise<{ok: boolean, message: string, stderr?: string}>}
 */
export async function startProxy() {
  // If the container already exists (e.g. stopped), just start it. Running
  // `compose up` in that case fails with a name conflict.
  if (await containerExists()) {
    const started = await run(`docker start ${CONTAINER_NAME}`)
    if (started.code === 0) {
      return { ok: true, message: 'Proxy started.' }
    }
    return {
      ok: false,
      message: 'Failed to start the existing proxy container.',
      stderr: started.stderr || started.stdout
    }
  }

  // Otherwise create it from the compose file (pulling the image if needed).
  const composePath = await getComposePath()
  if (!composePath) {
    return { ok: false, message: 'Could not locate the proxy docker-compose.yml.' }
  }

  const network = await ensureNetwork()
  if (!network.ok) {
    return { ok: false, message: network.message }
  }

  const composeCmd = await getComposeCommand()
  if (!composeCmd) {
    return {
      ok: false,
      message: 'Neither "docker compose" nor "docker-compose" is available on this system.'
    }
  }

  const cwd = path.dirname(composePath)
  const result = await run(`${composeCmd} -f "${composePath}" up -d`, { cwd })

  if (result.code !== 0) {
    return {
      ok: false,
      message: 'Failed to start the proxy.',
      stderr: result.stderr || result.stdout
    }
  }

  return { ok: true, message: 'Proxy started.' }
}

/**
 * Restart the proxy container. Falls back to starting it if it isn't currently
 * present/running.
 * @returns {Promise<{ok: boolean, message: string, stderr?: string}>}
 */
export async function restartProxy() {
  if (!(await containerExists())) {
    return startProxy()
  }

  const result = await run(`docker restart ${CONTAINER_NAME}`)
  if (result.code !== 0) {
    return {
      ok: false,
      message: 'Failed to restart the proxy.',
      stderr: result.stderr || result.stdout
    }
  }

  return { ok: true, message: 'Proxy restarted.' }
}

/**
 * Validate the current nginx configuration inside the container (`nginx -t`).
 * @returns {Promise<{ok: boolean, message?: string}>}
 */
export async function testNginxConfig() {
  const result = await run(`docker exec ${CONTAINER_NAME} nginx -t`)
  if (result.code !== 0) {
    return { ok: false, message: result.stderr || result.stdout || 'nginx configuration test failed.' }
  }
  return { ok: true }
}

/**
 * Reload nginx inside the container so newly written configs take effect
 * (`nginx -s reload`). Validates the config first and reports errors without
 * applying a broken reload.
 * @returns {Promise<{ok: boolean, message?: string}>}
 */
export async function reloadNginx() {
  const test = await testNginxConfig()
  if (!test.ok) {
    return test
  }

  const result = await run(`docker exec ${CONTAINER_NAME} nginx -s reload`)
  if (result.code !== 0) {
    return { ok: false, message: result.stderr || result.stdout || 'Failed to reload nginx.' }
  }
  return { ok: true }
}

export default {
  getComposePath,
  isDockerAvailable,
  isProxyRunning,
  containerExists,
  getComposeCommand,
  ensureNetwork,
  startProxy,
  restartProxy,
  testNginxConfig,
  reloadNginx
}
