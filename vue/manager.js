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
          return import('src/../../../FilesWebClient/vue/components/FilesAdminSettingsSystemWide')
        }
      }
    ]
  },

  getAdminUserTabs () {
    return [
      {
        tabName: 'files',
        paths: [
          'id/:id/files',
          'search/:search/id/:id/files',
          'page/:page/id/:id/files',
          'search/:search/page/:page/id/:id/files',
        ],
        title: 'FILESWEBCLIENT.HEADING_BROWSER_TAB',
        component () {
          return import('src/../../../FilesWebClient/vue/components/FilesAdminSettingsPerUser')
        }
      }
    ]
  },
  getAdminTenantTabs () {
    return [
      {
        tabName: 'files',
        paths: [
          'id/:id/files',
          'search/:search/id/:id/files',
          'page/:page/id/:id/files',
          'search/:search/page/:page/id/:id/files',
        ],
        title: 'FILESWEBCLIENT.HEADING_BROWSER_TAB',
        component () {
          return import('src/../../../FilesWebClient/vue/components/FilesAdminSettingsPerTenant')
        }
      }
    ]
  },
}
