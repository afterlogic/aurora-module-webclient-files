import _ from 'lodash'
import typesUtils from 'src/utils/types'

class FilesSettings {
  constructor (appData) {
    const filesData = typesUtils.pObject(appData.Files)
    const corporateFilesData = typesUtils.pObject(appData.CorporateFiles)
    this.enableUploadSizeLimit = typesUtils.pBool(filesData.EnableUploadSizeLimit)
    this.uploadSizeLimitMb = typesUtils.pNonNegativeInt(filesData.UploadSizeLimitMb)
    this.userSpaceLimitMb = typesUtils.pNonNegativeInt(filesData.UserSpaceLimitMb)
    this.tenantSpaceLimitMb = typesUtils.pNonNegativeInt(filesData.TenantSpaceLimitMb)
    this.showCorporateFilesAdminSection = true
    this.corporateSpaceLimitMb = typesUtils.pNonNegativeInt(corporateFilesData.SpaceLimitMb)
  }

  saveFilesSettings({ enableUploadSizeLimit, uploadSizeLimitMb, userSpaceLimitMb }) {
    this.enableUploadSizeLimit = enableUploadSizeLimit
    this.uploadSizeLimitMb = uploadSizeLimitMb
    this.userSpaceLimitMb = userSpaceLimitMb
  }

  savePersonalFilesSettings({ tenantSpaceLimitMb, userSpaceLimitMb }) {
    this.tenantSpaceLimitMb = tenantSpaceLimitMb
    this.userSpaceLimitMb = userSpaceLimitMb
  }

  saveCorporateFilesSettings({ spaceLimitMb }) {
    this.corporateSpaceLimitMb = spaceLimitMb
  }
}

let settings = null

export default {
  init (appData) {
    settings = new FilesSettings(appData)
  },

  getFilesSettings () {
    return {
      enableUploadSizeLimit: settings.enableUploadSizeLimit,
      uploadSizeLimitMb: settings.uploadSizeLimitMb,
      tenantSpaceLimitMb: settings.tenantSpaceLimitMb,
      userSpaceLimitMb: settings.userSpaceLimitMb,
      corporateSpaceLimitMb: settings.corporateSpaceLimitMb,
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
