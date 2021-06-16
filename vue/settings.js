import _ from 'lodash'
import typesUtils from 'src/utils/types'

class FilesSettings {
  constructor(appData) {
    const filesData = typesUtils.pObject(appData.Files)
    const corporateFilesData = typesUtils.pObject(appData.CorporateFiles)
    if (!_.isEmpty(filesData)) {
      this.EnableUploadSizeLimit = typesUtils.pBool(filesData.EnableUploadSizeLimit, this.EnableUploadSizeLimit)
      this.UploadSizeLimitMb = typesUtils.pNonNegativeInt(filesData.UploadSizeLimitMb, this.UploadSizeLimitMb)
      this.UserSpaceLimitMb = typesUtils.pNonNegativeInt(filesData.UserSpaceLimitMb, this.UserSpaceLimitMb)
      this.TenantSpaceLimitMb = typesUtils.pNonNegativeInt(filesData.TenantSpaceLimitMb, this.TenantSpaceLimitMb)
    }
    if (!_.isEmpty(corporateFilesData)) {
      this.ShowCorporateFilesAdminSection = true
      this.CorporateSpaceLimitMb = typesUtils.pNonNegativeInt(corporateFilesData.SpaceLimitMb, this.CorporateSpaceLimitMb)
    }
  }

  saveFilesSettings({ EnableUploadSizeLimit, UploadSizeLimitMb, UserSpaceLimitMb }) {
    this.EnableUploadSizeLimit = EnableUploadSizeLimit
    this.UploadSizeLimitMb = UploadSizeLimitMb
    this.UserSpaceLimitMb = UserSpaceLimitMb
  }

  savePersonalFilesSettings({ TenantSpaceLimitMb, UserSpaceLimitMb }) {
    this.TenantSpaceLimitMb = TenantSpaceLimitMb
    this.UserSpaceLimitMb = UserSpaceLimitMb
  }

  saveCorporateFilesSettings({ SpaceLimitMb }) {
    this.CorporateSpaceLimitMb = SpaceLimitMb
  }
}

let settings = null

export default {
  init (appData) {
    settings = new FilesSettings(appData)
  },

  getFilesSettings () {
    return {
      EnableUploadSizeLimit: settings?.EnableUploadSizeLimit || false,
      UploadSizeLimitMb: settings?.UploadSizeLimitMb || false,
      TenantSpaceLimitMb: settings?.TenantSpaceLimitMb || false,
      UserSpaceLimitMb: settings?.UserSpaceLimitMb || false,
      CorporateSpaceLimitMb: settings?.CorporateSpaceLimitMb || false,
    }
  },

  saveFilesSettings(data) {
    settings.saveFilesSettings(data)
  },

  savePersonalFilesSettings(data) {
    settings.savePersonalFilesSettings(data)
  },

  saveCorporateFilesSettings(data) {
    settings.saveCorporateFilesSettings(data)
  },
}
