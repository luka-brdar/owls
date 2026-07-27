import { ipcRenderer } from 'electron'
import fs from 'fs'
import path from 'path'

// Resolves (and, for packaged builds, seeds) the writable "data root" that holds
// the docker-compose file, generated nginx configs, certificates and state.
//
// - Development (electron:serve): use the in-repo `proxy-manager/` directly so
//   edits are visible and the working tree stays authoritative.
// - Packaged app: the app bundle (`process.resourcesPath`) is read-only, so copy
//   the bundled template into `userData/proxy-manager` on first run and use that.

let cachedRoot = null

const RUNTIME_DIRS = ['conf.d', 'conf.d/include', 'certs', 'logs']

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(from, to)
    } else {
      fs.copyFileSync(from, to)
    }
  }
}

function ensureRuntimeDirs(root) {
  for (const dir of RUNTIME_DIRS) {
    try {
      fs.mkdirSync(path.join(root, dir), { recursive: true })
    } catch (error) {
      // ignore; surfaced later when writing files
    }
  }
}

function bundledTemplateDir(appPaths) {
  const candidates = []
  if (appPaths && appPaths.resources) {
    candidates.push(path.join(appPaths.resources, 'proxy-manager'))
  }
  candidates.push(path.resolve(process.cwd(), 'proxy-manager'))

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(path.join(candidate, 'docker-compose.yml'))) {
        return candidate
      }
    } catch (error) {
      // try next
    }
  }
  return null
}

export async function getDataRoot() {
  if (cachedRoot) {
    return cachedRoot
  }

  let appPaths = { userData: null, resources: null, isPackaged: false }
  try {
    appPaths = await ipcRenderer.invoke('get-app-paths')
  } catch (error) {
    // Main process handler unavailable (e.g. tests) - fall back to cwd below.
  }

  if (!appPaths.isPackaged) {
    cachedRoot = path.resolve(process.cwd(), 'proxy-manager')
    ensureRuntimeDirs(cachedRoot)
    return cachedRoot
  }

  const root = path.join(appPaths.userData, 'proxy-manager')
  if (!fs.existsSync(path.join(root, 'docker-compose.yml'))) {
    const template = bundledTemplateDir(appPaths)
    if (template) {
      copyDir(template, root)
    }
  }
  ensureRuntimeDirs(root)
  cachedRoot = root
  return root
}

export async function getComposePath() {
  return path.join(await getDataRoot(), 'docker-compose.yml')
}

export async function getConfDir() {
  return path.join(await getDataRoot(), 'conf.d')
}

export async function getCertsDir() {
  return path.join(await getDataRoot(), 'certs')
}

export async function getStatePath() {
  return path.join(await getDataRoot(), 'state.json')
}

export default {
  getDataRoot,
  getComposePath,
  getConfDir,
  getCertsDir,
  getStatePath
}
