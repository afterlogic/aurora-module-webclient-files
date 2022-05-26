import settings from './settings'

import FilesAdminSettingsPerTenant from './components/FilesAdminSettingsPerTenant'
import FilesAdminSettingsPerUser from './components/FilesAdminSettingsPerUser'

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
        tabTitle: 'FILESWEBCLIENT.HEADING_BROWSER_TAB',
        tabRouteChildren: [
          { path: 'files', component: () => import('./components/FilesAdminSettingsSystemWide') },
        ],
      }
    ]
  },

  getAdminUserTabs () {
    return [
      {
        tabName: 'files',
        tabTitle: 'FILESWEBCLIENT.HEADING_BROWSER_TAB',
        tabRouteChildren: [
          { path: 'id/:id/files', component: FilesAdminSettingsPerUser },
          { path: 'search/:search/id/:id/files', component: FilesAdminSettingsPerUser },
          { path: 'page/:page/id/:id/files', component: FilesAdminSettingsPerUser },
          { path: 'search/:search/page/:page/id/:id/files', component: FilesAdminSettingsPerUser },
        ],
      },
    ]
  },

  getAdminTenantTabs () {
    return [
      {
        tabName: 'files',
        tabTitle: 'FILESWEBCLIENT.HEADING_BROWSER_TAB',
        tabRouteChildren: [
          { path: 'id/:id/files', component: FilesAdminSettingsPerTenant },
          { path: 'search/:search/id/:id/files', component: FilesAdminSettingsPerTenant },
          { path: 'page/:page/id/:id/files', component: FilesAdminSettingsPerTenant },
          { path: 'search/:search/page/:page/id/:id/files', component: FilesAdminSettingsPerTenant },
        ],
      },
    ]
  },
}
