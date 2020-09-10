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
	CAbstractSettingsFormView.call(this, Settings.ServerModuleName, 'UpdateSettingsForEntity');
	
	/* Editable fields */
	this.userSpaceLimitMb = ko.observable(Settings.UserSpaceLimitMb);
	this.tenantSpaceLimitMb = ko.observable(Settings.TenantSpaceLimitMb);

	/*-- Editable fields */

	this.sEntityType = '';
	this.iEntityId = 0;

	this.isSuperAdmin = ko.observable(false);

	this.isVisible = ko.observable(true);
}

_.extendOwn(CFilesPersonalAdminSettingsView.prototype, CAbstractSettingsFormView.prototype);

CFilesPersonalAdminSettingsView.prototype.ViewTemplate = '%ModuleName%_FilesPersonalAdminSettingsView';

CFilesPersonalAdminSettingsView.prototype.getCurrentValues = function()
{
	return [
		this.userSpaceLimitMb(),
		this.tenantSpaceLimitMb()
	];
};

CFilesPersonalAdminSettingsView.prototype.revertGlobalValues = function()
{
	this.userSpaceLimitMb(Settings.UserSpaceLimitMb);
	this.tenantSpaceLimitMb(Settings.TenantSpaceLimitMb);
};

CFilesPersonalAdminSettingsView.prototype.getParametersForSave = function ()
{
	var oParameters = {
		'EntityType': this.sEntityType,
		'EntityId': Types.pInt(this.iEntityId),
		'UserSpaceLimitMb': Types.pInt(this.userSpaceLimitMb()),
		'TenantSpaceLimitMb': Types.pInt(this.tenantSpaceLimitMb())
	};
	if (this.sEntityType === 'Tenant')
	{
		oParameters.TenantId = oParameters.EntityId;
	}
	return oParameters;
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
	this.sEntityType = sEntityType;
	this.iEntityId = (sEntityType === 'User' || sEntityType === 'Tenant') ? iEntityId : 0;

	this.visible(sEntityType === '' || sEntityType === 'Tenant' || sEntityType === 'User');
	this.isSuperAdmin(sEntityType === '');
};

CFilesPersonalAdminSettingsView.prototype.hide = function ()
{
	this.isVisible(false);
};

module.exports = new CFilesPersonalAdminSettingsView();
