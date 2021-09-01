import settings from '../../FilesWebclient/vue/settings'
export default {
  moduleName: 'FilesWebclient',

  requiredModules: ['Files'],

  init (appdata) {
    settings.init(appdata)
  },

  getAdminSystemTabs () {
    return [
      {
        tabName: 'files',
        title: 'FILESWEBCLIENT.HEADING_BROWSER_TAB',
        component () {
          return import('./components/FilesAdminSettingsSystemWide')
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
          return import('./components/FilesAdminSettingsPerUser')
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
          return import('./components/FilesAdminSettingsPerTenant')
        }
      }
    ]
  },
}
