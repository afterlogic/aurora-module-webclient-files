<template>
  <q-scroll-area class="full-height full-width">
    <div class="q-pa-md">
      <div class="row q-mb-md">
        <div class="col text-h5">
          <div class="q-my-sm">{{ $t('FILESWEBCLIENT.HEADING_SETTINGS_TAB_PERSONAL') }}</div>
        </div>
      </div>
      <q-card flat bordered class="card-edit-settings">
        <q-card-section>
          <div class="row q-mb-sm">
            <div class="col-2">
              <div class="q-my-sm">
                {{ $t('FILESWEBCLIENT.LABEL_TENANT_SPACE_LIMIT') }}
              </div>
            </div>
            <div class="q-ml-md col-3">
              <div class="row">
                <q-input outlined dense class="bg-white q-ml-sm col-8" v-model="tenantSpaceLimitMb"/>
                <div class="q-ma-sm col-1" style="margin-top: 10px" v-t="'COREWEBCLIENT.LABEL_MEGABYTES'"/>
              </div>
            </div>
          </div>
          <div class="row q-mb-sm">
            <div class="col-2"></div>
            <div class="q-ml-md col-8">
              <div class="q-mb-sm q-ml-sm text-caption">
                {{ $t('FILESWEBCLIENT.HINT_TENANT_SPACE_LIMIT') }}
              </div>
            </div>
          </div>
          <div class="row">
            <div class="col-2">
              <div class="q-my-sm">
                {{ $t('FILESWEBCLIENT.LABEL_USER_SPACE_LIMIT') }}
              </div>
            </div>
            <div class="q-ml-md col-3">
              <div class="row">
                <q-input outlined dense class=" col-8 bg-white q-ml-sm" v-model="userSpaceLimitMb"/>
                <div class="q-ma-sm col-1" style="margin-top: 10px" v-t="'COREWEBCLIENT.LABEL_MEGABYTES'"/>
              </div>
            </div>
          </div>
          <div class="row q-mb-sm">
            <div class="col-2"></div>
            <div class="q-ml-md col-8">
              <div class="q-my-sm q-ml-sm text-caption">
                {{ $t('FILESWEBCLIENT.HINT_USER_SPACE_LIMIT') }}
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>
      <div class="q-pt-md text-right">
        <q-btn unelevated no-caps dense class="q-px-sm" :ripple="false" color="primary"
               :label="savingPerFilesSetting ? $t('COREWEBCLIENT.ACTION_SAVE_IN_PROGRESS') : $t('COREWEBCLIENT.ACTION_SAVE')"
               @click="updateSettingsForEntity"/>
      </div>
    </div>
    <div class="q-pa-md">
      <div class="row q-mb-md">
        <div class="col text-h5">{{ $t('FILESWEBCLIENT.HEADING_SETTINGS_TAB_CORPORATE') }}</div>
      </div>
      <q-card flat bordered class="card-edit-settings">
        <q-card-section>
          <div class="row">
            <div class="col-2">
              <div class="q-my-sm">{{ $t('FILESWEBCLIENT.LABEL_CORPORATE_SPACE_LIMIT') }}</div>
            </div>
            <div class="q-ml-md col-3">
              <div class="row">
                <q-input outlined dense class="bg-white q-ml-sm col-4" v-model="corporateSpaceLimitMb"/>
                <div class="q-ma-sm col-1" style="margin-top: 10px" v-t="'COREWEBCLIENT.LABEL_MEGABYTES'"/>
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>
      <div class="q-pt-md text-right">
        <q-btn unelevated no-caps dense class="q-px-sm" :ripple="false" color="primary"
               :label="savingCorFilesSetting ? $t('COREWEBCLIENT.ACTION_SAVE_IN_PROGRESS') : $t('COREWEBCLIENT.ACTION_SAVE')"
               @click="updateSettingsCorporate"/>
      </div>
    </div>
    <UnsavedChangesDialog ref="unsavedChangesDialog"/>
  </q-scroll-area>
</template>

<script>
import UnsavedChangesDialog from 'src/components/UnsavedChangesDialog'
import webApi from 'src/utils/web-api'
import notification from 'src/utils/notification'
import settings from '../../../FilesWebclient/vue/settings'
import errors from 'src/utils/errors'

export default {
  name: 'FilesAdminSettingsPerTenant',
  components: {
    UnsavedChangesDialog
  },
  data () {
    return {
      tenantSpaceLimitMb: 0,
      corporateSpaceLimitMb: 0,
      userSpaceLimitMb: 0,
      savingPerFilesSetting: false,
      savingCorFilesSetting: false,
    }
  },
  methods: {
    updateSettingsCorporate() {
      if (!this.savingCorFilesSetting) {
        this.savingCorFilesSetting = true
        const parameters = {
          SpaceLimitMb: this.corporateSpaceLimitMb
        }
        webApi.sendRequest({
          moduleName: 'CorporateFiles',
          methodName: 'UpdateSettings',
          parameters
        }).then(result => {
          this.savingCorFilesSetting = false
          if (result) {
            settings.saveCorporateFilesSettings({ spaceLimitMb: this.corporateSpaceLimitMb })
            notification.showReport(this.$t('COREWEBCLIENT.REPORT_SETTINGS_UPDATE_SUCCESS'))
          } else {
            notification.showError(this.$t('COREWEBCLIENT.ERROR_SAVING_SETTINGS_FAILED'))
          }
        }, response => {
          this.savingPerFilesSetting = false
          notification.showError(errors.getTextFromResponse(response, this.$t('MAILDOMAINS.ERROR_PASSWORD_EMPTY')))
        })
      }
    },
    updateSettingsForEntity() {
      if (!this.savingPerFilesSetting) {
        this.savingPerFilesSetting = true
        const parameters = {
          EntityType: '',
          EntityId: 0,
          UserSpaceLimitMb: this.userSpaceLimitMb,
          TenantSpaceLimitMb: this.tenantSpaceLimitMb
        }
        webApi.sendRequest({
          moduleName: 'Files',
          methodName: 'UpdateSettingsForEntity',
          parameters
        }).then(result => {
          this.savingPerFilesSetting = false
          if (result) {
            settings.savePersonalFilesSettings({
              userSpaceLimitMb: this.userSpaceLimitMb,
              tenantSpaceLimitMb: this.tenantSpaceLimitMb
            })
            notification.showReport(this.$t('COREWEBCLIENT.REPORT_SETTINGS_UPDATE_SUCCESS'))
          } else {
            notification.showError(this.$t('COREWEBCLIENT.ERROR_SAVING_SETTINGS_FAILED'))
          }
        }, response => {
          this.savingPerFilesSetting = false
          notification.showError(errors.getTextFromResponse(response, this.$t('COREWEBCLIENT.ERROR_SAVING_SETTINGS_FAILED')))
        })
      }
    },
  }
}
</script>

<style scoped>

</style>
