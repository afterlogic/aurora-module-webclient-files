'use strict';

var
	_ = require('underscore'),
	ko = require('knockout'),
	
	CAbstractPopup = require('%PathToCoreWebclientModule%/js/popups/CAbstractPopup.js')
;

/**
 * @constructor
 */
function CCreateFolderPopup()
{
	CAbstractPopup.call(this);
	
	this.fCallback = null;
	this.folderName = ko.observable('');
	this.folderName.focus = ko.observable(false);
	this.folderName.error = ko.observable('');
	this.requestInProgress = ko.observable(false);

	this.folderName.subscribe(function () {
		this.folderName.error('');
	}, this);
}

_.extendOwn(CCreateFolderPopup.prototype, CAbstractPopup.prototype);

CCreateFolderPopup.prototype.PopupTemplate = '%ModuleName%_CreateFolderPopup';

/**
 * @param {Function} fCallback
 */
CCreateFolderPopup.prototype.onOpen = function (fCallback)
{
	this.folderName('');
	this.folderName.focus(true);
	this.folderName.error('');
	this.requestInProgress(false);
	
	if (_.isFunction(fCallback))
	{
		this.fCallback = fCallback;
	}
};

CCreateFolderPopup.prototype.onOKClick = function ()
{
	if (this.requestInProgress())
	{
		return;
	}

	this.folderName.error('');
	
	if (this.fCallback)
	{
		this.handleCallbackResult(this.fCallback(this.folderName()));
	}
	else
	{
		setTimeout(function () { this.closePopup(); }.bind(this));
	}
};

/**
 * @param {string|Promise<string>} oResult Sync error text or Promise resolved with error text (empty on success).
 */
CCreateFolderPopup.prototype.handleCallbackResult = function (oResult)
{
	if (oResult && _.isFunction(oResult.then))
	{
		this.requestInProgress(true);
		oResult.then(function (sError) {
			this.requestInProgress(false);
			if (sError)
			{
				this.folderName.error('' + sError);
			}
			else
			{
				// delay is necessary to avoid viewing an image on enter pressed here
				setTimeout(function () { this.closePopup(); }.bind(this));
			}
		}.bind(this));
	}
	else if (oResult)
	{
		this.folderName.error('' + oResult);
	}
	else
	{
		setTimeout(function () { this.closePopup(); }.bind(this));
	}
};

module.exports = new CCreateFolderPopup();