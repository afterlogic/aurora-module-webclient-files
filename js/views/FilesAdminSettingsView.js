'use strict';

var
	_ = require('underscore'),
	ko = require('knockout'),
	
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js'),
	Ajax = require('%PathToCoreWebclientModule%/js/Ajax.js'),
	
	ModulesManager = require('%PathToCoreWebclientModule%/js/ModulesManager.js'),
	CAbstractSettingsFormView = ModulesManager.run('AdminPanelWebclient', 'getAbstractSettingsFormViewClass'),
	
	Settings = require('modules/%ModuleName%/js/Settings.js')
;

/**
* @constructor
*/
function CFilesAdminSettingsView()
{
	CAbstractSettingsFormView.call(this, Settings.ServerModuleName);
	
	this.sEntityType = '';
	this.iEntityId = 0;

	this.isSuperAdmin = ko.observable(false);
	this.isTenantAdmin = ko.observable(false);

	/* Editable fields */
	this.enableUploadSizeLimit = ko.observable(Settings.EnableUploadSizeLimit);
	this.uploadSizeLimitMb = ko.observable(Settings.UploadSizeLimitMb);

	this.userSpaceLimitMb = ko.observable(Settings.UserSpaceLimitMb);
	this.tenantSpaceLimitMb = ko.observable(Settings.TenantSpaceLimitMb);
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

CFilesAdminSettingsView.prototype.clearFields = function()
{
};

CFilesAdminSettingsView.prototype.revertGlobalValues = function()
{
	console.log('revertGlobalValues');

	this.enableUploadSizeLimit(Settings.EnableUploadSizeLimit);
	this.uploadSizeLimitMb(Settings.UploadSizeLimitMb);

	this.userSpaceLimitMb(Settings.UserSpaceLimitMb);
	this.tenantSpaceLimitMb(Settings.TenantSpaceLimitMb);
};

CFilesAdminSettingsView.prototype.getParametersForSave = function ()
{
	return {
		'EnableUploadSizeLimit': this.enableUploadSizeLimit(),
		'UploadSizeLimitMb': Types.pInt(this.uploadSizeLimitMb())
	};
};

/**
 * Applies saved values to the Settings object.
 * 
 * @param {Object} oParameters Parameters which were saved on the server side.
 */
CFilesAdminSettingsView.prototype.applySavedValues = function (oParameters)
{
	Settings.updateAdmin(oParameters.EnableUploadSizeLimit, oParameters.UploadSizeLimitMb);
};

/**
 * Sets access level for the view via entity type and entity identifier.
 * This view is visible only for empty entity type.
 * 
 * @param {string} sEntityType Current entity type.
 * @param {number} iEntityId Indentificator of current intity.
 */
CFilesAdminSettingsView.prototype.setAccessLevel = function (sEntityType, iEntityId)
{
	this.sEntityType = sEntityType;
	this.iEntityId = (sEntityType === 'User' || sEntityType === 'Tenant') ? iEntityId : 0;

	this.visible(sEntityType === '' || sEntityType === 'Tenant' || sEntityType === 'User');
	this.isSuperAdmin(sEntityType === '');
	this.isTenantAdmin(sEntityType === 'Tenant');
};

CFilesAdminSettingsView.prototype.onRouteChild = function (aParams)
{
	if (this.sEntityType === 'Tenant' || this.sEntityType === 'User')
	{
		this.requestPerEntitytSettings();
	}
};

CFilesAdminSettingsView.prototype.requestPerEntitytSettings = function ()
{
	console.log('requestPerEntitytSettings', this.iEntityId);
	if (Types.isPositiveNumber(this.iEntityId))
	{
		this.clearFields();
		Ajax.send(Settings.ServerModuleName, 'GetSettingsForEntity', { 'EntityType': this.sEntityType, 'EntityId': this.iEntityId }, function (oResponse) {
			if (oResponse.Result)
			{
				console.log(oResponse.Result);

				this.userSpaceLimitMb(Types.pInt(oResponse.Result.UserSpaceLimitMb));
				this.tenantSpaceLimitMb(Types.pInt(oResponse.Result.TenantSpaceLimitMb));

				console.log(this.userSpaceLimitMb(), this.tenantSpaceLimitMb());

				this.updateSavedState();
			}
		}, this);
	}
	else
	{
		this.revertGlobalValues();
	}
};

CFilesAdminSettingsView.prototype.savePersonal = function ()
{
	if (!_.isFunction(this.validateBeforeSave) || this.validateBeforeSave())
	{
		this.isSaving(true);

		Ajax.send(
			this.sServerModule, 
			'UpdateSettingsForEntity', {
				'EntityType': this.sEntityType,
				'EntityId': Types.pInt(this.iEntityId),
				'UserSpaceLimitMb': Types.pInt(this.userSpaceLimitMb()),
				'TenantSpaceLimitMb': Types.pInt(this.tenantSpaceLimitMb()),
			}, 
			this.onResponse, 
			this
		);
	}
}

module.exports = new CFilesAdminSettingsView();
