'use strict';

module.exports = function (oAppData) {
	require('modules/%ModuleName%/js/enums.js');

	var
		App = require('%PathToCoreWebclientModule%/js/App.js'),
		ModulesManager = require('%PathToCoreWebclientModule%/js/ModulesManager.js'),

		TextUtils = require('%PathToCoreWebclientModule%/js/utils/Text.js'),

		Settings = require('modules/%ModuleName%/js/Settings.js'),

		HeaderItemView = null,
		
		aToolbarButtons = [],
		oFilesView = null
	;
	
	Settings.init(oAppData);

	if (!ModulesManager.isModuleAvailable(Settings.ServerModuleName) || !App.isPublic() && Settings.Storages.length === 0)
	{
		return null;
	}
	
	if (App.isPublic())
	{
		return {
			getScreens: function () {
				var oScreens = {};
				oScreens[Settings.HashModuleName] = function () {
					var CFilesView = require('modules/%ModuleName%/js/views/CFilesView.js');
					return new CFilesView();
				};
				return oScreens;
			}
		};
	}
	else if (App.isUserNormalOrTenant())
	{
		if (App.isNewTab())
		{
			return {
				getSelectFilesPopup: function () {
					return require('modules/%ModuleName%/js/popups/SelectFilesPopup.js');
				}
			};
		}
		else
		{
			return {
				start: function (ModulesManager) {
					if (Settings.ShowCommonSettings || Settings.ShowFilesApps)
					{
						ModulesManager.run('SettingsWebclient', 'registerSettingsTab', [
							function () { return require('modules/%ModuleName%/js/views/FilesSettingsFormView.js'); },
							Settings.HashModuleName,
							TextUtils.i18n('%MODULENAME%/LABEL_SETTINGS_TAB')
						]);
					}
				},
				getScreens: function () {
					var oScreens = {};
					oScreens[Settings.HashModuleName] = function () {
						var CFilesView = require('modules/%ModuleName%/js/views/CFilesView.js');
						oFilesView = new CFilesView();
						oFilesView.registerToolbarButtons(aToolbarButtons);
						aToolbarButtons = [];
						return oFilesView;
					};
					return oScreens;
				},
				getHeaderItem: function () {
					if (HeaderItemView === null)
					{
						var
							CHeaderItemView = require('%PathToCoreWebclientModule%/js/views/CHeaderItemView.js'),
							sTabTitle = Settings.CustomTabTitle !== '' ? Settings.CustomTabTitle : TextUtils.i18n('%MODULENAME%/ACTION_SHOW_FILES')
						;

						HeaderItemView = new CHeaderItemView(sTabTitle);
					}

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
				getFileConstructor: function (oFile) {
					return require('modules/%ModuleName%/js/models/CFileModel.js');
				},
				addFileToCurrentFolder: function (oFile) {
					if (oFilesView)
					{
						oFilesView.addFileToCurrentFolder(oFile);
					}
				},
				refresh: function () {
					if (oFilesView)
					{
						oFilesView.refresh();
					}
				},
				registerToolbarButtons: function (oToolbarButtons) {
					if (oFilesView)
					{
						oFilesView.registerToolbarButtons([oToolbarButtons]);
					}
					else
					{
						aToolbarButtons.push(oToolbarButtons);
					}
				}
			};
		}
	}
	
	return null;
};
