'use strict';

module.exports = function (oAppData, iUserRole, bPublic) {
	var
		bAdminUser = iUserRole === Enums.UserRole.SuperAdmin,
		bPowerUser = iUserRole === Enums.UserRole.PowerUser
	;
	
	if (bAdminUser || bPowerUser)
	{
		require('modules/%ModuleName%/js/enums.js');

		var
			_ = require('underscore'),

			TextUtils = require('modules/CoreClient/js/utils/Text.js'),

			Ajax = require('modules/%ModuleName%/js/Ajax.js'),
			Settings = require('modules/%ModuleName%/js/Settings.js'),
			oSettings = _.extend({}, oAppData[Settings.ServerModuleName] || {}, oAppData['%ModuleName%'] || {}),

			HeaderItemView = null
		;

		Settings.init(oSettings);

		if (bAdminUser)
		{
			return {
				start: function (ModulesManager) {
					ModulesManager.run('AdminPanelWebclient', 'registerAdminPanelTab', [
						function () { return require('modules/%ModuleName%/js/views/FilesAdminSettingsView.js'); },
						Settings.HashModuleName,
						TextUtils.i18n('%MODULENAME%/LABEL_SETTINGS_TAB')
					]);
				}
			};
		}
		else if (bPowerUser)
		{
			return {
				enableModule: Settings.enableModule,
				start: function (ModulesManager) {
//					ModulesManager.run('SettingsWebclient', 'registerSettingsTab', [
//						function () { return require('modules/%ModuleName%/js/views/FilesSettingsPaneView.js'); },
//						Settings.HashModuleName,
//						TextUtils.i18n('%MODULENAME%/LABEL_SETTINGS_TAB')
//					]);
				},
				getScreens: function () {
					var oScreens = {};
					oScreens[Settings.HashModuleName] = function () {
						var CFilesView = require('modules/%ModuleName%/js/views/CFilesView.js');
						return new CFilesView();
					};
					return oScreens;
				},
				getHeaderItem: function () {
					var
						CHeaderItemView = require('modules/CoreClient/js/views/CHeaderItemView.js'),
						sTabTitle = Settings.CustomTabTitle !== '' ? Settings.CustomTabTitle : TextUtils.i18n('%MODULENAME%/ACTION_SHOW_FILES')
					;

					HeaderItemView = new CHeaderItemView(sTabTitle);

					return {
						item: HeaderItemView,
						name: Settings.HashModuleName
					};
				},
				getSelectFilesPopup: function () {
					return require('modules/%ModuleName%/js/popups/SelectFilesPopup.js');
				},
				getMobileSyncSettingsView: function () {
					return require('modules/%ModuleName%/js/views/MobileSyncSettingsView.js');
				},
				saveFilesByHashes: function (aHashes) {
					if (HeaderItemView)
					{
						HeaderItemView.recivedAnim(true);
					}
					Ajax.send('SaveFilesByHashes', { 'Hashes': aHashes }, this.onSaveAttachmentsToFilesResponse, this);
				}
			};
		}
	}
	
	return null;
};
