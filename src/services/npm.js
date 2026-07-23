import http from 'http'
import https from 'https'
import { URL } from 'url'

const STORAGE_KEY = 'npm'

const DEFAULT_CONFIG = {
  baseUrl: 'http://127.0.0.1:81',
  identity: '',
  secret: ''
}

// In-memory token cache: { token, expires (epoch ms) }
let tokenCache = null

export function getConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { ...DEFAULT_CONFIG }
    }
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch (error) {
    console.error(error)
    return { ...DEFAULT_CONFIG }
  }
}

export function saveConfig(config) {
  const merged = { ...getConfig(), ...config }
  // Normalise base URL: strip trailing slashes.
  merged.baseUrl = (merged.baseUrl || DEFAULT_CONFIG.baseUrl).replace(/\/+$/, '')
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  // Invalidate cached token since credentials/host may have changed.
  tokenCache = null
  return merged
}

export function isConfigured() {
  const config = getConfig()
  return Boolean(config.baseUrl && config.identity && config.secret)
}

/**
 * Low-level HTTP request using Node's http/https modules. We deliberately avoid
 * `fetch` so calls to the NPM admin port aren't subject to browser CORS rules.
 */
function httpRequest(method, url, { headers = {}, body = null, raw = null } = {}) {
  return new Promise((resolve, reject) => {
    let parsed
    try {
      parsed = new URL(url)
    } catch (error) {
      reject(error)
      return
    }

    const transport = parsed.protocol === 'https:' ? https : http
    // `raw` lets callers send a pre-built body (e.g. multipart/form-data) with a
    // custom content type; otherwise `body` is JSON-encoded.
    const payload = raw ? raw.buffer : (body === null ? null : JSON.stringify(body))

    const options = {
      method,
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: `${parsed.pathname}${parsed.search}`,
      headers: {
        Accept: 'application/json',
        ...headers
      }
    }

    if (payload !== null) {
      options.headers['Content-Type'] = raw ? raw.contentType : 'application/json'
      options.headers['Content-Length'] = Buffer.byteLength(payload)
    }

    const req = transport.request(options, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        let json = null
        if (data) {
          try {
            json = JSON.parse(data)
          } catch (error) {
            json = data
          }
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(json)
        } else {
          const message = json && json.error && json.error.message
            ? json.error.message
            : `Request failed with status ${res.statusCode}`
          const err = new Error(message)
          err.status = res.statusCode
          err.body = json
          reject(err)
        }
      })
    })

    req.on('error', reject)

    if (payload !== null) {
      req.write(payload)
    }

    req.end()
  })
}

export async function authenticate(force = false) {
  const config = getConfig()

  if (!config.identity || !config.secret) {
    throw new Error('Nginx Proxy Manager credentials are not configured.')
  }

  const now = Date.now()
  if (!force && tokenCache && tokenCache.expires - 60000 > now) {
    return tokenCache.token
  }

  const result = await httpRequest('POST', `${config.baseUrl}/api/tokens`, {
    body: { identity: config.identity, secret: config.secret }
  })

  if (!result || !result.token) {
    throw new Error('Authentication failed: no token returned.')
  }

  tokenCache = {
    token: result.token,
    expires: result.expires ? new Date(result.expires).getTime() : now + 3600000
  }

  return tokenCache.token
}

async function request(method, path, body = null, auth = true) {
  const config = getConfig()
  const headers = {}

  if (auth) {
    const token = await authenticate()
    headers.Authorization = `Bearer ${token}`
  }

  return httpRequest(method, `${config.baseUrl}${path}`, { headers, body })
}

export async function testConnection() {
  try {
    const health = await httpRequest('GET', `${getConfig().baseUrl}/api/`)
    if (!health || health.status !== 'OK') {
      return { ok: false, message: 'Nginx Proxy Manager did not report a healthy status.' }
    }
    await authenticate(true)
    return { ok: true, message: 'Connected successfully.', version: health.version }
  } catch (error) {
    return { ok: false, message: error.message || 'Connection failed.' }
  }
}

/**
 * Lightweight health check: resolves true when the NPM API answers OK.
 */
export async function ping() {
  try {
    const health = await httpRequest('GET', `${getConfig().baseUrl}/api/`)
    return Boolean(health && health.status === 'OK')
  } catch (error) {
    return false
  }
}

/**
 * Poll the NPM API until it becomes reachable or the timeout elapses. Useful
 * right after starting the container, since it takes time to boot.
 */
export async function waitUntilReady(timeoutMs = 60000, intervalMs = 2000) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (await ping()) {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }

  return false
}

export function getProxyHosts() {
  return request('GET', '/api/nginx/proxy-hosts?expand=certificate,access_list,owner')
}

export function getProxyHost(id) {
  return request('GET', `/api/nginx/proxy-hosts/${id}`)
}

export function createProxyHost(payload) {
  return request('POST', '/api/nginx/proxy-hosts', payload)
}

export function updateProxyHost(id, payload) {
  return request('PUT', `/api/nginx/proxy-hosts/${id}`, payload)
}

export function deleteProxyHost(id) {
  return request('DELETE', `/api/nginx/proxy-hosts/${id}`)
}

export function enableProxyHost(id) {
  return request('POST', `/api/nginx/proxy-hosts/${id}/enable`, {})
}

export function disableProxyHost(id) {
  return request('POST', `/api/nginx/proxy-hosts/${id}/disable`, {})
}

export function getCertificates() {
  return request('GET', '/api/nginx/certificates?expand=owner')
}

export function deleteCertificate(id) {
  return request('DELETE', `/api/nginx/certificates/${id}`)
}

/**
 * Request a new Let's Encrypt certificate.
 * @param {string[]} domainNames
 * @param {string} email
 */
export function createLetsEncryptCertificate(domainNames, email) {
  return request('POST', '/api/nginx/certificates', {
    provider: 'letsencrypt',
    domain_names: domainNames,
    meta: {
      letsencrypt_email: email,
      letsencrypt_agree: true,
      dns_challenge: false
    }
  })
}

/**
 * Build a multipart/form-data body from the given fields.
 * @param {Array<{name: string, content: string|Buffer, filename?: string, contentType?: string}>} fields
 */
function buildMultipart(fields) {
  const boundary = `----owlsBoundary${Date.now()}${Math.random().toString(16).slice(2)}`
  const chunks = []

  for (const field of fields) {
    chunks.push(Buffer.from(`--${boundary}\r\n`))
    if (field.filename) {
      chunks.push(Buffer.from(
        `Content-Disposition: form-data; name="${field.name}"; filename="${field.filename}"\r\n`
      ))
      chunks.push(Buffer.from(`Content-Type: ${field.contentType || 'application/octet-stream'}\r\n\r\n`))
    } else {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${field.name}"\r\n\r\n`))
    }
    chunks.push(Buffer.isBuffer(field.content) ? field.content : Buffer.from(String(field.content)))
    chunks.push(Buffer.from('\r\n'))
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`))

  return { boundary, body: Buffer.concat(chunks) }
}

async function requestMultipart(path, fields) {
  const token = await authenticate()
  const { boundary, body } = buildMultipart(fields)

  return httpRequest('POST', `${getConfig().baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    raw: { contentType: `multipart/form-data; boundary=${boundary}`, buffer: body }
  })
}

function certificateFields(files) {
  const fields = [
    { name: 'certificate', filename: 'certificate.pem', contentType: 'application/x-pem-file', content: files.certificate },
    { name: 'certificate_key', filename: 'certificate_key.pem', contentType: 'application/x-pem-file', content: files.certificateKey }
  ]

  if (files.intermediateCertificate) {
    fields.push({
      name: 'intermediate_certificate',
      filename: 'intermediate.pem',
      contentType: 'application/x-pem-file',
      content: files.intermediateCertificate
    })
  }

  return fields
}

/**
 * Upload the PEM contents for an existing (provider "other") certificate record.
 */
export function uploadCertificate(id, files) {
  return requestMultipart(`/api/nginx/certificates/${id}/upload`, certificateFields(files))
}

/**
 * Create a custom ("other") certificate: create the record, then upload the
 * certificate/key (and optional intermediate) PEM contents.
 * @param {string} niceName
 * @param {{certificate: string, certificateKey: string, intermediateCertificate?: string}} files
 */
export async function createCustomCertificate(niceName, files) {
  const created = await request('POST', '/api/nginx/certificates', {
    provider: 'other',
    nice_name: niceName
  })

  try {
    await uploadCertificate(created.id, files)
  } catch (error) {
    // Roll back the empty record if the upload was rejected.
    try {
      await deleteCertificate(created.id)
    } catch (cleanupError) {
      // ignore cleanup failure
    }
    throw error
  }

  return created
}

export default {
  getConfig,
  saveConfig,
  isConfigured,
  authenticate,
  testConnection,
  ping,
  waitUntilReady,
  getProxyHosts,
  getProxyHost,
  createProxyHost,
  updateProxyHost,
  deleteProxyHost,
  enableProxyHost,
  disableProxyHost,
  getCertificates,
  deleteCertificate,
  createLetsEncryptCertificate,
  uploadCertificate,
  createCustomCertificate
}
