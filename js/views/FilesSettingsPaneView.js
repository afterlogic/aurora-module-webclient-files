'use strict';

var
	_ = require('underscore'),
	ko = require('knockout'),
	
	ModulesManager = require('%PathToCoreWebclientModule%/js/ModulesManager.js'),
	UrlUtils = require('%PathToCoreWebclientModule%/js/utils/Url.js'),
	CAbstractSettingsFormView = ModulesManager.run('SettingsWebclient', 'getAbstractSettingsFormViewClass'),
	
	Settings = require('modules/%ModuleName%/js/Settings.js')
;

/**
 * @constructor
 */
function CFilesSettingsPaneView()
{
	CAbstractSettingsFormView.call(this, Settings.ServerModuleName);

	this.enableFiles = ko.observable(Settings.enableModule());
	
	this.bShowCommonSettings = Settings.bShowCommonSettings;
	this.bShowFilesApps = Settings.bShowFilesApps;
	this.appPath = UrlUtils.getAppPath();
}

_.extendOwn(CFilesSettingsPaneView.prototype, CAbstractSettingsFormView.prototype);

CFilesSettingsPaneView.prototype.ViewTemplate = '%ModuleName%_FilesSettingsPaneView';

CFilesSettingsPaneView.prototype.getCurrentValues = function ()
{
	return [
		this.enableFiles()
	];
};

CFilesSettingsPaneView.prototype.revertGlobalValues = function ()
{
	this.enableFiles(Settings.enableModule());
};

CFilesSettingsPaneView.prototype.getParametersForSave = function ()
{
	return {
		'FilesEnable': this.enableFiles() ? '1' : '0'
	};
};

CFilesSettingsPaneView.prototype.applySavedValues = function (oParameters)
{
	Settings.update(oParameters.FilesEnable);
};

module.exports = new CFilesSettingsPaneView();
