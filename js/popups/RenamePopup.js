'use strict';

var
	_ = require('underscore'),
	ko = require('knockout'),
	
	CAbstractPopup = require('%PathToCoreWebclientModule%/js/popups/CAbstractPopup.js')
;

/**
 * @constructor
 */
function CRenamePopup()
{
	CAbstractPopup.call(this);
	
	this.fCallback = null;
	
	this.name = ko.observable('');
	this.focused = ko.observable(false);
	this.error = ko.observable('');
	this.requestInProgress = ko.observable(false);
	this.name.subscribe(function () {
		this.error('');
	}, this);
}

_.extendOwn(CRenamePopup.prototype, CAbstractPopup.prototype);

CRenamePopup.prototype.PopupTemplate = '%ModuleName%_RenamePopup';

/**
 * @param {string} sName
 * @param {function} fCallback
 */
CRenamePopup.prototype.onOpen = function (sName, fCallback)
{
	this.fCallback = fCallback;
	
	this.name(sName);
	this.focused(true);
	this.error('');
	this.requestInProgress(false);
};

CRenamePopup.prototype.onOKClick = function ()
{
	if (this.requestInProgress())
	{
		return;
	}

	this.error('');
	
	if (_.isFunction(this.fCallback))
	{
		this.handleCallbackResult(this.fCallback(this.name()));
	}
	else
	{
		setTimeout(function () { this.closePopup(); }.bind(this));
	}
};

/**
 * @param {string|Promise<string>} oResult Sync error text or Promise resolved with error text (empty on success).
 */
CRenamePopup.prototype.handleCallbackResult = function (oResult)
{
	if (oResult && _.isFunction(oResult.then))
	{
		this.requestInProgress(true);
		oResult.then(function (sError) {
			this.requestInProgress(false);
			if (sError)
			{
				this.error('' + sError);
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
		this.error('' + oResult);
	}
	else
	{
		setTimeout(function () { this.closePopup(); }.bind(this));
	}
};

module.exports = new CRenamePopup();
