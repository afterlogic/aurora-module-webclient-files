'use strict';

var
	ko = require('knockout'),
	
	TextUtils = require('%PathToCoreWebclientModule%/js/utils/Text.js'),
	
	App = require('%PathToCoreWebclientModule%/js/App.js'),
	UserSettings = require('%PathToCoreWebclientModule%/js/Settings.js')
;

/**
 * @constructor
 */
function CMobileSyncSettingsView()
{
	this.davServer = ko.observable('');
	this.credentialsHintText = ko.computed(function () {
		console.log('++', App, App.userAccountLogin);
		App.userAccountLogin();
		return TextUtils.i18n('COREWEBCLIENT/INFO_MOBILE_CREDENTIALS', {'LOGIN': App.userAccountLogin()});
	}, this);
		console.log('** App.userAccountLogin()', App.userAccountLogin());
		console.log('** this.credentialsHintText', this.credentialsHintText());
	this.credentialsHintText.subscribe(function () {
		console.log('* App.userAccountLogin()', App.userAccountLogin());
		console.log('* this.credentialsHintText', this.credentialsHintText());
	}, this);
	this.bDemo = UserSettings.IsDemo;
}

CMobileSyncSettingsView.prototype.ViewTemplate = '%ModuleName%_MobileSyncSettingsView';

/**
 * @param {Object} oDav
 */
CMobileSyncSettingsView.prototype.populate = function (oDav)
{
	this.davServer(oDav.Server);
};

module.exports = new CMobileSyncSettingsView();
