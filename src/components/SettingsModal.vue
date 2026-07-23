<template>
  <Modal v-model="open" @closed="reset">
    <template v-slot:activator="{ on }">
      <slot :on="on">
        <button v-on="on" type="button" class="relative inline-flex items-center py-1 px-2 border border-transparent text-xs leading-5 font-medium rounded-md text-gray-600 hover:text-gray-900 focus:outline-none">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
        </button>
      </slot>
    </template>

    <template v-slot="modal">
      <h3 class="text-xl mb-4">Nginx Proxy Manager Settings</h3>

      <form @submit.prevent="handleSubmit(modal)">
        <div class="mb-4">
          <label class="block text-gray-700 text-sm mb-1" for="baseUrl">
            Base URL
          </label>
          <input v-model="form.baseUrl" class="transition duration-150 appearance-none border text-sm rounded w-full py-3 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="baseUrl" type="text" placeholder="http://localhost:81">
        </div>
        <div class="mb-4">
          <label class="block text-gray-700 text-sm mb-1" for="identity">
            Email
          </label>
          <input v-model="form.identity" class="transition duration-150 appearance-none border text-sm rounded w-full py-3 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="identity" type="email" autocomplete="username">
        </div>
        <div class="mb-4">
          <label class="block text-gray-700 text-sm mb-1" for="secret">
            Password
          </label>
          <input v-model="form.secret" class="transition duration-150 appearance-none border text-sm rounded w-full py-3 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="secret" type="password" autocomplete="current-password">
        </div>

        <p v-if="testMessage" :class="testOk ? 'text-green-700' : 'text-red-700'" class="text-sm mb-4">{{ testMessage }}</p>

        <div class="flex items-center justify-between">
          <button type="button" @click="handleTest" :disabled="testing" class="relative inline-flex items-center py-2 pl-2 pr-3 border border-gray-300 text-sm leading-5 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none disabled:opacity-50">
            {{ testing ? 'Testing...' : 'Test Connection' }}
          </button>
          <button type="submit" class="relative inline-flex items-center py-2 pl-2 pr-3 border border-transparent text-sm leading-5 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:shadow-outline-indigo focus:border-indigo-700 active:bg-indigo-700">
            Save
          </button>
        </div>
      </form>
    </template>
  </Modal>
</template>

<script>
import Modal from '@/components/Modal.vue'
import npm from '../services/npm.js'

export default {
  name: 'SettingsModal',
  components: { Modal },
  data() {
    return {
      open: false,
      form: {
        baseUrl: '',
        identity: '',
        secret: ''
      },
      testing: false,
      testOk: false,
      testMessage: ''
    }
  },

  methods: {
    load() {
      const config = npm.getConfig()
      this.form.baseUrl = config.baseUrl
      this.form.identity = config.identity
      this.form.secret = config.secret
    },

    async handleTest() {
      this.persist()
      this.testing = true
      this.testMessage = ''
      const result = await npm.testConnection()
      this.testing = false
      this.testOk = result.ok
      const version = result.version
        ? ` (v${result.version.major}.${result.version.minor}.${result.version.revision})`
        : ''
      this.testMessage = result.message + version
    },

    persist() {
      npm.saveConfig({
        baseUrl: this.form.baseUrl,
        identity: this.form.identity,
        secret: this.form.secret
      })
    },

    handleSubmit(modal) {
      this.persist()
      this.$emit('saved')
      modal.close()
    },

    reset() {
      this.testing = false
      this.testOk = false
      this.testMessage = ''
    }
  },

  watch: {
    open(value) {
      if (value) {
        this.load()
      }
    }
  }
}
</script>
