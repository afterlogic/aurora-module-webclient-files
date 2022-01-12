'use strict';

var
	_ = require('underscore'),
	ko = require('knockout'),

	TextUtils = require('%PathToCoreWebclientModule%/js/utils/Text.js'),
	UrlUtils = require('%PathToCoreWebclientModule%/js/utils/Url.js'),

	Api = require('%PathToCoreWebclientModule%/js/Api.js'),
	CAbstractPopup = require('%PathToCoreWebclientModule%/js/popups/CAbstractPopup.js'),
	ModulesManager = require('%PathToCoreWebclientModule%/js/ModulesManager.js'),
	Popups = require('%PathToCoreWebclientModule%/js/Popups.js'),

	Ajax = require('modules/%ModuleName%/js/Ajax.js'),
	CFolderModel = require('modules/%ModuleName%/js/models/CFolderModel.js'),

	ShowHistoryPopup = ModulesManager.run('ActivityHistory', 'getShowHistoryPopup')
;

/**
 * @constructor
 */
function CSharePopup()
{
	CAbstractPopup.call(this);
	
	this.item = null;
	this.pub = ko.observable('');
	this.pubFocus = ko.observable(false);

	this.bAllowShowHistory = !!ShowHistoryPopup;
}

_.extendOwn(CSharePopup.prototype, CAbstractPopup.prototype);

CSharePopup.prototype.PopupTemplate = '%ModuleName%_SharePopup';

/**
 * @param {Object} oItem
 */
CSharePopup.prototype.onOpen = function (oItem)
{
	this.item = oItem;
	
	this.pub('');
		
	Ajax.send('CreatePublicLink', {
			'Type': oItem.storageType(),
			'Path': oItem.path(),
			'Name': oItem.fileName(),
			'Size': oItem instanceof CFolderModel ? 0 : oItem.size(),
			'IsFolder': oItem instanceof CFolderModel
		}, this.onCreatePublicLinkResponse, this
	);
};

/**
 * @param {Object} response
 */
CSharePopup.prototype.onCreatePublicLinkResponse = function (response)
{
	if (response.Result) {
		this.pub(UrlUtils.getAppPath() + response.Result);
		this.pubFocus(true);
		this.item.published(true);
	} else {
		Api.showErrorByCode(response, TextUtils.i18n('%MODULENAME%/ERROR_CREATE_PUBLIC_LINK'));
	}
};

CSharePopup.prototype.onCancelSharingClick = function ()
{
	if (this.item)
	{
		Ajax.send('DeletePublicLink', {
			'Type': this.item.storageType(),
			'Path': this.item.path(),
			'Name': this.item.fileName()
		}, function (response) {
			if (!response.Result) {
				Api.showErrorByCode(response, TextUtils.i18n('%MODULENAME%/ERROR_DELETE_PUBLIC_LINK'));
			} else {
				this.closePopup();
			}
		}, this);
		this.item.published(false);
	}
};

CSharePopup.prototype.showHistory = function () {
	if (this.bAllowShowHistory)
	{
		Popups.showPopup(ShowHistoryPopup, [TextUtils.i18n('%MODULENAME%/HEADING_HISTORY_POPUP'), this.item]);
	}
}

module.exports = new CSharePopup();