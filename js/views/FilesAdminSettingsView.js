'use strict';

var
	_ = require('underscore'),
	ko = require('knockout'),
	
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js'),
	
	ModulesManager = require('%PathToCoreWebclientModule%/js/ModulesManager.js'),
	CAbstractSettingsFormView = ModulesManager.run('SettingsWebclient', 'getAbstractSettingsFormViewClass'),
	
	Settings = require('modules/%ModuleName%/js/Settings.js')
;

/**
* @constructor
*/
function CFilesAdminSettingsView()
{
	CAbstractSettingsFormView.call(this, Settings.ServerModuleName);
	
	/* Editable fields */
	this.enableUploadSizeLimit = ko.observable(Settings.EnableUploadSizeLimit);
	this.uploadSizeLimitMb = ko.observable(Settings.UploadSizeLimitMb);
	this.enableCorporate = ko.observable(Settings.EnableCorporate);
	this.userSpaceLimitMb = ko.observable(Settings.UserSpaceLimitMb);
	/*-- Editable fields */
}

_.extendOwn(CFilesAdminSettingsView.prototype, CAbstractSettingsFormView.prototype);

CFilesAdminSettingsView.prototype.ViewTemplate = '%ModuleName%_FilesAdminSettingsView';

CFilesAdminSettingsView.prototype.getCurrentValues = function()
{
	return [
		this.enableUploadSizeLimit(),
		this.uploadSizeLimitMb(),
		this.enableCorporate(),
		this.userSpaceLimitMb()
	];
};

CFilesAdminSettingsView.prototype.revertGlobalValues = function()
{
	this.enableUploadSizeLimit(Settings.EnableUploadSizeLimit);
	this.uploadSizeLimitMb(Settings.UploadSizeLimitMb);
	this.enableCorporate(Settings.EnableCorporate);
	this.userSpaceLimitMb(Settings.UserSpaceLimitMb);
};

CFilesAdminSettingsView.prototype.getParametersForSave = function ()
{
	return {
		'EnableUploadSizeLimit': this.enableUploadSizeLimit(),
		'UploadSizeLimitMb': Types.pInt(this.uploadSizeLimitMb()),
		'EnableCorporate': this.enableCorporate(),
		'UserSpaceLimitMb': Types.pInt(this.userSpaceLimitMb())
	};
};

/**
 * Applies saved values to the Settings object.
 * 
 * @param {Object} oParameters Parameters which were saved on the server side.
 */
CFilesAdminSettingsView.prototype.applySavedValues = function (oParameters)
{
	Settings.updateAdmin(oParameters.EnableUploadSizeLimit, oParameters.UploadSizeLimitMb, oParameters.EnableCorporate, oParameters.UserSpaceLimitMb);
};

/**
 * Sets access level for the view via entity type and entity identificator.
 * This view is visible only for empty entity type.
 * 
 * @param {string} sEntityType Current entity type.
 * @param {number} iEntityId Indentificator of current intity.
 */
CFilesAdminSettingsView.prototype.setAccessLevel = function (sEntityType, iEntityId)
{
	this.visible(sEntityType === '');
};

module.exports = new CFilesAdminSettingsView();
