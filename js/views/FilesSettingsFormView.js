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
function CFilesSettingsFormView()
{
	CAbstractSettingsFormView.call(this, 'FilesWebclient');

	this.enableFiles = ko.observable(Settings.enableModule());
	
	this.bShowCommonSettings = Settings.bShowCommonSettings;
	this.bShowFilesApps = Settings.bShowFilesApps;
	this.appPath = UrlUtils.getAppPath();
}

_.extendOwn(CFilesSettingsFormView.prototype, CAbstractSettingsFormView.prototype);

CFilesSettingsFormView.prototype.ViewTemplate = '%ModuleName%_FilesSettingsFormView';

CFilesSettingsFormView.prototype.getCurrentValues = function ()
{
	return [
		this.enableFiles()
	];
};

CFilesSettingsFormView.prototype.revertGlobalValues = function ()
{
	this.enableFiles(Settings.enableModule());
};

CFilesSettingsFormView.prototype.getParametersForSave = function ()
{
	return {
		'FilesEnable': this.enableFiles() ? '1' : '0'
	};
};

CFilesSettingsFormView.prototype.applySavedValues = function (oParameters)
{
	Settings.update(oParameters.FilesEnable);
};

module.exports = new CFilesSettingsFormView();
