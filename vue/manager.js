import settings from '../../FilesWebclient/vue/settings'

export default {
  name: 'FilesSettings',
  init(appdata) {
    settings.init(appdata)
  },
  getAdminSystemTabs () {
    return [
      {
        name: 'files',
        title: 'FILESTABLEVIEWWEBCLIENTPLUGIN.HEADING_BROWSER_TAB',
        component () {
          return import('src/../../../FilesWebClient/vue/components/FilesSettings')
        },
      },
    ]
  },
}
