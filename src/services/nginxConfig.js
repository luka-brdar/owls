// Generates an nginx `server { ... }` block for a single proxy host. Paths are
// the in-container mount points defined by docker-compose.yml:
//   conf.d  -> /etc/nginx/conf.d
//   certs   -> /etc/nginx/certs
//   logs    -> /var/log/nginx

const PROXY_INCLUDE = '/etc/nginx/conf.d/include/proxy.conf'
const BLOCK_EXPLOITS_INCLUDE = '/etc/nginx/conf.d/include/block-exploits.conf'

const CACHED_ASSET_EXTENSIONS = 'jpg|jpeg|png|gif|ico|css|js|woff|woff2|ttf|svg|eot|otf|webp|avif|mp4|webm'

function sanitizePort(value) {
  const port = Number(value)
  return Number.isFinite(port) && port > 0 ? port : 80
}

function upstream(host) {
  const scheme = host.forward_scheme === 'https' ? 'https' : 'http'
  return `${scheme}://${host.forward_host}:${sanitizePort(host.forward_port)}`
}

function websocketLines(indent = '    ') {
  return [
    `${indent}proxy_set_header Upgrade $http_upgrade;`,
    `${indent}proxy_set_header Connection $connection_upgrade;`
  ].join('\n')
}

function customLocationBlock(host, location) {
  if (!location || !location.path) {
    return ''
  }

  const scheme = location.forward_scheme || host.forward_scheme || 'http'
  const fwdHost = location.forward_host || host.forward_host
  const fwdPort = sanitizePort(location.forward_port || host.forward_port)
  const target = `${scheme}://${fwdHost}:${fwdPort}`

  const lines = [
    `  location ${location.path} {`,
    `    include ${PROXY_INCLUDE};`
  ]

  if (host.allow_websocket_upgrade) {
    lines.push(websocketLines())
  }
  if (location.advanced_config) {
    lines.push(indentBlock(location.advanced_config, '    '))
  }

  lines.push(`    proxy_pass ${target};`)
  lines.push('  }')
  return lines.join('\n')
}

function indentBlock(text, indent) {
  return String(text)
    .split('\n')
    .map(line => (line.trim() ? `${indent}${line.trim()}` : ''))
    .join('\n')
}

/**
 * Build the nginx server block for a proxy host.
 * @param {object} host - proxy host record
 * @param {object[]} certificates - all known certificate records
 * @returns {string}
 */
export function generateServerConfig(host, certificates = []) {
  const domains = (host.domain_names || []).filter(Boolean)
  if (domains.length === 0) {
    return ''
  }

  const cert = host.certificate_id
    ? certificates.find(c => c.id === host.certificate_id)
    : null
  const sslEnabled = Boolean(cert)

  const lines = []
  lines.push(`# ------------------------------------------------------------`)
  lines.push(`# ${domains.join(', ')} (host ${host.id})`)
  lines.push(`# ------------------------------------------------------------`)
  lines.push(`server {`)
  lines.push(`  listen 80;`)
  lines.push(`  listen [::]:80;`)

  if (sslEnabled) {
    lines.push(`  listen 443 ssl;`)
    lines.push(`  listen [::]:443 ssl;`)
    if (host.http2_support) {
      lines.push(`  http2 on;`)
    }
  }

  lines.push(`  server_name ${domains.join(' ')};`)
  lines.push('')
  lines.push(`  access_log /var/log/nginx/host-${host.id}_access.log;`)
  lines.push(`  error_log /var/log/nginx/host-${host.id}_error.log warn;`)

  if (sslEnabled) {
    lines.push('')
    lines.push(`  ssl_certificate /etc/nginx/certs/${cert.id}/fullchain.pem;`)
    lines.push(`  ssl_certificate_key /etc/nginx/certs/${cert.id}/privkey.pem;`)

    if (host.hsts_enabled) {
      const subdomains = host.hsts_subdomains ? '; includeSubDomains' : ''
      lines.push(`  add_header Strict-Transport-Security "max-age=63072000${subdomains}; preload" always;`)
    }
  }

  if (host.block_exploits) {
    lines.push('')
    lines.push(`  include ${BLOCK_EXPLOITS_INCLUDE};`)
  }

  if (sslEnabled && host.ssl_forced) {
    lines.push('')
    lines.push(`  if ($scheme = http) {`)
    lines.push(`    return 301 https://$host$request_uri;`)
    lines.push(`  }`)
  }

  if (host.advanced_config) {
    lines.push('')
    lines.push(indentBlock(host.advanced_config, '  '))
  }

  // Cached static assets (client-side caching headers) when enabled.
  if (host.caching_enabled) {
    lines.push('')
    lines.push(`  location ~* \\.(${CACHED_ASSET_EXTENSIONS})$ {`)
    lines.push(`    include ${PROXY_INCLUDE};`)
    if (host.allow_websocket_upgrade) {
      lines.push(websocketLines())
    }
    lines.push(`    expires 1d;`)
    lines.push(`    add_header Cache-Control "public";`)
    lines.push(`    proxy_pass ${upstream(host)};`)
    lines.push(`  }`)
  }

  // Main location.
  lines.push('')
  lines.push(`  location / {`)
  lines.push(`    include ${PROXY_INCLUDE};`)
  if (host.allow_websocket_upgrade) {
    lines.push(websocketLines())
  }
  lines.push(`    proxy_pass ${upstream(host)};`)
  lines.push(`  }`)

  // Custom locations.
  for (const location of host.locations || []) {
    const block = customLocationBlock(host, location)
    if (block) {
      lines.push('')
      lines.push(block)
    }
  }

  lines.push(`}`)
  lines.push('')

  return lines.join('\n')
}

export default { generateServerConfig }
