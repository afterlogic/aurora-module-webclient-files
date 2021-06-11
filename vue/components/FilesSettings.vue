<template>
  <q-scroll-area class="full-height full-width">
    <div class="q-pa-md">
      <div class="row q-mb-md">
        <div class="col text-h5">{{ $t('OPENPGPFILESWEBCLIENT.HEADING_BROWSER_TAB') }}</div>
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
            <div class="q-ml-md col-2">
              <div style="display: flex">
                <q-input outlined dense class="bg-white q-ml-sm" v-model="uploadSizeLimitMb"/>
                <div class="q-ma-sm" style="margin-top: 10px">MB</div>
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
            <div style="display: flex">
              <q-input outlined dense class="bg-white q-ml-sm" v-model="tenantSpaceLimitMb"/>
              <div class="q-ma-sm" style="margin-top: 10px">MB</div>
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
              <div style="display: flex">
                <q-input outlined dense class="bg-white q-ml-sm" v-model="userSpaceLimitMb"/>
                <div class="q-ma-sm" style="margin-top: 10px">MB</div>
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
            <div class="q-ml-md col-2">
              <div style="display: flex">
                <q-input outlined dense class="bg-white q-ml-sm" v-model="corporateSpaceLimitMb"/>
                <div class="q-ma-sm" style="margin-top: 10px">MB</div>
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
import webApi from "../../../AdminPanelWebclient/vue/src/utils/web-api";
import notification from "../../../AdminPanelWebclient/vue/src/utils/notification";
import settings from "../../../FilesWebclient/vue/settings";
import errors from "../../../AdminPanelWebclient/vue/src/utils/errors";
import _ from "lodash";

export default {
  name: "FilesSettings",
  components: {
    UnsavedChangesDialog
  },
  data() {
    return {
      savingFilesSetting: false,
      savingPerFilesSetting: false,
      savingCorFilesSetting: false,
      enableUploadSizeLimit: false,
      uploadSizeLimitMb:0,
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
      return this.enableUploadSizeLimit !== data.EnableUploadSizeLimit  ||
      this.uploadSizeLimitMb !== data.UploadSizeLimitMb ||
      this.userSpaceLimitMb !== data.UserSpaceLimitMb ||
      this.tenantSpaceLimitMb !== data.TenantSpaceLimitMb ||
      this.corporateSpaceLimitMb !== data.CorporateSpaceLimitMb
    },
    populate () {
      const data = settings.getFilesSettings()
      this.enableUploadSizeLimit = data.EnableUploadSizeLimit
      this.uploadSizeLimitMb = data.UploadSizeLimitMb ? data.UploadSizeLimitMb : 0
      this.userSpaceLimitMb = data.UserSpaceLimitMb  ? data.UserSpaceLimitMb : 0
      this.tenantSpaceLimitMb = data.TenantSpaceLimitMb  ? data.TenantSpaceLimitMb : 0
      this.corporateSpaceLimitMb = data.CorporateSpaceLimitMb  ? data.CorporateSpaceLimitMb : 0
    },
    updateSettings() {
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
          settings.saveFilesSettings(parameters)
          notification.showReport(this.$t('COREWEBCLIENT.REPORT_SETTINGS_UPDATE_SUCCESS'))
        } else {
          notification.showError(this.$t('COREWEBCLIENT.ERROR_SAVING_SETTINGS_FAILED'))
        }
      }, response => {
        this.savingFilesSetting = false
        notification.showError(errors.getTextFromResponse(response, this.$t('COREWEBCLIENT.ERROR_SAVING_SETTINGS_FAILED')))
      })
    },
    updateSettingsForEntity() {
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
            UserSpaceLimitMb: this.userSpaceLimitMb,
            TenantSpaceLimitMb: this.tenantSpaceLimitMb
          })
          notification.showReport(this.$t('COREWEBCLIENT.REPORT_SETTINGS_UPDATE_SUCCESS'))
        } else {
          notification.showError(this.$t('COREWEBCLIENT.ERROR_SAVING_SETTINGS_FAILED'))
        }
      }, response => {
        this.savingPerFilesSetting = false
        notification.showError(errors.getTextFromResponse(response, this.$t('COREWEBCLIENT.ERROR_SAVING_SETTINGS_FAILED')))
      })
    },
    updateSettingsCorporate() {
      this.savingCorFilesSetting = true
      const parameters = {
        SpaceLimitMb: this.corporateSpaceLimitMb
      }
      webApi.sendRequest({
        moduleName: 'CorporateFiles',
        methodName: 'UpdateSettings',
        parameters
      }).then(result => {
        if (result) {
          this.savingCorFilesSetting = false
          settings.saveCorporateFilesSettings(parameters)
          notification.showReport(this.$t('COREWEBCLIENT.REPORT_SETTINGS_UPDATE_SUCCESS'))
        } else {
          notification.showError(this.$t('COREWEBCLIENT.ERROR_SAVING_SETTINGS_FAILED'))
        }
      }, response => {
        this.savingPerFilesSetting = false
        notification.showError(errors.getTextFromResponse(response, this.$t('COREWEBCLIENT.ERROR_SAVING_SETTINGS_FAILED')))
      })
    }
  }
}
</script>

<style scoped>

</style>
