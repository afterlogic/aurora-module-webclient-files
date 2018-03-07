'use strict';

var
	_ = require('underscore'),
	
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

	this.bShowFilesApps = Settings.ShowFilesApps;

	this.sAppPath = UrlUtils.getAppPath();
}

_.extendOwn(CFilesSettingsFormView.prototype, CAbstractSettingsFormView.prototype);

CFilesSettingsFormView.prototype.ViewTemplate = '%ModuleName%_FilesSettingsFormView';

module.exports = new CFilesSettingsFormView();
