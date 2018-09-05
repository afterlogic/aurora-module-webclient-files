'use strict';

var
	_ = require('underscore'),
	ko = require('knockout'),
	
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js'),
	
	ModulesManager = require('%PathToCoreWebclientModule%/js/ModulesManager.js'),
	CAbstractSettingsFormView = ModulesManager.run('AdminPanelWebclient', 'getAbstractSettingsFormViewClass'),
	
	Settings = require('modules/%ModuleName%/js/Settings.js')
;

/**
* @constructor
*/
function CFilesPersonalAdminSettingsView()
{
	CAbstractSettingsFormView.call(this, Settings.PersonalServerModuleName);
	
	/* Editable fields */
	this.userSpaceLimitMb = ko.observable(Settings.PersonalSpaceLimitMb);
	/*-- Editable fields */
	this.isVisible = ko.observable(true);
}

_.extendOwn(CFilesPersonalAdminSettingsView.prototype, CAbstractSettingsFormView.prototype);

CFilesPersonalAdminSettingsView.prototype.ViewTemplate = '%ModuleName%_FilesPersonalAdminSettingsView';

CFilesPersonalAdminSettingsView.prototype.getCurrentValues = function()
{
	return [
		this.userSpaceLimitMb()
	];
};

CFilesPersonalAdminSettingsView.prototype.revertGlobalValues = function()
{
	this.userSpaceLimitMb(Settings.PersonalSpaceLimitMb);
};

CFilesPersonalAdminSettingsView.prototype.getParametersForSave = function ()
{
	return {
		'UserSpaceLimitMb': Types.pInt(this.userSpaceLimitMb())
	};
};

/**
 * Applies saved values to the Settings object.
 * 
 * @param {Object} oParameters Parameters which were saved on the server side.
 */
CFilesPersonalAdminSettingsView.prototype.applySavedValues = function (oParameters)
{
	Settings.updateAdminPersonal(oParameters.UserSpaceLimitMb);
};

/**
 * Sets access level for the view via entity type and entity identifier.
 * This view is visible only for empty entity type.
 * 
 * @param {string} sEntityType Current entity type.
 * @param {number} iEntityId Indentificator of current intity.
 */
CFilesPersonalAdminSettingsView.prototype.setAccessLevel = function (sEntityType, iEntityId)
{
	this.visible(sEntityType === '');
};

CFilesPersonalAdminSettingsView.prototype.hide = function ()
{
	this.isVisible(false);
};

module.exports = new CFilesPersonalAdminSettingsView();
