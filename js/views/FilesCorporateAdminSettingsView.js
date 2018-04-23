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
function CFilesCorporateAdminSettingsView()
{
	CAbstractSettingsFormView.call(this, Settings.CorporateServerModuleName);
	
	/* Editable fields */
	this.spaceLimitMb = ko.observable(Settings.CorporateSpaceLimitMb);
	/*-- Editable fields */
}

_.extendOwn(CFilesCorporateAdminSettingsView.prototype, CAbstractSettingsFormView.prototype);

CFilesCorporateAdminSettingsView.prototype.ViewTemplate = '%ModuleName%_FilesCorporateAdminSettingsView';

CFilesCorporateAdminSettingsView.prototype.getCurrentValues = function()
{
	return [
		this.spaceLimitMb()
	];
};

CFilesCorporateAdminSettingsView.prototype.revertGlobalValues = function()
{
	this.spaceLimitMb(Settings.CorporateSpaceLimitMb);
};

CFilesCorporateAdminSettingsView.prototype.getParametersForSave = function ()
{
	return {
		'SpaceLimitMb': Types.pInt(this.spaceLimitMb())
	};
};

/**
 * Applies saved values to the Settings object.
 * 
 * @param {Object} oParameters Parameters which were saved on the server side.
 */
CFilesCorporateAdminSettingsView.prototype.applySavedValues = function (oParameters)
{
	Settings.updateAdminCorporate(oParameters.SpaceLimitMb);
};

/**
 * Sets access level for the view via entity type and entity identifier.
 * This view is visible only for empty entity type.
 * 
 * @param {string} sEntityType Current entity type.
 * @param {number} iEntityId Indentificator of current intity.
 */
CFilesCorporateAdminSettingsView.prototype.setAccessLevel = function (sEntityType, iEntityId)
{
	this.visible(sEntityType === '');
};

module.exports = new CFilesCorporateAdminSettingsView();
