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
        <div class="max-h-96 overflow-y-auto pr-1">
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
                <input v-model="form.forward_host" class="appearance-none border text-sm rounded w-full py-3 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="fhost" type="text" placeholder="127.0.0.1">
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
                <option value="new">Request a new SSL Certificate (Let's Encrypt)</option>
                <option v-for="cert in certificates" :key="cert.id" :value="cert.id">
                  {{ (cert.nice_name || cert.domain_names.join(', ')) }}
                </option>
              </select>
            </div>

            <div v-if="form.certificate_id === 'new'" class="mb-4 p-3 bg-gray-100 rounded">
              <label class="block text-gray-700 text-sm mb-1" for="leEmail">Let's Encrypt Email</label>
              <input v-model="form.letsencrypt_email" class="appearance-none border text-sm rounded w-full py-3 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline mb-2" id="leEmail" type="email">
              <label class="flex items-center text-sm text-gray-700">
                <input type="checkbox" v-model="form.letsencrypt_agree" class="mr-2"> I agree to the Let's Encrypt Terms of Service
              </label>
            </div>

            <template v-if="form.certificate_id !== 0">
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
          <button type="submit" :disabled="saving" class="relative inline-flex items-center py-2 pl-2 pr-3 border border-transparent text-sm leading-5 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:shadow-outline-indigo focus:border-indigo-700 active:bg-indigo-700 disabled:opacity-50">
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </form>
    </template>
  </Modal>
</template>

<script>
import Modal from '@/components/Modal.vue'
import npm from '../services/npm.js'

function defaultForm() {
  return {
    domainNames: '',
    forward_scheme: 'http',
    forward_host: '127.0.0.1',
    forward_port: 80,
    block_exploits: true,
    allow_websocket_upgrade: true,
    caching_enabled: false,
    certificate_id: 0,
    ssl_forced: false,
    http2_support: false,
    hsts_enabled: false,
    hsts_subdomains: false,
    letsencrypt_email: '',
    letsencrypt_agree: false,
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
      errorMessage: ''
    }
  },
  computed: {
    isEdit() {
      return Boolean(this.existing && this.existing.id)
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
          letsencrypt_email: (p.meta && p.meta.letsencrypt_email) || '',
          letsencrypt_agree: !!(p.meta && p.meta.letsencrypt_agree),
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
        this.certificates = await npm.getCertificates()
      } catch (error) {
        this.certificates = []
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

      const payload = {
        domain_names,
        forward_scheme: this.form.forward_scheme,
        forward_host: this.form.forward_host,
        forward_port: Number(this.form.forward_port),
        block_exploits: this.form.block_exploits,
        allow_websocket_upgrade: this.form.allow_websocket_upgrade,
        caching_enabled: this.form.caching_enabled,
        certificate_id: this.form.certificate_id,
        ssl_forced: this.form.certificate_id !== 0 ? this.form.ssl_forced : false,
        http2_support: this.form.certificate_id !== 0 ? this.form.http2_support : false,
        hsts_enabled: this.form.certificate_id !== 0 ? this.form.hsts_enabled : false,
        hsts_subdomains: this.form.certificate_id !== 0 ? this.form.hsts_subdomains : false,
        advanced_config: this.form.advanced_config,
        locations,
        access_list_id: 0,
        meta: {
          letsencrypt_agree: this.form.certificate_id === 'new' ? this.form.letsencrypt_agree : false,
          dns_challenge: false
        }
      }

      if (this.form.certificate_id === 'new') {
        if (!this.form.letsencrypt_agree) {
          throw new Error('You must agree to the Let\'s Encrypt Terms of Service.')
        }
        payload.meta.letsencrypt_email = this.form.letsencrypt_email
      }

      return payload
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
          await npm.updateProxyHost(this.existing.id, payload)
        } else {
          await npm.createProxyHost(payload)
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
    value(open) {
      if (open) {
        this.populate()
        this.loadCertificates()
      }
    }
  }
}
</script>
