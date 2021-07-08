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
                <q-input outlined dense class="bg-white  col-5 input" v-model="tenantSpaceLimitMb"/>
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
                <q-input outlined dense class=" col-5 bg-white input" v-model="userSpaceLimitMb"/>
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
               :label="saving ? $t('COREWEBCLIENT.ACTION_SAVE_IN_PROGRESS') : $t('COREWEBCLIENT.ACTION_SAVE')"
               @click="updateSettingsForEntity"/>
      </div>
    </div>
    <q-inner-loading style="justify-content: flex-start;" :showing="loading || saving">
      <q-linear-progress query class="q-mt-sm" />
    </q-inner-loading>
    <UnsavedChangesDialog ref="unsavedChangesDialog"/>
  </q-scroll-area>
</template>

<script>
import UnsavedChangesDialog from 'src/components/UnsavedChangesDialog'
import webApi from 'src/utils/web-api'
import notification from 'src/utils/notification'
import errors from 'src/utils/errors'
import cache from 'src/cache'
import types from '../../../AdminPanelWebclient/vue/src/utils/types'
import _ from 'lodash'

export default {
  name: 'FilesAdminSettingsPerTenant',
  components: {
    UnsavedChangesDialog
  },
  computed: {
    tenantId () {
      return Number(this.$route?.params?.id)
    }
  },
  mounted () {
    this.saving = false
    this.populate()
  },
  data () {
    return {
      saving: false,
      loading: false,
      tenantSpaceLimitMb: 0,
      userSpaceLimitMb: 0,
      allocatedSpace: 0,
      tenant: null
    }
  },
  beforeRouteLeave (to, from, next) {
    if (this.hasChanges() && _.isFunction(this?.$refs?.unsavedChangesDialog?.openConfirmDiscardChangesDialog)) {
      this.$refs.unsavedChangesDialog.openConfirmDiscardChangesDialog(next)
    } else {
      next()
    }
  },
  methods: {
    hasChanges () {
      const tenantSpaceLimitMb = _.isFunction(this.tenant?.getData) ? this.tenant?.getData('FilesWebclient::TenantSpaceLimitMb') : ''
      const userSpaceLimitMb = _.isFunction(this.tenant?.getData) ? this.tenant?.getData('FilesWebclient::UserSpaceLimitMb') : ''
      return this.tenantSpaceLimitMb !== tenantSpaceLimitMb ||
          this.userSpaceLimitMb !== userSpaceLimitMb
    },
    populate() {
      this.loading = true
      cache.getTenant(this.tenantId).then(({ tenant }) => {
        if (tenant.completeData['FilesWebclient::TenantSpaceLimitMb'] !== undefined) {
          this.loading = false
          this.tenant = tenant
          this.tenantSpaceLimitMb = tenant.completeData['FilesWebclient::TenantSpaceLimitMb']
          this.userSpaceLimitMb = tenant.completeData['FilesWebclient::UserSpaceLimitMb']
          this.allocatedSpace = tenant.completeData['FilesWebclient::AllocatedSpace']
        } else {
          this.getSettingsForEntity()
        }
      })
    },
    getSettingsForEntity () {
      const parameters = {
        EntityType: 'Tenant',
        EntityId: this.tenantId,
      }
      webApi.sendRequest({
        moduleName: 'Files',
        methodName: 'GetSettingsForEntity',
        parameters
      }).then(result => {
        if (result) {
          cache.getTenant(parameters.EntityId, true).then(({ tenant }) => {
            tenant.setCompleteData({
              'FilesWebclient::UserSpaceLimitMb': result.UserSpaceLimitMb,
              'FilesWebclient::TenantSpaceLimitMb': result.TenantSpaceLimitMb,
              'FilesWebclient::AllocatedSpace': result.AllocatedSpace
            })
            this.populate()
          })
        }
      }, response => {
        notification.showError(errors.getTextFromResponse(response))
      })
    },
    updateSettingsForEntity() {
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
          cache.getTenant(parameters.TenantId, true).then(({ tenant }) => {
            tenant.setCompleteData({
              'FilesWebclient::UserSpaceLimitMb': parameters.UserSpaceLimitMb,
              'FilesWebclient::TenantSpaceLimitMb': parameters.TenantSpaceLimitMb,
              'FilesWebclient::AllocatedSpace': this.allocatedSpace,
            })
            this.populate()
          })
          this.saving = false
          if (result) {
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
  }
}
</script>

<style scoped>
.input {
  border-radius: 6px;
}

</style>
