<template>
  <Modal v-model="open" @closed="reset">
    <template v-slot:activator="{ on }">
      <slot :on="on">
        <button v-on="on" type="button" title="Certificates" class="relative inline-flex items-center py-1 px-2 border border-transparent text-xs leading-5 font-medium rounded-md text-gray-600 hover:text-gray-900 focus:outline-none">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
        </button>
      </slot>
    </template>

    <template v-slot="modal">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-xl">SSL Certificates</h3>
        <button v-if="!adding" @click="startAdd" type="button" class="inline-flex items-center py-1 px-2 border border-transparent text-xs leading-5 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none">
          <svg fill="currentColor" viewBox="0 0 20 20" class="w-4 h-4 mr-1"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"></path></svg>
          Add Certificate
        </button>
        <button v-else @click="cancelAdd" type="button" class="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 focus:outline-none">
          &larr; Back
        </button>
      </div>

      <!-- List -->
      <div v-show="!adding">
        <p v-if="loading" class="text-sm text-gray-500 py-4">Loading...</p>
        <p v-else-if="certificates.length === 0" class="text-sm text-gray-400 py-4">No certificates yet.</p>
        <ul v-else class="divide-y divide-gray-200 max-h-80 overflow-y-auto">
          <li v-for="cert in certificates" :key="cert.id" class="py-3 flex items-center justify-between">
            <div class="min-w-0">
              <div class="text-sm font-medium text-gray-900 truncate">
                {{ cert.nice_name || (cert.domain_names || []).join(', ') }}
                <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" :class="cert.provider === 'letsencrypt' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'">
                  {{ cert.provider === 'letsencrypt' ? "Let's Encrypt" : 'Custom' }}
                </span>
              </div>
              <div class="text-xs text-gray-500 truncate">
                {{ (cert.domain_names || []).join(', ') }}
                <span v-if="cert.expires_on"> &middot; expires {{ formatDate(cert.expires_on) }}</span>
              </div>
            </div>
            <button @click="handleDelete(cert)" type="button" class="ml-4 flex-shrink-0 text-sm focus:outline-none" :class="confirmingId === cert.id ? 'text-red-700 font-medium' : 'text-red-600 hover:text-red-800'">
              {{ confirmingId === cert.id ? 'Confirm?' : 'Delete' }}
            </button>
          </li>
        </ul>
      </div>

      <!-- Add -->
      <form v-show="adding" @submit.prevent="handleSubmit">
        <div class="flex border-b border-gray-200 mb-4 text-sm">
          <button type="button" @click="mode = 'generate'" :class="tabClass('generate')">Generate (mkcert)</button>
          <button type="button" @click="mode = 'custom'" :class="tabClass('custom')">Custom Upload</button>
        </div>

        <!-- Generate with mkcert -->
        <div v-if="mode === 'generate'">
          <div v-if="!mkcertAvailable" class="mb-4 p-3 bg-yellow-50 text-yellow-800 text-sm rounded">
            mkcert was not found on your system. Install it (e.g. <span class="font-mono">brew install mkcert</span>) to generate certificates on the fly.
          </div>
          <div class="mb-4">
            <label class="block text-gray-700 text-sm mb-1" for="genHosts">Hostnames (comma separated)</label>
            <input v-model="form.mkcertHostnames" id="genHosts" type="text" class="appearance-none border text-sm rounded w-full py-3 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" placeholder="myapp.test, *.myapp.test">
          </div>
          <div class="mb-2">
            <label class="block text-gray-700 text-sm mb-1" for="genName">Name (optional)</label>
            <input v-model="form.niceName" id="genName" type="text" class="appearance-none border text-sm rounded w-full py-3 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" placeholder="Defaults to the first hostname">
          </div>
          <p class="text-xs text-gray-500">A locally-trusted certificate is created with your mkcert CA and stored for the proxy to use.</p>
        </div>

        <!-- Custom upload -->
        <div v-else><!-- mode === 'custom' -->
          <div class="mb-4">
            <label class="block text-gray-700 text-sm mb-1" for="niceName">Name</label>
            <input v-model="form.niceName" id="niceName" type="text" class="appearance-none border text-sm rounded w-full py-3 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" placeholder="My Certificate">
          </div>
          <div class="mb-4">
            <label class="block text-gray-700 text-sm mb-1" for="certFile">Certificate (.pem / .crt)</label>
            <input id="certFile" type="file" accept=".pem,.crt,.cert,.cer" @change="onFile($event, 'certificate')" class="block w-full text-sm text-gray-700">
          </div>
          <div class="mb-4">
            <label class="block text-gray-700 text-sm mb-1" for="keyFile">Certificate Key (.pem / .key)</label>
            <input id="keyFile" type="file" accept=".pem,.key" @change="onFile($event, 'certificateKey')" class="block w-full text-sm text-gray-700">
          </div>
          <div class="mb-4">
            <label class="block text-gray-700 text-sm mb-1" for="interFile">Intermediate Certificate (optional)</label>
            <input id="interFile" type="file" accept=".pem,.crt,.cert,.cer" @change="onFile($event, 'intermediateCertificate')" class="block w-full text-sm text-gray-700">
          </div>
        </div>

        <p v-if="errorMessage" class="text-red-700 text-sm mt-2">{{ errorMessage }}</p>

        <div class="flex items-center justify-end mt-4 space-x-3">
          <button type="button" @click="cancelAdd" class="inline-flex items-center py-2 px-3 border border-gray-300 text-sm leading-5 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none">
            Cancel
          </button>
          <button type="submit" :disabled="saving || (mode === 'generate' && !mkcertAvailable)" class="inline-flex items-center py-2 pl-2 pr-3 border border-transparent text-sm leading-5 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none disabled:opacity-50">
            {{ saveLabel }}
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

function defaultForm() {
  return {
    niceName: '',
    mkcertHostnames: ''
  }
}

export default {
  name: 'CertificatesModal',
  components: { Modal },
  data() {
    return {
      open: false,
      loading: false,
      adding: false,
      mode: 'generate',
      mkcertAvailable: false,
      certificates: [],
      files: { certificate: null, certificateKey: null, intermediateCertificate: null },
      form: defaultForm(),
      saving: false,
      errorMessage: '',
      confirmingId: null
    }
  },

  computed: {
    saveLabel() {
      if (this.saving) {
        return this.mode === 'generate' ? 'Generating...' : 'Saving...'
      }
      return this.mode === 'generate' ? 'Generate & Save' : 'Save'
    }
  },

  methods: {
    tabClass(name) {
      return [
        'px-3 py-2 -mb-px border-b-2 focus:outline-none',
        this.mode === name
          ? 'border-indigo-600 text-indigo-600 font-medium'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      ]
    },

    formatDate(value) {
      const date = new Date(value)
      return isNaN(date.getTime()) ? value : date.toLocaleDateString()
    },

    async loadCertificates() {
      this.loading = true
      try {
        this.certificates = await proxy.getCertificates()
      } catch (error) {
        this.errorMessage = error.message || 'Could not load certificates.'
      } finally {
        this.loading = false
      }
    },

    startAdd() {
      this.errorMessage = ''
      this.mode = this.mkcertAvailable ? 'generate' : 'custom'
      this.adding = true
    },

    onFile(event, key) {
      const file = event.target.files && event.target.files[0]
      this.files[key] = file || null
    },

    readFile(file) {
      // Electron exposes the absolute path on File objects (nodeIntegration).
      return fs.readFileSync(file.path, 'utf8')
    },

    parseList(value) {
      return (value || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
    },

    async handleSubmit() {
      this.errorMessage = ''
      this.saving = true

      try {
        if (this.mode === 'generate') {
          await this.submitGenerate()
        } else {
          await this.submitCustom()
        }

        await this.loadCertificates()
        this.$emit('saved')
        this.cancelAdd()
      } catch (error) {
        this.errorMessage = error.message || 'Failed to add certificate.'
      } finally {
        this.saving = false
      }
    },

    async submitGenerate() {
      const hostnames = this.parseList(this.form.mkcertHostnames)
      if (hostnames.length === 0) {
        throw new Error('Please enter at least one hostname.')
      }

      const result = await mkcert.generate(hostnames)
      if (!result.ok) {
        throw new Error(result.message)
      }

      const name = this.form.niceName.trim() || hostnames[0]
      await proxy.createCustomCertificate(name, {
        certificate: result.certificate,
        certificateKey: result.certificateKey
      })
    },

    async submitCustom() {
      if (!this.form.niceName.trim()) {
        throw new Error('Please provide a name.')
      }
      if (!this.files.certificate || !this.files.certificateKey) {
        throw new Error('Both a certificate and a certificate key are required.')
      }

      const payload = {
        certificate: this.readFile(this.files.certificate),
        certificateKey: this.readFile(this.files.certificateKey)
      }
      if (this.files.intermediateCertificate) {
        payload.intermediateCertificate = this.readFile(this.files.intermediateCertificate)
      }

      await proxy.createCustomCertificate(this.form.niceName.trim(), payload)
    },

    async handleDelete(cert) {
      if (this.confirmingId !== cert.id) {
        this.confirmingId = cert.id
        return
      }

      try {
        await proxy.deleteCertificate(cert.id)
        await this.loadCertificates()
        this.$emit('saved')
      } catch (error) {
        this.errorMessage = error.message || 'Could not delete certificate.'
      } finally {
        this.confirmingId = null
      }
    },

    cancelAdd() {
      this.adding = false
      this.form = defaultForm()
      this.files = { certificate: null, certificateKey: null, intermediateCertificate: null }
      this.errorMessage = ''
    },

    reset() {
      this.cancelAdd()
      this.confirmingId = null
    }
  },

  watch: {
    async open(value) {
      if (value) {
        this.loadCertificates()
        this.mkcertAvailable = await mkcert.isAvailable()
      }
    }
  }
}
</script>
