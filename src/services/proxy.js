import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

import docker from './docker.js'
import { getConfDir, getCertsDir, getStatePath } from './paths.js'
import { generateServerConfig } from './nginxConfig.js'

// Local, file-backed proxy control layer.
//
// State (proxy hosts + certificate records) lives in `state.json` under the
// data root. Each mutation regenerates the affected nginx config files and, if
// the container is running, validates + reloads nginx. Failed reloads are rolled
// back to the previous known-good state.

const DEFAULT_STATE = () => ({
  nextHostId: 1,
  nextCertId: 1,
  proxyHosts: [],
  certificates: []
})

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

async function readState() {
  const statePath = await getStatePath()
  try {
    const raw = fs.readFileSync(statePath, 'utf8')
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_STATE(), ...parsed }
  } catch (error) {
    return DEFAULT_STATE()
  }
}

async function writeState(state) {
  const statePath = await getStatePath()
  fs.mkdirSync(path.dirname(statePath), { recursive: true })
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2))
}

/**
 * Rewrite every `host-<id>.conf` in conf.d from the given state, removing any
 * that no longer apply (disabled or deleted hosts).
 */
async function writeHostConfigs(state) {
  const confDir = await getConfDir()
  fs.mkdirSync(confDir, { recursive: true })

  for (const file of fs.readdirSync(confDir)) {
    if (/^host-\d+\.conf$/.test(file)) {
      fs.unlinkSync(path.join(confDir, file))
    }
  }

  for (const host of state.proxyHosts) {
    if (!host.enabled) {
      continue
    }
    const conf = generateServerConfig(host, state.certificates)
    if (conf) {
      fs.writeFileSync(path.join(confDir, `host-${host.id}.conf`), conf)
    }
  }
}

/**
 * Apply a new state: regenerate configs, persist, and reload nginx when the
 * container is running. On reload failure, roll back to `previous`.
 */
async function commit(newState, previous) {
  try {
    await writeHostConfigs(newState)
    await writeState(newState)

    if (await docker.isProxyRunning()) {
      const reload = await docker.reloadNginx()
      if (!reload.ok) {
        throw new Error(reload.message || 'nginx rejected the new configuration.')
      }
    }
  } catch (error) {
    // Restore the last known-good state and configs.
    try {
      await writeHostConfigs(previous)
      await writeState(previous)
      if (await docker.isProxyRunning()) {
        await docker.reloadNginx()
      }
    } catch (rollbackError) {
      // ignore; original error is more useful
    }
    throw error
  }
}

// --- Config / status --------------------------------------------------------

// The proxy runs locally, so it's always available once Docker is up.
export function isConfigured() {
  return true
}

// --- Proxy hosts ------------------------------------------------------------

export async function getProxyHosts() {
  const state = await readState()
  return clone(state.proxyHosts)
}

export async function getProxyHost(id) {
  const state = await readState()
  return clone(state.proxyHosts.find(h => h.id === id) || null)
}

function normalizeHost(payload) {
  return {
    domain_names: Array.isArray(payload.domain_names) ? payload.domain_names.filter(Boolean) : [],
    forward_scheme: payload.forward_scheme === 'https' ? 'https' : 'http',
    forward_host: payload.forward_host || '',
    forward_port: Number(payload.forward_port) || 80,
    block_exploits: !!payload.block_exploits,
    allow_websocket_upgrade: !!payload.allow_websocket_upgrade,
    caching_enabled: !!payload.caching_enabled,
    certificate_id: Number(payload.certificate_id) || 0,
    ssl_forced: !!payload.ssl_forced,
    http2_support: !!payload.http2_support,
    hsts_enabled: !!payload.hsts_enabled,
    hsts_subdomains: !!payload.hsts_subdomains,
    advanced_config: payload.advanced_config || '',
    locations: Array.isArray(payload.locations) ? payload.locations : [],
    meta: payload.meta || {}
  }
}

export async function createProxyHost(payload) {
  const state = await readState()
  const previous = clone(state)

  const host = {
    id: state.nextHostId,
    enabled: true,
    ...normalizeHost(payload)
  }
  state.nextHostId += 1
  state.proxyHosts.push(host)

  await commit(state, previous)
  return clone(host)
}

export async function updateProxyHost(id, payload) {
  const state = await readState()
  const previous = clone(state)

  const index = state.proxyHosts.findIndex(h => h.id === id)
  if (index === -1) {
    throw new Error('Proxy host not found.')
  }

  state.proxyHosts[index] = {
    ...state.proxyHosts[index],
    ...normalizeHost(payload),
    id,
    enabled: state.proxyHosts[index].enabled
  }

  await commit(state, previous)
  return clone(state.proxyHosts[index])
}

export async function deleteProxyHost(id) {
  const state = await readState()
  const previous = clone(state)

  state.proxyHosts = state.proxyHosts.filter(h => h.id !== id)

  await commit(state, previous)
  return { ok: true }
}

async function setHostEnabled(id, enabled) {
  const state = await readState()
  const previous = clone(state)

  const host = state.proxyHosts.find(h => h.id === id)
  if (!host) {
    throw new Error('Proxy host not found.')
  }
  host.enabled = enabled

  await commit(state, previous)
  return clone(host)
}

export function enableProxyHost(id) {
  return setHostEnabled(id, true)
}

export function disableProxyHost(id) {
  return setHostEnabled(id, false)
}

// --- Certificates -----------------------------------------------------------

/**
 * Best-effort extraction of expiry + SANs from a PEM certificate.
 */
function certificateMeta(pem) {
  try {
    const x509 = new crypto.X509Certificate(pem)
    const sans = (x509.subjectAltName || '')
      .split(',')
      .map(entry => entry.trim())
      .filter(entry => entry.startsWith('DNS:'))
      .map(entry => entry.slice(4))

    return {
      expires_on: x509.validTo ? new Date(x509.validTo).toISOString() : undefined,
      domain_names: sans
    }
  } catch (error) {
    return { expires_on: undefined, domain_names: [] }
  }
}

export async function getCertificates() {
  const state = await readState()
  return clone(state.certificates)
}

/**
 * Create a locally-managed ("other") certificate from PEM contents. Writes
 * fullchain.pem + privkey.pem under certs/<id>/ and records metadata.
 * @param {string} niceName
 * @param {{certificate: string, certificateKey: string, intermediateCertificate?: string}} files
 */
export async function createCustomCertificate(niceName, files) {
  if (!files || !files.certificate || !files.certificateKey) {
    throw new Error('A certificate and certificate key are required.')
  }

  const state = await readState()
  const id = state.nextCertId

  const fullchain = files.intermediateCertificate
    ? `${files.certificate.trim()}\n${files.intermediateCertificate.trim()}\n`
    : `${files.certificate.trim()}\n`

  const certsDir = await getCertsDir()
  const dir = path.join(certsDir, String(id))
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'fullchain.pem'), fullchain)
  fs.writeFileSync(path.join(dir, 'privkey.pem'), `${files.certificateKey.trim()}\n`)

  const meta = certificateMeta(files.certificate)
  const record = {
    id,
    provider: 'other',
    nice_name: niceName || (meta.domain_names[0] || `certificate-${id}`),
    domain_names: meta.domain_names,
    expires_on: meta.expires_on,
    created_on: new Date().toISOString()
  }

  state.nextCertId += 1
  state.certificates.push(record)
  // No nginx reload needed: certs only take effect once a host references them.
  await writeState(state)

  return clone(record)
}

export async function deleteCertificate(id) {
  const state = await readState()
  const previous = clone(state)

  state.certificates = state.certificates.filter(c => c.id !== id)
  // Detach the certificate from any hosts that referenced it.
  for (const host of state.proxyHosts) {
    if (host.certificate_id === id) {
      host.certificate_id = 0
      host.ssl_forced = false
      host.http2_support = false
      host.hsts_enabled = false
      host.hsts_subdomains = false
    }
  }

  // Remove the cert files.
  try {
    const certsDir = await getCertsDir()
    fs.rmSync(path.join(certsDir, String(id)), { recursive: true, force: true })
  } catch (error) {
    // ignore filesystem cleanup errors
  }

  await commit(state, previous)
  return { ok: true }
}

export default {
  isConfigured,
  getProxyHosts,
  getProxyHost,
  createProxyHost,
  updateProxyHost,
  deleteProxyHost,
  enableProxyHost,
  disableProxyHost,
  getCertificates,
  createCustomCertificate,
  deleteCertificate
}
