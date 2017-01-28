'use strict';

var
	_ = require('underscore'),
	$ = require('jquery'),
	ko = require('knockout'),
	moment = require('moment'),
	
	FilesUtils = require('%PathToCoreWebclientModule%/js/utils/Files.js'),
	TextUtils = require('%PathToCoreWebclientModule%/js/utils/Text.js'),
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js'),
	Utils = require('%PathToCoreWebclientModule%/js/utils/Common.js'),
	
	App = require('%PathToCoreWebclientModule%/js/App.js'),
	UserSettings = require('%PathToCoreWebclientModule%/js/Settings.js'),
	WindowOpener = require('%PathToCoreWebclientModule%/js/WindowOpener.js'),
	
	CAbstractFileModel = require('%PathToCoreWebclientModule%/js/models/CAbstractFileModel.js'),
	CDateModel = require('%PathToCoreWebclientModule%/js/models/CDateModel.js'),
	
	Popups = require('%PathToCoreWebclientModule%/js/Popups.js'),
	EmbedHtmlPopup = require('%PathToCoreWebclientModule%/js/popups/EmbedHtmlPopup.js'),
	
	Settings = require('modules/%ModuleName%/js/Settings.js'),
	
	Enums = window.Enums
;

/**
 * @constructor
 * @param {Object} oData
 * @param {bool} bPopup
 * @extends CAbstractFileModel
 */
function CFileModel(oData, bPopup)
{
	this.storageType = ko.observable(Types.pString(oData.Type));
	this.sLastModified = CFileModel.parseLastModified(oData.LastModified);
	
	this.path = ko.observable(Types.pString(oData.Path));
	this.fullPath = ko.observable(Types.pString(oData.FullPath));
	
	this.selected = ko.observable(false);
	this.checked = ko.observable(false);
	
	this.bIsLink = !!oData.IsLink;
	this.sLinkType = this.bIsLink ? Types.pString(oData.LinkType) : '';
	this.sLinkUrl = this.bIsLink ? Types.pString(oData.LinkUrl) : '';
	this.sThumbnailExternalLink = Types.pString(oData.ThumbnailLink);
	
	this.deleted = ko.observable(false); // temporary removal until it was confirmation from the server to delete
	this.recivedAnim = ko.observable(false).extend({'autoResetToFalse': 500});
	this.shared = ko.observable(false);
	this.sOwnerName = Types.pString(oData.Owner);
	
	CAbstractFileModel.call(this, Settings.ServerModuleName);
	
	this.oActionsData['list'] = {
		'Text': TextUtils.i18n('COREWEBCLIENT/ACTION_VIEW_FILE'),
		'Handler': _.bind(function () { App.broadcastEvent('Files::ShowList', {'Item': this}); }, this)
	};
	this.oActionsData['open'] = {
		'Text': TextUtils.i18n('COREWEBCLIENT/ACTION_OPEN_LINK'),
		'Handler': _.bind(this.openLink, this)
	};
	
	this.iconAction('');
	
	this.sHeaderText = _.bind(function () {
		if (this.sLastModified)
		{
			var sLangConstName = this.sOwnerName !== '' ? '%MODULENAME%/INFO_OWNER_AND_DATA' : '%MODULENAME%/INFO_DATA';
			return TextUtils.i18n(sLangConstName, {
				'OWNER': this.sOwnerName,
				'LASTMODIFIED': this.sLastModified
			});
		}
		return '';
	}, this)();
	
	this.type = this.storageType;

	this.getViewLink = function () {
		return this.bIsLink ? this.sLinkUrl : FilesUtils.getViewLink(Settings.ServerModuleName, this.hash(), Settings.PublicHash);
	};

	this.canShare = ko.computed(function () {
		return (this.storageType() === Enums.FileStorageType.Personal || this.storageType() === Enums.FileStorageType.Corporate);
	}, this);
	
	this.sHtmlEmbed = Types.pString(oData.OembedHtml);
	
	if (Types.isNonEmptyArray(oData.Actions))
	{
		this.actions(oData.Actions);
		this.sMainAction = Types.pString(oData.Actions[0]);
	}
	else
	{
		this.actions(['view']);
		this.sMainAction = 'view';
	}
	
	this.cssClasses = ko.computed(function () {
		var aClasses = this.getCommonClasses();
		
		if (this.allowDrag())
		{
			aClasses.push('dragHandle');
		}
		if (this.selected())
		{
			aClasses.push('selected');
		}
		if (this.checked())
		{
			aClasses.push('checked');
		}
		if (this.deleted())
		{
			aClasses.push('deleted');
		}
		if (this.allowSharing() && this.shared())
		{
			aClasses.push('shared');
		}
		if (this.bIsLink)
		{
			aClasses.push('aslink');
		}
		
		return aClasses.join(' ');
	}, this);
	
	this.parse(oData, bPopup);
}

_.extendOwn(CFileModel.prototype, CAbstractFileModel.prototype);

/**
 * Parses date of last file modification.
 * @param {number} iLastModified Date in unix fomat
 * @returns {String}
 */
CFileModel.parseLastModified = function (iLastModified)
{
	var oDateModel = new CDateModel();
	if (iLastModified)
	{
		oDateModel.parse(iLastModified);
		return oDateModel.getShortDate();
	}
	return '';
};

/**
 * Prepares data of link for its further parsing.
 * @param {Object} oData Data received from the server after URL checking.
 * @param {string} sLinkUrl Link URL.
 * @returns {Object}
 */
CFileModel.prepareLinkData = function (oData, sLinkUrl)
{
	return {
		IsLink: true,
		LinkType: oData.LinkType,
		LinkUrl: sLinkUrl,
		Name: oData.Name,
		Size: oData.Size,
		Thumb: Types.isNonEmptyString(oData.Thumb),
		ThumbnailLink: oData.Thumb
	};
};

/**
 * Parses data from server.
 * @param {object} oData
 * @param {boolean} bPopup
 */
CFileModel.prototype.parse = function (oData, bPopup)
{
	this.uploaded(true);
	this.allowDrag(!bPopup);
	this.allowUpload(true);
	this.allowSharing(true);
	this.allowDownload(this.fullPath() !== '');
	this.allowActions(!bPopup && this.fullPath() !== '');
		
	this.fileName(Types.pString(oData.Name));
	this.id(Types.pString(oData.Id));
	this.shared(!!oData.Shared);

	this.iframedView(!!oData.Iframed);
	
	this.size(Types.pInt(oData.Size));
	this.thumb(!!oData.Thumb);
	this.hash(Types.pString(oData.Hash));
	
	if (this.thumb())
	{
		if (this.sThumbnailExternalLink === '')
		{
			FilesUtils.thumbBase64Queue(this);
		}
		else
		{
			this.thumbnailSrc(this.sThumbnailExternalLink);
		}
	}
	
	this.mimeType(Types.pString(oData.ContentType));

	this.bHasHtmlEmbed = !bPopup && this.fullPath() !== '' && this.sLinkType === 'oembeded';
	if (this.bHasHtmlEmbed)
	{
		this.iconAction('view');
	}
	if (!this.isViewSupported() && !this.bHasHtmlEmbed)
	{
		this.actions(_.without(this.actions(), 'view'));
	}
	
	App.broadcastEvent('%ModuleName%::ParseFile::after', this);
};

CFileModel.prototype.addAction = function (sAction, bMain, oActionData)
{
	if (bMain)
	{
		this.actions.unshift(sAction);
	}
	else
	{
		this.actions.push(sAction);
	}
	this.actions(_.compact(this.actions()));
	if (oActionData)
	{
		this.oActionsData[sAction] = oActionData;
	}
};

/**
 * Prepares data of upload file for its further parsing.
 * @param {Object} oFileData
 * @param {string} sPath
 * @param {string} sStorageType
 * @param {Function} fGetFileByName
 * @returns {Object}
 */
CFileModel.prepareUploadFileData = function (oFileData, sPath, sStorageType, fGetFileByName)
{
	var
		sFileName = oFileData.FileName,
		sFileNameExt = Utils.getFileExtension(sFileName),
		sFileNameWoExt = Utils.getFileNameWithoutExtension(sFileName),
		iIndex = 0
	;
	
	if (sFileNameExt !== '')
	{
		sFileNameExt = '.' + sFileNameExt;
	}
	
	while (fGetFileByName(sFileName))
	{
		sFileName = sFileNameWoExt + '_' + iIndex + sFileNameExt;
		iIndex++;
	}
	
	return {
		Name: sFileName,
		LastModified: moment().unix(),
		Owner: App.userPublicId(),
		Path: sPath,
		Type: sStorageType,
		ContentType: oFileData.Type,
		Size: oFileData.Size
	};
};

/**
 * Fills form with fields for further file downloading or viewing via post to iframe.
 * @param {object} oForm Jquery object.
 * @param {string} sMethod Method name.
 */
CFileModel.prototype.createFormFields = function (oForm, sMethod)
{
	$('<input type="hidden" name="Module" />').val('Files').appendTo(oForm);
	$('<input type="hidden" name="Method" />').val(sMethod).appendTo(oForm);
	$('<input type="hidden" name="AuthToken" />').val($.cookie('AuthToken')).appendTo(oForm);
	$('<input type="hidden" name="TenantName" />').val(UserSettings.TenantName).appendTo(oForm);
	$('<input type="hidden" name="Parameters" />').val(JSON.stringify({
		'Type': this.type(),
		'Name': encodeURIComponent(this.id()),
		'Path': encodeURIComponent(this.path())
	})).appendTo(oForm);
};

/**
 * Downloads file via post to iframe.
 */
CFileModel.prototype.downloadFile = function ()
{
	if (this.allowDownload())
	{
		var
			sIframeName = 'download_iframe_' + Math.random(),
			oForm = $('<form action="?/Api/" method="post" target="' + sIframeName + '"></form>').hide().appendTo(document.body),
			oIframe = $('<iframe name="' + sIframeName + '"></iframe>').hide().appendTo(document.body)
		;
		this.createFormFields(oForm, 'DownloadFile');
		$('<input type="hidden" name="Format" />').val('Raw').appendTo(oForm);
		oForm.submit();
		setTimeout(function () {
			oForm.remove();
			oIframe.remove();
		}, 200000);
	}
};

/**
 * Opens file viewing via post to iframe.
 * @param {Object} oFileModel
 * @param {Object} oEvent
 */
CFileModel.prototype.viewFile = function (oFileModel, oEvent)
{
	if (!oEvent || !oEvent.ctrlKey && !oEvent.shiftKey)
	{
		if (this.sHtmlEmbed !== '')
		{
			Popups.showPopup(EmbedHtmlPopup, [this.sHtmlEmbed]);
		}
		else if (this.bIsLink)
		{
			this.viewCommonFile(this.sLinkUrl);
		}
		else
		{
			var oWin = WindowOpener.open('', this.fileName(), true);
			oWin.document.write('<form action="?/Api/" method="post" id="view_form" target="view_iframe" style="display: none;"></form>');
			oWin.document.write('<iframe name="view_iframe" style="width: 100%; height: 100%; border: none;"></iframe>');
			$(oWin.document.body).css({'margin': '0', 'padding': '0'});
			$('<title>' + this.fileName() + '</title>').appendTo($(oWin.document).find('head'));
			var oForm = $(oWin.document).find('#view_form');
			this.createFormFields(oForm, 'ViewFile');
			$('<input type="hidden" name="Format" />').val('Raw').appendTo(oForm);
			$('<input type="submit" />').val('submit').appendTo(oForm);
			oForm.submit();
		}
	}
};

/**
 * Opens link URL in the new tab.
 */
CFileModel.prototype.openLink = function ()
{
	WindowOpener.openTab(this.getViewLink());
};

module.exports = CFileModel;
