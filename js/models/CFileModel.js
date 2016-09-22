'use strict';

var
	_ = require('underscore'),
	$ = require('jquery'),
	ko = require('knockout'),
	
	FilesUtils = require('%PathToCoreWebclientModule%/js/utils/Files.js'),
	TextUtils = require('%PathToCoreWebclientModule%/js/utils/Text.js'),
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js'),
	
	UserSettings = require('%PathToCoreWebclientModule%/js/Settings.js'),
	WindowOpener = require('%PathToCoreWebclientModule%/js/WindowOpener.js'),
	
	CAbstractFileModel = require('%PathToCoreWebclientModule%/js/models/CAbstractFileModel.js'),
	CDateModel = require('%PathToCoreWebclientModule%/js/models/CDateModel.js'),
	
	Popups = require('%PathToCoreWebclientModule%/js/Popups.js'),
	EmbedHtmlPopup = require('%PathToCoreWebclientModule%/js/popups/EmbedHtmlPopup.js'),
	
	Settings = require('modules/%ModuleName%/js/Settings.js')
;

/**
 * @constructor
 * @extends CCommonFileModel
 */
function CFileModel()
{
	this.id = ko.observable('');
	this.fileName = ko.observable('');
	this.storageType = ko.observable(Enums.FileStorageType.Personal);
	this.lastModified = ko.observable('');
	
	this.path = ko.observable('');
	this.fullPath = ko.observable('');
	
	this.selected = ko.observable(false);
	this.checked = ko.observable(false);
	
	this.sPublicHash = '';

	this.isExternal = ko.observable(false);
	this.isLink = ko.observable(false);
	this.linkType = ko.observable('');
	this.linkUrl = ko.observable('');
	this.thumbnailExternalLink = ko.observable('');
	this.embedType = ko.observable('');
	this.linkType.subscribe(function (sLinkType) {
		var sEmbedType = '';
		if (sLinkType === 'oembeded')
		{
			sEmbedType = 'oembeded';
		}
		this.hasHtmlEmbed(sEmbedType !== '');
		this.embedType(sEmbedType);
	}, this);
	
	this.deleted = ko.observable(false); // temporary removal until it was confirmation from the server to delete
	this.recivedAnim = ko.observable(false).extend({'autoResetToFalse': 500});
	this.shared = ko.observable(false);
	this.ownerName = ko.observable('');
	
	this.ownerHeaderText = ko.computed(function () {
		return TextUtils.i18n('%MODULENAME%/LABEL_OWNER_EMAIL', {
			'OWNER': this.ownerName()
		});
	}, this);
	
	this.lastModifiedHeaderText = ko.computed(function () {
		return TextUtils.i18n('%MODULENAME%/LABEL_LAST_MODIFIED', {
			'LASTMODIFIED': this.lastModified()
		});
	}, this);
	
	CAbstractFileModel.call(this, Settings.ServerModuleName);
	
	this.type = this.storageType;
	this.uploaded = ko.observable(true);

	this.viewLink = ko.computed(function () {
		return this.isLink() ? this.linkUrl() : FilesUtils.getViewLink(Settings.ServerModuleName, this.hash(), this.sPublicHash);
	}, this);

	this.isViewable = ko.computed(function () {
		
		var 
			bResult = false,
			aViewableArray = [
				'JPEG', 'JPG', 'PNG', 'GIF', 'HTM', 'HTML', 'TXT', 'CSS', 'ASC', 'JS', 'PDF', 'BMP'
			]
		;
		
		if (_.indexOf(aViewableArray, this.extension().toUpperCase()) >= 0)
		{
			bResult = true;
		}

		return (this.iframedView() || bResult || (this.isLink())) && !this.isPopupItem();

	}, this);
	
	this.visibleViewLink = ko.computed(function () {
		return (this.embedType() !== '' || this.linkUrl() === '') && this.isViewable();
	}, this);
	this.visibleOpenLink = ko.computed(function () {
		return this.linkUrl() !== '';
	}, this);
	this.visibleDownloadLink = ko.computed(function () {
		return !this.isPopupItem() && !this.visibleOpenLink();
	}, this);

	this.thumbnailLink = ko.computed(function () {
		if (this.isExternal() || (this.isLink()))
		{
			return this.thumbnailExternalLink();
		}
		else
		{
			return FilesUtils.getThumbnailLink(Settings.ServerModuleName, this.hash(), this.sPublicHash);
		}
	}, this);

	this.canShare = ko.computed(function () {
		return (this.storageType() === Enums.FileStorageType.Personal || this.storageType() === Enums.FileStorageType.Corporate);
	}, this);
	
	this.sHtmlEmbed = ko.observable('');
}

_.extendOwn(CFileModel.prototype, CAbstractFileModel.prototype);

/**
 * @returns {CFileModel}
 */
CFileModel.prototype.getInstance = function ()
{
	return new CFileModel();
};

/**
 * @param {object} oData
 * @param {string} sLinkUrl
 */
CFileModel.prototype.parseLink = function (oData, sLinkUrl)
{
	this.isPopupItem(true);
	this.linkUrl(sLinkUrl);
	this.fileName(Types.pString(oData.Name));
	this.size(Types.pInt(oData.Size));
	this.linkType(Enums.has('FileStorageLinkType', Types.pString(oData.LinkType)) ? Types.pString(oData.LinkType) : '');
	this.allowDownload(false);
	if (oData.Thumb)
	{
		this.thumb(true);
		this.thumbnailSrc(Types.pString(oData.Thumb));
	}
};

/**
 * @param {object} oData
 * @param {boolean} bPopup
 */
CFileModel.prototype.parse = function (oData, bPopup)
{
	var oDateModel = new CDateModel();
	
	this.allowSelect(true);
	this.allowDrag(true);
	this.allowCheck(true);
	this.allowDelete(true);
	this.allowUpload(true);
	this.allowSharing(true);
	this.allowHeader(true);
	this.allowDownload(true);
	this.isPopupItem(bPopup);
		
	this.isLink(!!oData.IsLink);
	this.fileName(Types.pString(oData.Name));
	this.id(Types.pString(oData.Id));
	this.path(Types.pString(oData.Path));
	this.fullPath(Types.pString(oData.FullPath));
	this.storageType(Types.pString(oData.Type));
	this.shared(!!oData.Shared);
	this.isExternal(!!oData.IsExternal);

	this.iframedView(!!oData.Iframed);
	
	if (this.isLink())
	{
		this.linkUrl(Types.pString(oData.LinkUrl));
		this.linkType(Types.pString(oData.LinkType));
	}
	
	this.size(Types.pInt(oData.Size));
	oDateModel.parse(oData['LastModified']);
	this.lastModified(oDateModel.getShortDate());
	this.ownerName(Types.pString(oData.Owner));
	this.thumb(!!oData.Thumb);
	this.thumbnailExternalLink(Types.pString(oData.ThumbnailLink));
	this.hash(Types.pString(oData.Hash));
	this.sHtmlEmbed(oData.OembedHtml ? oData.OembedHtml : '');
	
	if (this.thumb() && this.thumbnailExternalLink() === '')
	{
		FilesUtils.thumbQueue(this.thumbnailSessionUid(), this.thumbnailLink(), this.thumbnailSrc);
	}
	
	this.content(Types.pString(oData.Content));
};

/**
 * Fills attachment data for upload.
 * 
 * @param {string} sFileUid
 * @param {Object} oFileData
 * @param {string} sFileName
 * @param {string} sOwner
 * @param {string} sPath
 * @param {string} sStorageType
 */
CFileModel.prototype.onUploadSelectOwn = function (sFileUid, oFileData, sFileName, sOwner, sPath, sStorageType)
{
	var
		oDateModel = new CDateModel(),
		oDate = new Date()
	;
	
	this.onUploadSelect(sFileUid, oFileData);
	
	oDateModel.parse(oDate.getTime() /1000);
	this.fileName(sFileName);
	this.lastModified(oDateModel.getShortDate());
	this.ownerName(sOwner);
	this.path(sPath);
	this.storageType(sStorageType);
};

CFileModel.prototype.downloadFile = function ()
{
	if (this.allowDownload())
	{
		var
			oForm = $('<form action="?/Api/" method="post" target="my_iframe"></form>').appendTo(document.body),
			oIframe = $('<iframe style="display: none;" name="my_iframe"></iframe>').appendTo(document.body)
		;

		$('<input type="hidden" name="Module" />').val('Files').appendTo(oForm);
		$('<input type="hidden" name="Method" />').val('DownloadFile').appendTo(oForm);
		$('<input type="hidden" name="AuthToken" />').val($.cookie('AuthToken')).appendTo(oForm);
		$('<input type="hidden" name="TenantName" />').val(UserSettings.TenantName).appendTo(oForm);
		$('<input type="hidden" name="Format" />').val('Raw').appendTo(oForm);
		$('<input type="hidden" name="Parameters" />').val(JSON.stringify({
			'Type': this.type(),
			'Name': this.fileName(),
			'Path': this.path()
		})).appendTo(oForm);

		oForm.submit();

		setTimeout(function () {
			oIframe.remove();
		}, 200000);
	}
};

/**
 * Starts viewing attachment on click.
 */
CFileModel.prototype.viewFile = function ()
{
	if (this.sHtmlEmbed() !== '')
	{
		Popups.showPopup(EmbedHtmlPopup, [this.sHtmlEmbed()]);
	}
	else if (this.isLink())
	{
		this.viewCommonFile(this.linkUrl());
	}
	else
	{
		var oWin = WindowOpener.open('', this.fileName(), true);
		oWin.document.write('<form action="?/Api/" method="post" id="myform" target="my_iframe">');
		oWin.document.write('<input type="hidden" name="Module" value="Files" />');
		oWin.document.write('<input type="hidden" name="Method" value="ViewFile" />');
		oWin.document.write('<input type="hidden" name="AuthToken" value="' + $.cookie('AuthToken') + '" />');
		oWin.document.write('<input type="hidden" name="TenantName" value="' + UserSettings.TenantName + '" />');
		oWin.document.write('</form>');
		oWin.document.write('<iframe name="my_iframe"></iframe>');
		var oForm = $(oWin.document).find('#myform');
		$('<input type="hidden" name="Format" />').val('Raw').appendTo(oForm);
		$('<input type="hidden" name="Parameters" />').val(JSON.stringify({
			'Type': this.type(),
			'Name': this.fileName(),
			'Path': this.path()
		})).appendTo(oForm);
		oForm.submit();
	}
};

CFileModel.prototype.openLink = function ()
{
	WindowOpener.openTab(this.viewLink());
};

/**
 * @param {Object} oViewModel
 * @param {Object} oEvent
 */
CFileModel.prototype.onIconClick = function (oViewModel, oEvent)
{
	if (this.embedType() !== '')
	{
		this.viewFile(oViewModel, oEvent);
	}
};

module.exports = CFileModel;
