<template>
  <div class="flex flex-col h-screen bg-gray-100">
    <div class="bg-white border-b border-gray-200 app-region-drag">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex h-16 items-center">
          <!-- Logo -->
          <div class="flex-shrink-0 flex items-center mr-8">
            <span class="text-3xl">🦉</span>
            <pre class="text-sm text-gray-600 ml-2">/etc/owls</pre>
          </div>

          <!-- Omnisearch -->
          <div class="flex-1 mr-8">
            <div class="w-full flex md:ml-0">
              <label for="search_field" class="sr-only">Search</label>
              <div class="relative w-full text-gray-400 focus-within:text-gray-600">
                <div class="absolute inset-y-0 left-0 flex items-center pointer-events-none">
                  <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" clip-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" />
                  </svg>
                </div>
                <input id="search_field" v-model="search" class="app-region-nodrag block w-full h-full pl-8 pr-3 py-2 rounded-md text-gray-900 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 sm:text-sm" placeholder="Search" />
              </div>
            </div>
          </div>

          <div class="flex space-x-4 items-center">
            <!-- Proxy menu: groups all proxy controls in one clearly labelled place -->
            <div class="relative app-region-nodrag">
              <button @click="proxyMenuOpen = !proxyMenuOpen" type="button" title="Proxy" class="inline-flex items-center py-1 pl-2 pr-1.5 border border-gray-200 text-xs leading-5 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none">
                <span class="w-2 h-2 rounded-full mr-2" :class="proxyStatusColor"></span>
                Proxy
                <svg class="w-4 h-4 ml-1 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
              </button>

              <!-- Click-away backdrop (sits under the menu but over the page) -->
              <div v-if="proxyMenuOpen" @click="proxyMenuOpen = false" class="fixed inset-0 z-40"></div>

              <!-- Menu -->
              <div v-if="proxyMenuOpen" style="width: 15rem" class="absolute right-0 mt-2 rounded-md shadow-lg bg-white border border-gray-200 z-50 py-1">
                <div class="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                  <span class="text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Local nginx proxy</span>
                  <span class="inline-flex items-center text-xs text-gray-500 whitespace-nowrap ml-2">
                    <span class="w-2 h-2 rounded-full mr-1" :class="proxyStatusColor"></span>
                    {{ proxyStatusLabel }}
                  </span>
                </div>

                <button v-if="dockerState === 'ok' || dockerState === 'container-stopped'" @click="proxyMenuOpen = false; restartProxyContainer()" :disabled="restartingContainer" type="button" class="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none disabled:opacity-50">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-4 h-4 mr-2 text-gray-400" :class="{ 'animate-spin': restartingContainer }"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                  {{ restartingContainer ? 'Restarting...' : 'Restart proxy' }}
                </button>

                <CertificatesModal @saved="loadProxyHosts">
                  <template v-slot="{ on }">
                    <button v-on="on" type="button" class="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-4 h-4 mr-2 text-gray-400"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                      Certificates
                    </button>
                  </template>
                </CertificatesModal>
              </div>
            </div>

            <AddProjectModal @saved="addProject" class="app-region-nodrag">
              <template v-slot="{ on }">
                <button v-on="on" type="button" class="relative inline-flex items-center py-1 px-2 border border-transparent text-xs leading-5 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:shadow-outline-indigo focus:border-indigo-700 active:bg-indigo-700">
                  Create Project
                  <svg fill="currentColor" viewBox="0 0 20 20" class="w-4 h-4 ml-1"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"></path></svg>
                </button>
              </template>
            </AddProjectModal>
            <WindowControls @minimized="minimizeWindow" @closed="closeWindow" class="app-region-nodrag"/>
          </div>
        </div>
      </div>
    </div>
    <!-- Docker status banner -->
    <div v-if="dockerState !== 'ok' && dockerState !== 'unknown' && !dockerBannerDismissed" class="border-b border-yellow-200 bg-yellow-50 px-4 sm:px-6 lg:px-8 py-3">
      <div class="max-w-7xl mx-auto flex items-center justify-between">
        <div class="flex items-center text-sm text-yellow-800">
          <svg fill="currentColor" viewBox="0 0 20 20" class="w-5 h-5 mr-2 flex-shrink-0"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
          <span v-if="dockerState === 'container-stopped'">The proxy isn't running.</span>
          <span v-else-if="dockerState === 'no-daemon'">The Docker daemon isn't running. Start Docker/Colima and retry.</span>
          <span v-else-if="dockerState === 'not-installed'">Docker isn't installed. Install Docker or Colima to manage the proxy.</span>
        </div>
        <div class="flex-shrink-0 ml-4 flex items-center space-x-4">
          <button v-if="dockerState === 'container-stopped'" @click="startProxyContainer" :disabled="startingContainer" type="button" class="inline-flex items-center py-1 px-3 border border-transparent text-sm leading-5 font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-500 focus:outline-none disabled:opacity-50">
            {{ startingContainer ? 'Starting...' : 'Start proxy' }}
          </button>
          <button v-else-if="dockerState === 'no-daemon'" @click="refreshDockerStatus" type="button" class="inline-flex items-center py-1 px-3 border border-yellow-400 text-sm leading-5 font-medium rounded-md text-yellow-800 bg-white hover:bg-yellow-100 focus:outline-none">
            Retry
          </button>
          <button @click="dismissDockerBanner" type="button" title="Don't show this again" class="text-sm text-yellow-700 hover:text-yellow-900 underline focus:outline-none">
            Dismiss
          </button>
        </div>
      </div>
    </div>

    <div class="flex items-start h-full min-h-0 overflow-scroll">
      <div v-if="projects.length !== 0" class="max-w-7xl w-full pt-6 sm:px-6 lg:px-8">
        <!-- Domain -->
        <div class="bg-white overflow-hidden shadow rounded-lg mb-6" v-for="project in filteredProjects" :key="project.hostname">
          <div class="border-b border-gray-200 px-4 py-5 sm:px-6">
            <div class="-ml-4 -mt-2 flex items-center justify-between flex-wrap sm:flex-no-wrap">
              <div class="ml-4 mt-2 flex items-center">
                <h3 class="text-lg leading-6 font-medium text-gray-900">
                  {{ project.hostname }}
                </h3>
                <svg v-if="projectActive(project)" @click="deactivateProject(project)" fill="currentColor" viewBox="0 0 477.871 477.871" class="w-6 h-6 ml-4 text-indigo-600 cursor-pointer"><path d="M474.609 228.901a453.124 453.124 0 00-103.219-98.287l67.345-67.345c6.78-6.548 6.968-17.352.42-24.132-6.548-6.78-17.352-6.968-24.132-.42-.142.137-.282.277-.42.42l-73.574 73.506a220.702 220.702 0 00-102.093-27.307C109.229 85.336 7.529 223.03 3.262 228.9a17.068 17.068 0 000 20.07 453.124 453.124 0 00103.219 98.287l-67.345 67.345c-6.78 6.548-6.968 17.352-.42 24.132 6.548 6.78 17.352 6.968 24.132.42.142-.137.282-.277.42-.42l73.574-73.506a220.702 220.702 0 00102.093 27.307c129.707 0 231.407-137.694 235.674-143.565a17.063 17.063 0 000-20.069zm-343.313 93.593a424.95 424.95 0 01-92.484-83.558c25.122-30.43 106.598-119.467 200.124-119.467a180.655 180.655 0 0176.612 18.773L285.92 167.87c-39.2-26.025-92.076-15.345-118.101 23.855-18.958 28.555-18.958 65.691 0 94.246l-36.523 36.523zm153.72-105.489a50.36 50.36 0 015.12 21.931c0 28.277-22.923 51.2-51.2 51.2a50.36 50.36 0 01-21.931-5.12l68.011-68.011zm-92.16 43.861a50.36 50.36 0 01-5.12-21.931c0-28.277 22.923-51.2 51.2-51.2a50.36 50.36 0 0121.931 5.12l-68.011 68.011zm46.08 97.536a180.659 180.659 0 01-76.612-18.773l29.628-29.628c39.2 26.025 92.076 15.345 118.101-23.855 18.958-28.555 18.958-65.691 0-94.246l36.523-36.523a424.975 424.975 0 0192.484 83.558c-25.123 30.431-106.599 119.467-200.124 119.467z"/></svg>
              </div>
              <div class="ml-4 mt-2 flex-shrink-0">
                <span class="inline-flex rounded-md shadow-sm">
                  <AddEnvironmentModal @saved="addEnvironment(project, $event)" />
                  <button @click="removeProject(project)" type="button" class="ml-3 relative inline-flex items-center border border-transparent text-sm leading-5 font-medium text-red-600 focus:outline-none">
                    <svg fill="currentColor" viewBox="0 0 20 20" class="w-5 h-5"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
                  </button>
                </span>
              </div>
            </div>
          </div>
          <div class="px-4 py-5 sm:p-6 flex">
            <!-- Environments -->
            <div v-for="environment in project.environments" :key="`${environment.name}-${environment.ip}`" class="mr-3" @click="activateEnvironment(project, environment)">
              <!-- Active -->
              <div v-if="environment.active" class="group relative p-5 rounded-lg cursor-pointer border-2 border-transparent border-indigo-600">
                <h3 class="uppercase font-semibold text-sm text-indigo-600">{{ environment.name }}</h3>
                <div class="text-2xl text-indigo-600">{{ environment.ip }}</div>
                <svg @click.stop="removeEnvironment(project, environment)" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" class="w-6 h-6 absolute top-0 right-0 bg-white text-gray-500 hover:text-red-500 -mr-2 -mt-2"><path d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
              <!-- Inactive -->
              <div v-else class="group relative p-5 rounded-lg cursor-pointer border-2 border-transparent hover:border-gray-400">
                <h3 class="uppercase font-semibold text-sm text-gray-400 group-hover:text-gray-500">{{ environment.name }}</h3>
                <div class="text-2xl text-gray-400 group-hover:text-gray-500">{{ environment.ip }}</div>
                <svg @click.stop="removeEnvironment(project, environment)" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" class="w-6 h-6 absolute top-0 right-0 bg-white text-gray-500 hover:text-red-500 -mr-2 -mt-2 hidden group-hover:inline"><path d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
            </div>
          </div>

          <!-- Proxy status -->
          <div class="border-t border-gray-200 px-4 py-3 sm:px-6 bg-gray-50">
            <div class="flex items-center justify-between">
              <div class="flex items-center text-sm">
                <span class="font-medium text-gray-500 mr-3">Proxy</span>
                <template v-if="proxyForProject(project)">
                  <span :class="proxyForProject(project).enabled ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mr-3">
                    {{ proxyForProject(project).enabled ? 'Online' : 'Disabled' }}
                  </span>
                  <span class="text-gray-700">
                    &rarr; {{ proxyForProject(project).forward_scheme }}://{{ proxyForProject(project).forward_host }}:{{ proxyForProject(project).forward_port }}
                  </span>
                  <span v-if="proxyForProject(project).certificate_id" class="ml-3 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">SSL</span>
                </template>
                <span v-else class="text-gray-400">No proxy configured</span>
              </div>

              <div class="flex items-center space-x-3 text-sm">
                <template v-if="proxyForProject(project)">
                  <button @click="toggleProxy(proxyForProject(project))" type="button" class="text-gray-600 hover:text-gray-900 focus:outline-none">
                    {{ proxyForProject(project).enabled ? 'Disable' : 'Enable' }}
                  </button>
                  <button @click.stop="openProxyModal(project, proxyForProject(project))" type="button" class="text-indigo-600 hover:text-indigo-800 focus:outline-none">
                    Edit
                  </button>
                  <button @click.stop="proxyToDelete = proxyForProject(project)" type="button" class="text-red-600 hover:text-red-800 focus:outline-none">
                    Remove
                  </button>
                </template>
                <button v-else @click.stop="openProxyModal(project, null)" type="button" class="inline-flex items-center text-indigo-600 hover:text-indigo-800 focus:outline-none">
                  <svg fill="currentColor" viewBox="0 0 20 20" class="w-4 h-4 mr-1"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"></path></svg>
                  Add Proxy
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- Empty State -->
      <div v-else class="flex flex-col items-center justify-center h-full bg-white">
        <h3 class="text-3xl mb-3 font-semibold">Draw the owl.</h3>  
        <p>It's time to create an ow- err... project. Make a new project. Yep.</p>      
        <img class="mx-auto block w-1/3 mt-3 mb-5" src="empty-state-large.jpg" />
        <AddProjectModal @saved="addProject">
          <template v-slot="{ on }">
            <button v-on="on" type="button" class="relative inline-flex items-center py-2 pl-2 pr-3 border border-transparent text-sm leading-5 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:shadow-outline-indigo focus:border-indigo-700 active:bg-indigo-700">
              <svg fill="currentColor" viewBox="0 0 20 20" class="w-4 h-4 mr-2"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"></path></svg>
              Create Project
            </button>
          </template>
        </AddProjectModal>
      </div>
    </div>

    <Modal v-model="showPermissionsError" v-slot="{ close }" @closed="checkAccess">
      <div class="sm:flex sm:items-start">
        <div class="mx-auto text-2xl flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-200 sm:mx-0 sm:h-10 sm:w-10">🦉</div>
        <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
          <h3 class="text-lg leading-6 font-medium text-grey-900">
            Whooooops!
          </h3>
          <div class="mt-2 overflow-hidden">
            <p class="text-sm leading-5 text-grey-500">
              It looks like you don't have permissions to edit your hosts file. Here's how you take care of that on {{ os.platform }}:
            </p>
            <div class="hide-scrollbars my-4 text-sm bg-gray-200 py-3 px-4 inline-block rounded-lg font-mono whitespace-no-wrap overflow-x-scroll box-content max-w-lg">{{ os.permissionsTip }}</div>
          </div>
        </div>
      </div>
      <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
        <span class="mt-3 flex w-full rounded-md shadow-sm sm:mt-0 sm:w-auto">
          <button @click="close()" type="button" class="inline-flex justify-center w-full rounded-md border border-grey-300 px-4 py-2 bg-white text-base leading-6 font-medium text-grey-700 shadow-sm hover:text-grey-500 focus:outline-none focus:border-blue-300 focus:shadow-outline transition ease-in-out duration-150 sm:text-sm sm:leading-5">
            Retry
          </button>
        </span>
      </div>
    </Modal>

    <!-- Proxy add/edit modal (shared instance) -->
    <ProxyHostModal
      v-model="showProxyModal"
      :hostname="proxyModalProject ? proxyModalProject.hostname : ''"
      :existing="proxyModalExisting"
      @saved="loadProxyHosts"
    />

    <!-- Delete proxy confirmation -->
    <Modal :value="!!proxyToDelete" @input="val => { if (!val) proxyToDelete = null }" @closed="proxyToDelete = null">
      <div class="sm:flex sm:items-start">
        <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-6 h-6 text-red-600"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
        </div>
        <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
          <h3 class="text-lg leading-6 font-medium text-gray-900">Delete proxy host</h3>
          <div class="mt-2">
            <p class="text-sm text-gray-500">
              Delete the proxy for
              <span class="font-medium text-gray-700">{{ proxyToDelete ? proxyToDelete.domain_names.join(', ') : '' }}</span>?
              This cannot be undone.
            </p>
          </div>
        </div>
      </div>
      <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
        <button @click="confirmRemoveProxy" type="button" class="inline-flex justify-center w-full rounded-md border border-transparent px-4 py-2 bg-red-600 text-base leading-6 font-medium text-white shadow-sm hover:bg-red-500 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm sm:leading-5">
          Delete
        </button>
        <button @click="proxyToDelete = null" type="button" class="mt-3 sm:mt-0 inline-flex justify-center w-full rounded-md border border-gray-300 px-4 py-2 bg-white text-base leading-6 font-medium text-gray-700 shadow-sm hover:text-gray-500 focus:outline-none sm:w-auto sm:text-sm sm:leading-5">
          Cancel
        </button>
      </div>
    </Modal>

    <!-- Proxy error toast -->
    <div v-if="proxyError" class="fixed bottom-4 right-4 z-50 max-w-sm bg-red-600 text-white text-sm rounded-lg shadow-lg px-4 py-3 flex items-start">
      <span class="flex-1">{{ proxyError }}</span>
      <button @click="proxyError = ''" class="ml-3 text-red-200 hover:text-white focus:outline-none">&times;</button>
    </div>
  </div>
</template>

<script>
import WindowControls from '@/components/WindowControls.vue'
import { ipcRenderer } from 'electron'

import Fuse from 'fuse.js'
import system from '../services/system.js'
import proxy from '../services/proxy.js'
import docker from '../services/docker.js'

import Modal from '@/components/Modal.vue'
import AddEnvironmentModal from '@/components/AddEnvironmentModal.vue'
import AddProjectModal from '@/components/AddProjectModal.vue'
import CertificatesModal from '@/components/CertificatesModal.vue'
import ProxyHostModal from '@/components/ProxyHostModal.vue'

export default {
  name: 'Home',
  
  components: { Modal, AddEnvironmentModal, AddProjectModal, CertificatesModal, ProxyHostModal, WindowControls },

  mounted() {
    if (this.checkAccess()) {
      this.fetchProjects()
    }
    this.loadProxyHosts()
    this.refreshDockerStatus()
  },

  data() {
    return {
      os: {
        platform: system.getPlatformHuman(),
        username: system.getCurrentUser(),
        permissionsTip: system.getPermissionTip()
      },
      showPermissionsError: false,
      showAddProjectModal: false,
      search: '',
      projects: [],
      proxyHosts: [],
      proxyError: '',
      showProxyModal: false,
      proxyModalProject: null,
      proxyModalExisting: null,
      proxyToDelete: null,
      dockerState: 'unknown',
      startingContainer: false,
      restartingContainer: false,
      proxyMenuOpen: false,
      dockerBannerDismissed: localStorage.getItem('dockerBannerDismissed') === 'true'
    }
  },

  computed: {
    proxyStatusColor() {
      switch (this.dockerState) {
        case 'ok': return 'bg-green-500'
        case 'container-stopped': return 'bg-yellow-500'
        case 'no-daemon':
        case 'not-installed': return 'bg-red-500'
        default: return 'bg-gray-400'
      }
    },

    proxyStatusLabel() {
      switch (this.dockerState) {
        case 'ok': return 'Online'
        case 'container-stopped': return 'Stopped'
        case 'no-daemon': return 'Docker not running'
        case 'not-installed': return 'Docker not installed'
        default: return 'Checking...'
      }
    },

    filteredProjects() {
      if (!this.search) {
        return this.projects
      }

      this.fuse = new Fuse(this.projects, {
        keys: ['hostname', 'environments.name']
      });

      return this.fuse.search(this.search).map(hit => hit.item)
    }
  },

  watch: {
    projects: {
      handler: function (val) {
        this.flush(val)
      },
      deep: true
    }
  },

  methods: {
    minimizeWindow() {
      ipcRenderer.send('window-minimize')
    },

    closeWindow() {
      ipcRenderer.send('window-close')
    },

    checkAccess() {
      if (system.checkPermissions()) {
        this.showPermissionsError = false
        this.fetchProjects()
      } else {
        this.showPermissionsError = true
      }
    },

    fetchProjects() {
      if (localStorage.getItem('projects') === null) {
        this.projects = system.getHostsEntries()
      } else {
        this.projects = JSON.parse(localStorage.getItem('projects'))
      }
    },

    projectActive(project) {
      return project.environments.filter(env => env.active).length > 0
    },

    addProject(project) {
      this.projects.push({
        hostname: project.hostname,
        environments: [
          {
            name: 'Local',
            ip: '127.0.0.1',
            active: false
          }
        ]
      })
    },

    removeProject(project) {
      this.projects.splice(this.projects.indexOf(project), 1)
    },

    deactivateProject(project) {
      project.environments.forEach(env => env.active = false)
    },

    addEnvironment(project, environment) {
      project.environments.push({
        ...environment,
        active: false
      })
    },

    activateEnvironment(project, environment) {
      project.environments.forEach(env => {
        env.active = env == environment
      })
    },

    removeEnvironment(project, environment) {
      project.environments.splice(project.environments.indexOf(environment), 1)
    },

    flush(projects) {
      this.$nextTick(() => localStorage.setItem('projects', JSON.stringify(projects)))
      system.saveHostEntries(projects)
    },

    async loadProxyHosts() {
      try {
        this.proxyHosts = await proxy.getProxyHosts()
      } catch (error) {
        this.proxyHosts = []
        this.proxyError = `Could not load proxy hosts: ${error.message}`
      }
    },

    proxyForProject(project) {
      return this.proxyHosts.find(host =>
        Array.isArray(host.domain_names) && host.domain_names.includes(project.hostname)
      )
    },

    openProxyModal(project, existing) {
      this.proxyModalProject = project
      this.proxyModalExisting = existing
      this.showProxyModal = true
    },

    async toggleProxy(host) {
      try {
        if (host.enabled) {
          await proxy.disableProxyHost(host.id)
        } else {
          await proxy.enableProxyHost(host.id)
        }
        await this.loadProxyHosts()
      } catch (error) {
        this.proxyError = `Could not update proxy: ${error.message}`
      }
    },

    async confirmRemoveProxy() {
      const host = this.proxyToDelete
      if (!host) {
        return
      }

      try {
        await proxy.deleteProxyHost(host.id)
        await this.loadProxyHosts()
      } catch (error) {
        this.proxyError = `Could not remove proxy: ${error.message}`
      } finally {
        this.proxyToDelete = null
      }
    },

    dismissDockerBanner() {
      this.dockerBannerDismissed = true
      localStorage.setItem('dockerBannerDismissed', 'true')
    },

    async refreshDockerStatus() {
      const { installed, running } = await docker.isDockerAvailable()

      if (!installed) {
        this.dockerState = 'not-installed'
        return
      }

      if (!running) {
        this.dockerState = 'no-daemon'
        return
      }

      this.dockerState = (await docker.isProxyRunning()) ? 'ok' : 'container-stopped'
    },

    async startProxyContainer() {
      this.startingContainer = true

      try {
        const result = await docker.startProxy()
        if (!result.ok) {
          this.proxyError = result.stderr
            ? `${result.message} ${result.stderr}`
            : result.message
          await this.refreshDockerStatus()
          return
        }

        await this.refreshDockerStatus()

        // nginx loads the generated configs on boot, so the hosts are ready as
        // soon as the container is up.
        await this.loadProxyHosts()
      } catch (error) {
        this.proxyError = `Could not start the proxy: ${error.message}`
      } finally {
        this.startingContainer = false
      }
    },

    async restartProxyContainer() {
      this.restartingContainer = true

      try {
        const result = await docker.restartProxy()
        if (!result.ok) {
          this.proxyError = result.stderr
            ? `${result.message} ${result.stderr}`
            : result.message
          await this.refreshDockerStatus()
          return
        }

        await this.refreshDockerStatus()

        await this.loadProxyHosts()
      } catch (error) {
        this.proxyError = `Could not restart the proxy: ${error.message}`
      } finally {
        this.restartingContainer = false
      }
    }
  }
}
</script>

<style scoped>
::-webkit-scrollbar {
    width: 0px;
    height: 0px;
    background: transparent;
}
</style>