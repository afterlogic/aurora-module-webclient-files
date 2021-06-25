<template>
  <q-scroll-area class="full-height full-width">
    <div class="q-pa-md">
      <div class="row q-mb-md">
        <div class="col text-h5">{{ $t('FILESWEBCLIENT.HEADING_BROWSER_TAB') }}</div>
      </div>
      <q-card flat bordered class="card-edit-settings">
        <q-card-section>
          <div class="row">
            <div class="col-2"></div>
            <div class="col2">
              <q-item>
                <q-item-section>
                  <q-checkbox v-model="enableUploadSizeLimit" color="teal">
                    <q-item-label caption>{{ $t('FILESWEBCLIENT.LABEL_ENABLE_UPLOAD_SIZE_LIMIT') }}</q-item-label>
                  </q-checkbox>
                </q-item-section>
              </q-item>
            </div>
          </div>
          <div class="row">
            <div class="col-2">
              <div class="q-my-sm">{{ $t('FILESWEBCLIENT.LABEL_UPLOAD_SIZE_LIMIT') }}</div>
            </div>
            <div class="q-ml-md col-3">
              <div class="row">
                <q-input outlined dense class="bg-white q-ml-sm col-4" v-model="uploadSizeLimitMb"/>
                <div class="q-ma-sm col-1" style="margin-top: 10px" v-t="'COREWEBCLIENT.LABEL_MEGABYTES'" />
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>
      <div class="q-pt-md text-right">
        <q-btn unelevated no-caps dense class="q-px-sm" :ripple="false" color="primary"
               :label="savingFilesSetting ? $t('COREWEBCLIENT.ACTION_SAVE_IN_PROGRESS') : $t('COREWEBCLIENT.ACTION_SAVE')" @click="updateSettings"/>
      </div>
    </div>

    <div class="q-pa-md">
      <div class="row q-mb-md">
        <div class="col text-h5"> <div class="q-my-sm">{{ $t('FILESWEBCLIENT.HEADING_SETTINGS_TAB_PERSONAL') }}</div></div>
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
              <div class="q-ma-sm col-1" style="margin-top: 10px" v-t="'COREWEBCLIENT.LABEL_MEGABYTES'" />
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
                <div class="q-ma-sm col-1" style="margin-top: 10px" v-t="'COREWEBCLIENT.LABEL_MEGABYTES'" />
              </div>
            </div>
          </div>
          <div class="row q-mb-sm">
            <div class="col-2"></div>
            <div class="q-ml-md col-8">
              <div class="q-my-sm q-ml-sm text-caption" >
                {{ $t('FILESWEBCLIENT.HINT_USER_SPACE_LIMIT') }}
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>
      <div class="q-pt-md text-right">
        <q-btn unelevated no-caps dense class="q-px-sm" :ripple="false" color="primary"
               :label="savingPerFilesSetting ? $t('COREWEBCLIENT.ACTION_SAVE_IN_PROGRESS') : $t('COREWEBCLIENT.ACTION_SAVE')" @click="updateSettingsForEntity"/>
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
               :label="savingCorFilesSetting ? $t('COREWEBCLIENT.ACTION_SAVE_IN_PROGRESS') : $t('COREWEBCLIENT.ACTION_SAVE')" @click="updateSettingsCorporate"/>
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
import _ from 'lodash'

export default {
  name: 'FilesAdminSettingsSystemWide',
  components: {
    UnsavedChangesDialog
  },
  data() {
    return {
      savingFilesSetting: false,
      savingPerFilesSetting: false,
      savingCorFilesSetting: false,
      enableUploadSizeLimit: false,
      uploadSizeLimitMb: 0,
      userSpaceLimitMb: 0,
      entityType: '',
      entityId: '',
      tenantSpaceLimitMb: 0,
      corporateSpaceLimitMb: 0,
    }
  },
  mounted() {
    this.populate()
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
      const data = settings.getFilesSettings()
      return this.enableUploadSizeLimit !== data.enableUploadSizeLimit ||
      this.uploadSizeLimitMb !== data.uploadSizeLimitMb ||
      this.userSpaceLimitMb !== data.userSpaceLimitMb ||
      this.tenantSpaceLimitMb !== data.tenantSpaceLimitMb ||
      this.corporateSpaceLimitMb !== data.corporateSpaceLimitMb
    },
    populate () {
      const data = settings.getFilesSettings()
      this.enableUploadSizeLimit = data.enableUploadSizeLimit
      this.uploadSizeLimitMb = data.uploadSizeLimitMb ? data.uploadSizeLimitMb : 0
      this.userSpaceLimitMb = data.userSpaceLimitMb ? data.userSpaceLimitMb : 0
      this.tenantSpaceLimitMb = data.tenantSpaceLimitMb ? data.tenantSpaceLimitMb : 0
      this.corporateSpaceLimitMb = data.corporateSpaceLimitMb ? data.corporateSpaceLimitMb : 0
    },
    updateSettings() {
      if (!this.savingFilesSetting) {
        this.savingFilesSetting = true
        const parameters = {
          EnableUploadSizeLimit: this.enableUploadSizeLimit,
          UploadSizeLimitMb: this.uploadSizeLimitMb,
          UserSpaceLimitMb: this.userSpaceLimitMb
        }
        webApi.sendRequest({
          moduleName: 'Files',
          methodName: 'UpdateSettings',
          parameters
        }).then(result => {
          this.savingFilesSetting = false
          if (result) {
            settings.saveFilesSettings({
              enableUploadSizeLimit: this.enableUploadSizeLimit,
              uploadSizeLimitMb: this.uploadSizeLimitMb,
              userSpaceLimitMb: this.userSpaceLimitMb
            })
            notification.showReport(this.$t('COREWEBCLIENT.REPORT_SETTINGS_UPDATE_SUCCESS'))
          } else {
            notification.showError(this.$t('COREWEBCLIENT.ERROR_SAVING_SETTINGS_FAILED'))
          }
        }, response => {
          this.savingFilesSetting = false
          notification.showError(errors.getTextFromResponse(response, this.$t('COREWEBCLIENT.ERROR_SAVING_SETTINGS_FAILED')))
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
    }
  }
}
</script>

<style scoped>

</style>
