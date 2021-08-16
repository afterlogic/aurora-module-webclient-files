<template>
  <q-scroll-area class="full-height full-width">
    <div class="q-pa-lg">
      <div class="row q-mb-md">
        <div class="col text-h5" v-t="'FILESWEBCLIENT.HEADING_SETTINGS_TAB_PERSONAL'"/>
      </div>
      <q-card flat bordered class="card-edit-settings">
        <q-card-section>
          <div class="row q-mb-sm">
            <div class="col-2">
              <div class="q-my-sm">
                {{ $t('FILESWEBCLIENT.LABEL_TENANT_SPACE_LIMIT') }}
              </div>
            </div>
            <div class="col-4">
              <div class="row">
                <q-input outlined dense class="col-5" bg-color="white" v-model="tenantSpaceLimitMb"/>
                <div class="q-ma-sm col-1" style="margin-top: 10px" v-t="'COREWEBCLIENT.LABEL_MEGABYTES'"/>
              </div>
            </div>
          </div>
          <div class="row q-mb-sm">
            <div class="col-2"></div>
            <div class="col-8 q-mb-sm">
              <q-item-label caption>
                {{ $t('FILESWEBCLIENT.HINT_TENANT_SPACE_LIMIT') }}
              </q-item-label>
            </div>
          </div>
          <div class="row">
            <div class="col-2">
              <div class="q-my-sm">
                {{ $t('FILESWEBCLIENT.LABEL_USER_SPACE_LIMIT') }}
              </div>
            </div>
            <div class="col-4">
              <div class="row">
                <q-input outlined dense class="col-5" bg-color="white" v-model="userSpaceLimitMb"/>
                <div class="q-ma-sm col-1" style="margin-top: 10px" v-t="'COREWEBCLIENT.LABEL_MEGABYTES'"/>
              </div>
            </div>
          </div>
          <div class="row q-mb-sm">
            <div class="col-2"></div>
            <div class="col-8 q-my-sm">
              <q-item-label caption>
                {{ $t('FILESWEBCLIENT.HINT_USER_SPACE_LIMIT') }}
              </q-item-label>
            </div>
          </div>
          <div class="row">
            <div class="col-2">
              <div class="q-my-sm">
                {{ $t('FILESWEBCLIENT.LABEL_ALLOCATED_SPACE') }}
              </div>
            </div>
            <div class="col-4">
              <div class="row">
                <span class="q-mt-sm">{{ allocatedSpace }}</span>
                <div class="q-ma-sm q-pb-sm col-1" v-t="'COREWEBCLIENT.LABEL_MEGABYTES'"/>
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>
      <div class="q-pt-md text-right">
        <q-btn unelevated no-caps dense class="q-px-sm" :ripple="false" color="primary"
               :label="$t('COREWEBCLIENT.ACTION_SAVE')"
               @click="save"/>
      </div>
    </div>
    <q-inner-loading style="justify-content: flex-start;" :showing="loading || saving">
      <q-linear-progress query />
    </q-inner-loading>
  </q-scroll-area>
</template>

<script>
import errors from 'src/utils/errors'
import notification from 'src/utils/notification'
import types from 'src/utils/types'
import webApi from 'src/utils/web-api'

export default {
  name: 'FilesAdminSettingsPerTenant',

  data () {
    return {
      saving: false,
      loading: false,
      tenantSpaceLimitMb: '',
      userSpaceLimitMb: '',
      allocatedSpace: '',
      tenant: null
    }
  },

  computed: {
    tenantId () {
      return this.$store.getters['tenants/getCurrentTenantId']
    },

    allTenants () {
      return this.$store.getters['tenants/getTenants']
    },
  },

  watch: {
    allTenants () {
      this.populate()
    },
  },

  beforeRouteLeave (to, from, next) {
    this.doBeforeRouteLeave(to, from, next)
  },

  mounted () {
    this.loading = false
    this.saving = false
    this.populate()
  },

  methods: {
    /**
     * Method is used in doBeforeRouteLeave mixin
     */
    hasChanges () {
      const tenantCompleteData = types.pObject(this.tenant?.completeData)
      const tenantSpaceLimitMb = tenantCompleteData['FilesWebclient::TenantSpaceLimitMb']
      const userSpaceLimitMb = tenantCompleteData['FilesWebclient::UserSpaceLimitMb']
      return types.pInt(this.tenantSpaceLimitMb) !== tenantSpaceLimitMb ||
          types.pInt(this.userSpaceLimitMb) !== userSpaceLimitMb
    },

    /**
     * Method is used in doBeforeRouteLeave mixin,
     * do not use async methods - just simple and plain reverting of values
     * !! hasChanges method must return true after executing revertChanges method
     */
    revertChanges () {
      const tenantCompleteData = types.pObject(this.tenant?.completeData)
      this.tenantSpaceLimitMb = tenantCompleteData['FilesWebclient::TenantSpaceLimitMb']
      this.userSpaceLimitMb = tenantCompleteData['FilesWebclient::UserSpaceLimitMb']
    },

    populate() {
      const tenant = this.$store.getters['tenants/getTenant'](this.tenantId)
      if (tenant) {
        if (tenant.completeData['FilesWebclient::TenantSpaceLimitMb'] !== undefined) {
          this.tenant = tenant
          this.tenantSpaceLimitMb = tenant.completeData['FilesWebclient::TenantSpaceLimitMb']
          this.userSpaceLimitMb = tenant.completeData['FilesWebclient::UserSpaceLimitMb']
          this.allocatedSpace = tenant.completeData['FilesWebclient::AllocatedSpace']
        } else {
          this.getSettings()
        }
      }
    },

    save () {
      if (!this.saving) {
        this.saving = true
        const parameters = {
          EntityType: 'Tenant',
          EntityId: this.tenantId,
          TenantId: this.tenantId,
          UserSpaceLimitMb: types.pInt(this.userSpaceLimitMb),
          TenantSpaceLimitMb: types.pInt(this.tenantSpaceLimitMb),
        }
        webApi.sendRequest({
          moduleName: 'Files',
          methodName: 'UpdateSettingsForEntity',
          parameters
        }).then(result => {
          this.saving = false
          if (result) {
            const data = {
              'FilesWebclient::UserSpaceLimitMb': parameters.UserSpaceLimitMb,
              'FilesWebclient::TenantSpaceLimitMb': parameters.TenantSpaceLimitMb,
              'FilesWebclient::AllocatedSpace': this.allocatedSpace,
            }
            this.$store.commit('tenants/setTenantCompleteData', { id: this.tenantId, data })
            notification.showReport(this.$t('COREWEBCLIENT.REPORT_SETTINGS_UPDATE_SUCCESS'))
          } else {
            notification.showError(this.$t('COREWEBCLIENT.ERROR_SAVING_SETTINGS_FAILED'))
          }
        }, response => {
          this.saving = false
          notification.showError(errors.getTextFromResponse(response, this.$t('COREWEBCLIENT.ERROR_SAVING_SETTINGS_FAILED')))
        })
      }
    },

    getSettings () {
      this.loading = true
      const parameters = {
        EntityType: 'Tenant',
        EntityId: this.tenantId,
      }
      webApi.sendRequest({
        moduleName: 'Files',
        methodName: 'GetSettingsForEntity',
        parameters
      }).then(result => {
        this.loading = false
        if (result) {
          const data = {
            'FilesWebclient::UserSpaceLimitMb': types.pInt(result.UserSpaceLimitMb),
            'FilesWebclient::TenantSpaceLimitMb': types.pInt(result.TenantSpaceLimitMb),
            'FilesWebclient::AllocatedSpace': types.pInt(result.AllocatedSpace),
          }
          this.$store.commit('tenants/setTenantCompleteData', { id: this.tenantId, data })
        }
      }, response => {
        notification.showError(errors.getTextFromResponse(response))
      })
    },
  }
}
</script>

<style scoped>

</style>
