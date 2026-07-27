<template>
  <Modal :value="value" @input="$emit('input', $event)" @closed="$emit('input', false)">
    <template v-slot="modal">
      <h3 class="text-xl mb-4">{{ isEdit ? 'Edit Proxy Host' : 'Add Proxy Host' }}</h3>

      <!-- Tabs -->
      <div class="flex border-b border-gray-200 mb-4 text-sm">
        <button type="button" @click="tab = 'details'" :class="tabClass('details')">Details</button>
        <button type="button" @click="tab = 'ssl'" :class="tabClass('ssl')">SSL</button>
        <button type="button" @click="tab = 'advanced'" :class="tabClass('advanced')">Advanced</button>
      </div>

      <form @submit.prevent="handleSubmit(modal)">
        <div class="max-h-96 overflow-y-auto px-1 -mx-1">
          <!-- Details -->
          <div v-show="tab === 'details'">
            <div class="mb-4">
              <label class="block text-gray-700 text-sm mb-1" for="domains">Domain Names (comma separated)</label>
              <input v-model="form.domainNames" class="appearance-none border text-sm rounded w-full py-3 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="domains" type="text">
            </div>
            <div class="flex space-x-3 mb-4">
              <div class="w-1/4">
                <label class="block text-gray-700 text-sm mb-1" for="scheme">Scheme</label>
                <select v-model="form.forward_scheme" id="scheme" class="border text-sm rounded w-full py-3 px-2 text-gray-700 focus:outline-none">
                  <option value="http">http</option>
                  <option value="https">https</option>
                </select>
              </div>
              <div class="flex-1">
                <label class="block text-gray-700 text-sm mb-1" for="fhost">Forward Host</label>
                <input v-model="form.forward_host" class="appearance-none border text-sm rounded w-full py-3 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="fhost" type="text" placeholder="host.docker.internal">
              </div>
              <div class="w-1/4">
                <label class="block text-gray-700 text-sm mb-1" for="fport">Port</label>
                <input v-model.number="form.forward_port" class="appearance-none border text-sm rounded w-full py-3 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="fport" type="number">
              </div>
            </div>
            <label class="flex items-center mb-2 text-sm text-gray-700">
              <input type="checkbox" v-model="form.block_exploits" class="mr-2"> Block Common Exploits
            </label>
            <label class="flex items-center mb-2 text-sm text-gray-700">
              <input type="checkbox" v-model="form.allow_websocket_upgrade" class="mr-2"> Websockets Support
            </label>
            <label class="flex items-center mb-2 text-sm text-gray-700">
              <input type="checkbox" v-model="form.caching_enabled" class="mr-2"> Cache Assets
            </label>
          </div>

          <!-- SSL -->
          <div v-show="tab === 'ssl'">
            <div class="mb-4">
              <label class="block text-gray-700 text-sm mb-1" for="cert">SSL Certificate</label>
              <select v-model="form.certificate_id" id="cert" class="border text-sm rounded w-full py-3 px-2 text-gray-700 focus:outline-none">
                <option :value="0">None</option>
                <option value="new">+ Create a new certificate…</option>
                <option v-for="cert in certificates" :key="cert.id" :value="cert.id">
                  {{ (cert.nice_name || cert.domain_names.join(', ')) }}
                </option>
              </select>
            </div>

            <!-- Inline certificate creation -->
            <div v-if="form.certificate_id === 'new'" class="mb-4 p-3 bg-gray-50 border border-gray-200 rounded">
              <div class="flex border-b border-gray-200 mb-3 text-xs">
                <button type="button" @click="certPanel.mode = 'generate'" :class="certTabClass('generate')">Generate (mkcert)</button>
                <button type="button" @click="certPanel.mode = 'custom'" :class="certTabClass('custom')">Custom Upload</button>
              </div>

              <!-- Generate with mkcert -->
              <div v-if="certPanel.mode === 'generate'">
                <div v-if="!mkcertAvailable" class="mb-3 p-2 bg-yellow-50 text-yellow-800 text-xs rounded">
                  mkcert was not found. Install it (e.g. <span class="font-mono">brew install mkcert</span>) to generate certificates.
                </div>
                <label class="block text-gray-700 text-sm mb-1">Hostnames (comma separated)</label>
                <input v-model="certPanel.hostnames" type="text" class="appearance-none border text-sm rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline mb-2">
                <label class="block text-gray-700 text-sm mb-1">Name (optional)</label>
                <input v-model="certPanel.niceName" type="text" placeholder="Defaults to the first hostname" class="appearance-none border text-sm rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
              </div>

              <!-- Custom upload -->
              <div v-else>
                <label class="block text-gray-700 text-sm mb-1">Name</label>
                <input v-model="certPanel.niceName" type="text" placeholder="My Certificate" class="appearance-none border text-sm rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline mb-2">
                <label class="block text-gray-700 text-sm mb-1">Certificate (.pem / .crt)</label>
                <input type="file" accept=".pem,.crt,.cert,.cer" @change="onCertFile($event, 'certificate')" class="block w-full text-sm text-gray-700 mb-2">
                <label class="block text-gray-700 text-sm mb-1">Certificate Key (.pem / .key)</label>
                <input type="file" accept=".pem,.key" @change="onCertFile($event, 'certificateKey')" class="block w-full text-sm text-gray-700 mb-2">
                <label class="block text-gray-700 text-sm mb-1">Intermediate Certificate (optional)</label>
                <input type="file" accept=".pem,.crt,.cert,.cer" @change="onCertFile($event, 'intermediateCertificate')" class="block w-full text-sm text-gray-700">
              </div>

              <p v-if="certPanel.error" class="text-red-700 text-xs mt-2">{{ certPanel.error }}</p>

              <div class="flex justify-end mt-3">
                <button type="button" @click="createInlineCertificate" :disabled="certPanel.creating || (certPanel.mode === 'generate' && !mkcertAvailable)" class="inline-flex items-center py-1.5 px-3 border border-transparent text-xs leading-5 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none disabled:opacity-50">
                  {{ certPanel.creating ? 'Creating…' : 'Create certificate' }}
                </button>
              </div>
            </div>

            <template v-if="isRealCert">
              <label class="flex items-center mb-2 text-sm text-gray-700">
                <input type="checkbox" v-model="form.ssl_forced" class="mr-2"> Force SSL
              </label>
              <label class="flex items-center mb-2 text-sm text-gray-700">
                <input type="checkbox" v-model="form.http2_support" class="mr-2"> HTTP/2 Support
              </label>
              <label class="flex items-center mb-2 text-sm text-gray-700">
                <input type="checkbox" v-model="form.hsts_enabled" class="mr-2"> HSTS Enabled
              </label>
              <label class="flex items-center mb-2 text-sm text-gray-700">
                <input type="checkbox" v-model="form.hsts_subdomains" class="mr-2" :disabled="!form.hsts_enabled"> HSTS Subdomains
              </label>
            </template>
          </div>

          <!-- Advanced -->
          <div v-show="tab === 'advanced'">
            <div class="mb-4">
              <label class="block text-gray-700 text-sm mb-1" for="adv">Custom Nginx Configuration</label>
              <textarea v-model="form.advanced_config" id="adv" rows="5" class="appearance-none border text-sm rounded w-full py-3 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline font-mono"></textarea>
            </div>
            <div class="mb-4">
              <label class="block text-gray-700 text-sm mb-1" for="locs">Custom Locations (JSON array)</label>
              <textarea v-model="form.locationsRaw" id="locs" rows="4" class="appearance-none border text-sm rounded w-full py-3 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline font-mono" placeholder="[]"></textarea>
            </div>
          </div>
        </div>

        <p v-if="errorMessage" class="text-red-700 text-sm mt-3">{{ errorMessage }}</p>

        <div class="flex items-center justify-end mt-4">
          <button type="button" @click="modal.close()" class="mr-3 inline-flex items-center py-2 px-3 border border-gray-300 text-sm leading-5 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none">
            Cancel
          </button>
          <button type="submit" :disabled="saving" class="relative inline-flex items-center py-2 pl-2 pr-3 border border-transparent text-sm leading-5 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:shadow-outline-indigo focus:border-indigo-700 active:bg-indigo-700 disabled:opacity-50">
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </form>
    </template>
  </Modal>
</template>

<script>
import fs from 'fs'
import Modal from '@/components/Modal.vue'
import proxy from '../services/proxy.js'
import mkcert from '../services/mkcert.js'

function defaultCertPanel() {
  return {
    mode: 'generate',
    hostnames: '',
    niceName: '',
    creating: false,
    error: '',
    files: { certificate: null, certificateKey: null, intermediateCertificate: null }
  }
}

function defaultForm() {
  return {
    domainNames: '',
    forward_scheme: 'https',
    forward_host: 'host.docker.internal',
    forward_port: 80,
    block_exploits: true,
    allow_websocket_upgrade: true,
    caching_enabled: false,
    certificate_id: 0,
    ssl_forced: false,
    http2_support: false,
    hsts_enabled: false,
    hsts_subdomains: false,
    advanced_config: '',
    locationsRaw: '[]'
  }
}

export default {
  name: 'ProxyHostModal',
  components: { Modal },
  props: {
    value: { type: Boolean, default: false },
    hostname: { type: String, default: '' },
    existing: { type: Object, default: null }
  },
  data() {
    return {
      tab: 'details',
      form: defaultForm(),
      certificates: [],
      saving: false,
      errorMessage: '',
      certPanel: defaultCertPanel(),
      mkcertAvailable: false
    }
  },
  computed: {
    isEdit() {
      return Boolean(this.existing && this.existing.id)
    },
    // A real, saved certificate is selected (not "None" and not the inline
    // "create new" placeholder).
    isRealCert() {
      return typeof this.form.certificate_id === 'number' && this.form.certificate_id !== 0
    }
  },
  methods: {
    tabClass(name) {
      return [
        'px-4 py-2 -mb-px border-b-2 focus:outline-none',
        this.tab === name
          ? 'border-indigo-600 text-indigo-600 font-medium'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      ]
    },

    certTabClass(name) {
      return [
        'px-3 py-1.5 -mb-px border-b-2 focus:outline-none',
        this.certPanel.mode === name
          ? 'border-indigo-600 text-indigo-600 font-medium'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      ]
    },

    populate() {
      this.tab = 'details'
      this.errorMessage = ''
      this.saving = false

      if (this.isEdit) {
        const p = this.existing
        this.form = {
          domainNames: (p.domain_names || []).join(', '),
          forward_scheme: p.forward_scheme || 'http',
          forward_host: p.forward_host || '',
          forward_port: p.forward_port || 80,
          block_exploits: !!p.block_exploits,
          allow_websocket_upgrade: !!p.allow_websocket_upgrade,
          caching_enabled: !!p.caching_enabled,
          certificate_id: p.certificate_id || 0,
          ssl_forced: !!p.ssl_forced,
          http2_support: !!p.http2_support,
          hsts_enabled: !!p.hsts_enabled,
          hsts_subdomains: !!p.hsts_subdomains,
          advanced_config: p.advanced_config || '',
          locationsRaw: JSON.stringify(p.locations || [], null, 2)
        }
      } else {
        this.form = defaultForm()
        if (this.hostname) {
          this.form.domainNames = this.hostname
        }
      }
    },

    async loadCertificates() {
      try {
        this.certificates = await proxy.getCertificates()
      } catch (error) {
        this.certificates = []
      }
    },

    parseList(value) {
      return (value || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
    },

    onCertFile(event, key) {
      const file = event.target.files && event.target.files[0]
      this.certPanel.files[key] = file || null
    },

    readFile(file) {
      // Electron exposes the absolute path on File objects (nodeIntegration).
      return fs.readFileSync(file.path, 'utf8')
    },

    async createInlineCertificate() {
      this.certPanel.error = ''
      this.certPanel.creating = true

      try {
        let created
        if (this.certPanel.mode === 'generate') {
          const hostnames = this.parseList(this.certPanel.hostnames)
          if (hostnames.length === 0) {
            throw new Error('Please enter at least one hostname.')
          }

          const result = await mkcert.generate(hostnames)
          if (!result.ok) {
            throw new Error(result.message)
          }

          const name = this.certPanel.niceName.trim() || hostnames[0]
          created = await proxy.createCustomCertificate(name, {
            certificate: result.certificate,
            certificateKey: result.certificateKey
          })
        } else {
          if (!this.certPanel.niceName.trim()) {
            throw new Error('Please provide a name.')
          }
          if (!this.certPanel.files.certificate || !this.certPanel.files.certificateKey) {
            throw new Error('Both a certificate and a certificate key are required.')
          }

          const files = {
            certificate: this.readFile(this.certPanel.files.certificate),
            certificateKey: this.readFile(this.certPanel.files.certificateKey)
          }
          if (this.certPanel.files.intermediateCertificate) {
            files.intermediateCertificate = this.readFile(this.certPanel.files.intermediateCertificate)
          }

          created = await proxy.createCustomCertificate(this.certPanel.niceName.trim(), files)
        }

        await this.loadCertificates()
        // Select the freshly created certificate for this proxy host.
        this.form.certificate_id = created.id
        this.certPanel = defaultCertPanel()
      } catch (error) {
        this.certPanel.error = error.message || 'Failed to create certificate.'
      } finally {
        this.certPanel.creating = false
      }
    },

    buildPayload() {
      const domain_names = this.form.domainNames
        .split(',')
        .map(d => d.trim())
        .filter(Boolean)

      if (domain_names.length === 0) {
        throw new Error('Please enter at least one domain name.')
      }

      let locations = []
      const raw = (this.form.locationsRaw || '').trim()
      if (raw) {
        try {
          locations = JSON.parse(raw)
          if (!Array.isArray(locations)) {
            throw new Error('Custom Locations must be a JSON array.')
          }
        } catch (error) {
          throw new Error('Custom Locations must be valid JSON.')
        }
      }

      if (this.form.certificate_id === 'new') {
        throw new Error('Finish creating the certificate (or choose None) before saving.')
      }

      const certificateId = Number(this.form.certificate_id) || 0
      const hasCert = certificateId !== 0

      return {
        domain_names,
        forward_scheme: this.form.forward_scheme,
        forward_host: this.form.forward_host,
        forward_port: Number(this.form.forward_port),
        block_exploits: this.form.block_exploits,
        allow_websocket_upgrade: this.form.allow_websocket_upgrade,
        caching_enabled: this.form.caching_enabled,
        certificate_id: certificateId,
        ssl_forced: hasCert ? this.form.ssl_forced : false,
        http2_support: hasCert ? this.form.http2_support : false,
        hsts_enabled: hasCert ? this.form.hsts_enabled : false,
        hsts_subdomains: hasCert ? this.form.hsts_subdomains : false,
        advanced_config: this.form.advanced_config,
        locations
      }
    },

    async handleSubmit(modal) {
      let payload
      try {
        payload = this.buildPayload()
      } catch (error) {
        this.errorMessage = error.message
        return
      }

      this.saving = true
      this.errorMessage = ''

      try {
        if (this.isEdit) {
          await proxy.updateProxyHost(this.existing.id, payload)
        } else {
          await proxy.createProxyHost(payload)
        }
        this.$emit('saved')
        modal.close()
      } catch (error) {
        this.errorMessage = error.message || 'Failed to save proxy host.'
      } finally {
        this.saving = false
      }
    }
  },
  watch: {
    async value(open) {
      if (open) {
        this.populate()
        this.certPanel = defaultCertPanel()
        this.loadCertificates()
        this.mkcertAvailable = await mkcert.isAvailable()
      }
    },

    // When the user picks "Create a new certificate…", prefill it with the
    // hostname(s) this proxy host is being added for.
    'form.certificate_id'(value) {
      if (value === 'new') {
        const domains = this.form.domainNames.trim()
        if (!this.certPanel.hostnames) {
          this.certPanel.hostnames = domains
        }
        if (!this.certPanel.niceName) {
          this.certPanel.niceName = this.parseList(domains)[0] || ''
        }
      }
    }
  }
}
</script>
