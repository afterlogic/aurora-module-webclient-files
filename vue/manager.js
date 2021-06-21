import settings from '../../FilesWebclient/vue/settings'
export default {
  moduleName: 'FilesWebclient',

  requiredModules: ['Files', 'CorporateFiles'],

  init (appdata) {
    settings.init(appdata)
  },

  getAdminSystemTabs () {
    return [
      {
        tabName: 'files',
        title: 'FILESWEBCLIENT.HEADING_BROWSER_TAB',
        component () {
          return import('src/../../../FilesWebClient/vue/components/FilesSettings')
        }
      }
    ]
  },
}
