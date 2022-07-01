'use strict';

const
	_ = require('underscore'),

	CAbstractPopup = require('%PathToCoreWebclientModule%/js/popups/CAbstractPopup.js'),

	CFilesView = require('modules/%ModuleName%/js/views/CFilesView.js')
;

/**
 * @constructor
 */
function CSelectFilesPopup()
{
	CAbstractPopup.call(this);

	this.callbackHandler = () => {};

	this.filesView = new CFilesView(true);
	this.filesView.onSelectClickPopupBound = _.bind(this.selectFiles, this);
}

_.extendOwn(CSelectFilesPopup.prototype, CAbstractPopup.prototype);

CSelectFilesPopup.prototype.PopupTemplate = '%ModuleName%_SelectFilesPopup';

/**
 * @param {Function} callbackHandler
 */
CSelectFilesPopup.prototype.onOpen = function (callbackHandler)
{
	this.callbackHandler = _.isFunction(callbackHandler) ? callbackHandler : () => {};

	this.filesView.onShow();
};

CSelectFilesPopup.prototype.onBind = function ()
{
	this.filesView.onBind(this.$popupDom);
};

CSelectFilesPopup.prototype.selectFiles = function ()
{
	const
		selectedItems = this.filesView.selector.listCheckedAndSelected(),
		selectedFiles = selectedItems.filter(item => item.IS_FILE)
	;
	this.callbackHandler(selectedFiles);
	this.closePopup();
};

module.exports = new CSelectFilesPopup();
