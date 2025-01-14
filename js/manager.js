'use strict';

module.exports = function (oAppData) {
	
	require('modules/%ModuleName%/js/enums.js');

	var
		$ = require('jquery'),

		App = require('%PathToCoreWebclientModule%/js/App.js'),
		ModulesManager = require('%PathToCoreWebclientModule%/js/ModulesManager.js'),

		TextUtils = require('%PathToCoreWebclientModule%/js/utils/Text.js'),

		Settings = require('modules/%ModuleName%/js/Settings.js'),

		HeaderItemView = null,
		
		aToolbarButtons = [],
		oFilesView = null
	;
	let filesViewInstance = null;
	
	const getFilesViewInstance = () => {
		if(!filesViewInstance) {
			const CFilesView = require('modules/%ModuleName%/js/views/CFilesView.js');
			filesViewInstance = new CFilesView();
			
			if (!App.isPublic()) {
				filesViewInstance.registerToolbarButtons(aToolbarButtons);
				aToolbarButtons = [];
			}
		}
		return filesViewInstance;
	};
	
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
				oScreens[Settings.HashModuleName] = getFilesViewInstance;
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

					App.broadcastEvent('RegisterNewItemElement', {
						'title': TextUtils.i18n('%MODULENAME%/ACTION_UPLOAD_FILES'),
						'handler': () => {
							// check if we are on contacts screen or not
							if (!window.location.hash.startsWith('#' + Settings.HashModuleName)) {
								window.location.hash = Settings.HashModuleName
							}

							const filesViewInstance = getFilesViewInstance();
							function clickUploaderButton() {
								const input = filesViewInstance.uploaderButton().find('input')[0];
								if (input) {
									input.click();
									// in case of Upload Button it's needed to emulate click on the button to close the menu
									setTimeout(function () {
										$('.tabsbar .new_button_panel')[0].click()
									}, 0);
								}
							}

							if (filesViewInstance.isCreateAllowed()) {
								if(filesViewInstance.uploaderButton() && filesViewInstance.uploaderButton().find('input').length){
									clickUploaderButton();
								} else {
									const uploaderButtonSubscription = filesViewInstance.uploaderButton.subscribe(() => {
										// Using setTimeout to ensure the DOM is updated before triggering the click
										setTimeout(() => {
											clickUploaderButton();
											uploaderButtonSubscription.dispose();
										}, 0)
									})
								}
							}
						},
						'className': 'item_files',
						'order': 1,
						'column': 2
					});

					App.broadcastEvent('RegisterNewItemElement', {
						'title': TextUtils.i18n('%MODULENAME%/ACTION_NEW_FOLDER'),
						'handler': () => {
							// check if we are on contacts screen or not
							if (!window.location.hash.startsWith('#' + Settings.HashModuleName)) {
								window.location.hash = Settings.HashModuleName
							}

							const filesViewInstance = getFilesViewInstance();
							const command = filesViewInstance.createFolderCommand
							if (command.canExecute()) {
								command()
							}
						},
						'className': 'item_folder',
						'order': 5,
						'column': 2
					});
				},
				getScreens: function () {
					var oScreens = {};
					oScreens[Settings.HashModuleName] = getFilesViewInstance;
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
