'use strict';

var
	_ = require('underscore'),
	ko = require('knockout'),
	
	Types = require('modules/CoreClient/js/utils/Types.js'),
	
	ModulesManager = require('modules/CoreClient/js/ModulesManager.js'),
	CAbstractSettingsFormView = ModulesManager.run('SettingsClient', 'getAbstractSettingsFormViewClass'),
	
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
	/*-- Editable fields */
}

_.extendOwn(CFilesAdminSettingsView.prototype, CAbstractSettingsFormView.prototype);

CFilesAdminSettingsView.prototype.ViewTemplate = '%ModuleName%_FilesAdminSettingsView';

CFilesAdminSettingsView.prototype.getCurrentValues = function()
{
	return [
		this.enableUploadSizeLimit(),
		this.uploadSizeLimitMb()
	];
};

CFilesAdminSettingsView.prototype.revertGlobalValues = function()
{
	this.enableUploadSizeLimit(Settings.EnableUploadSizeLimit);
	this.uploadSizeLimitMb(Settings.UploadSizeLimitMb);
};

CFilesAdminSettingsView.prototype.getParametersForSave = function ()
{
	return {
		'EnableUploadSizeLimit': this.enableUploadSizeLimit(),
		'UploadSizeLimitMb': Types.pInt(this.uploadSizeLimitMb())
	};
};

/**
 * @param {Object} oParameters
 */
CFilesAdminSettingsView.prototype.applySavedValues = function (oParameters)
{
//	Settings.update(oParameters.EnableUploadSizeLimit, oParameters.UploadSizeLimitMb);
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
