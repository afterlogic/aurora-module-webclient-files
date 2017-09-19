'use strict';

var
	_ = require('underscore'),
	$ = require('jquery'),
	ko = require('knockout'),
	
	TextUtils = require('%PathToCoreWebclientModule%/js/utils/Text.js'),
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js'),
	Utils = require('%PathToCoreWebclientModule%/js/utils/Common.js'),
	
	Api = require('%PathToCoreWebclientModule%/js/Api.js'),
	App = require('%PathToCoreWebclientModule%/js/App.js'),
	CJua = require('%PathToCoreWebclientModule%/js/CJua.js'),
	CSelector = require('%PathToCoreWebclientModule%/js/CSelector.js'),
	Routing = require('%PathToCoreWebclientModule%/js/Routing.js'),
	Screens = require('%PathToCoreWebclientModule%/js/Screens.js'),
	UserSettings = require('%PathToCoreWebclientModule%/js/Settings.js'),
	
	CAbstractScreenView = require('%PathToCoreWebclientModule%/js/views/CAbstractScreenView.js'),
	
	Popups = require('%PathToCoreWebclientModule%/js/Popups.js'),
	AlertPopup = require('%PathToCoreWebclientModule%/js/popups/AlertPopup.js'),
	ConfirmPopup = require('%PathToCoreWebclientModule%/js/popups/ConfirmPopup.js'),
	CreateFolderPopup = require('modules/%ModuleName%/js/popups/CreateFolderPopup.js'),
	CreateLinkPopup = require('modules/%ModuleName%/js/popups/CreateLinkPopup.js'),
	RenamePopup = require('modules/%ModuleName%/js/popups/RenamePopup.js'),
	SharePopup = require('modules/%ModuleName%/js/popups/SharePopup.js'),
	
	ModulesManager = require('%PathToCoreWebclientModule%/js/ModulesManager.js'),
	ComposeMessageWithAttachments = ModulesManager.run('MailWebclient', 'getComposeMessageWithAttachments'),
	
	LinksUtils = require('modules/%ModuleName%/js/utils/Links.js'),
	
	Ajax = require('modules/%ModuleName%/js/Ajax.js'),
	Settings = require('modules/%ModuleName%/js/Settings.js'),
	
	CFileModel = require('modules/%ModuleName%/js/models/CFileModel.js'),
	CFolderModel = require('modules/%ModuleName%/js/models/CFolderModel.js'),
	
	Enums = window.Enums
;

/**
* @constructor
* @param {boolean=} bPopup = false
*/
function CFilesView(bPopup)
{
	CAbstractScreenView.call(this, '%ModuleName%');
	
	this.browserTitle = ko.observable(TextUtils.i18n('%MODULENAME%/HEADING_BROWSER_TAB'));
	
	this.bAllowSendEmails = _.isFunction(ComposeMessageWithAttachments);
	
	this.error = ko.observable(false);
	this.loaded = ko.observable(false);
	this.bPublic = App.isPublic();
	
	this.storages = ko.observableArray();
	this.folders = ko.observableArray();
	this.files = ko.observableArray();
	this.uploadingFiles = ko.observableArray();

	this.rootPath = ko.observable(this.bPublic ? Settings.PublicFolderName : TextUtils.i18n('%MODULENAME%/LABEL_PERSONAL_STORAGE'));
	this.storageType = ko.observable(Enums.FileStorageType.Personal);
	this.storageDisplayName = ko.computed(function () {
		var oStorage = this.getStorageByType(this.storageType());
		return oStorage ? oStorage.displayName : '';
	}, this);
	this.storageType.subscribe(function () {
		if (this.bPublic)
		{
			this.rootPath(Settings.PublicFolderName);
		}
		else
		{
			var oStorage = this.getStorageByType(this.storageType());
			if (oStorage)
			{
				this.rootPath(oStorage.displayName);
			}
			else if (this.storageType() === 'corporate')
			{
				this.rootPath(TextUtils.i18n('%MODULENAME%/LABEL_CORPORATE_STORAGE'));
			}
			this.selector.listCheckedAndSelected(false);
		}
	}, this);
	
	this.pathItems = ko.observableArray();
	this.currentPath = ko.observable('');
	this.dropPath = ko.observable('');
	ko.computed(function () {
		this.dropPath(this.currentPath());
	}, this);
	
	this.filesCollection = ko.computed(function () {
		var aFiles = _.union(this.files(), this.getUploadingFiles());
		
		aFiles.sort(function(left, right) {
			return left.fileName() === right.fileName() ? 0 : (left.fileName() < right.fileName() ? -1 : 1);
		});
		
		return aFiles;
	}, this);
	
	this.collection = ko.computed(function () {
		return _.union(this.folders(), this.filesCollection());
	}, this);
	
	this.columnCount = ko.observable(1);
	
	this.selector = new CSelector(this.collection, null,
		_.bind(this.onItemDelete, this), _.bind(this.onItemDblClick, this), _.bind(this.onEnter, this), this.columnCount, true, true, true);
		
	this.firstSelectedFile = ko.computed(function () {
		return _.find(this.selector.listCheckedAndSelected(), function (oItem) {
			return oItem instanceof CFileModel;
		});
	}, this);
	
	this.searchPattern = ko.observable('');
	this.newSearchPattern = ko.observable('');
	this.isSearchFocused = ko.observable(false);

	this.renameCommand = Utils.createCommand(this, this.executeRename, function () {
		var aItems = this.selector.listCheckedAndSelected();
		return (1 === aItems.length);
	});
	this.deleteCommand = Utils.createCommand(this, this.executeDelete, function () {
		var 
			aItems = this.selector.listCheckedAndSelected(),
			bAllow = aItems.every(function (oItem)  {
				return !(oItem.uploaded !== undefined && oItem.uploaded() === false || oItem.downloading !== undefined && oItem.downloading() === true);
			})
		;
		return (0 < aItems.length && bAllow);
	});
	this.downloadCommand = Utils.createCommand(this, this.executeDownload, function () {
		var oFile = this.getFileIfOnlyOneSelected();
		return !!oFile && oFile.hasAction('download');
	});
	this.shareCommand = Utils.createCommand(this, this.executeShare, function () {
		var aItems = this.selector.listCheckedAndSelected();
		return (1 === aItems.length && (!aItems[0].bIsLink));
	});
	this.sendCommand = Utils.createCommand(this, this.executeSend, function () {
		var
			aItems = this.selector.listCheckedAndSelected(),
			aFileItems = _.filter(aItems, function (oItem) {
				return oItem instanceof CFileModel;
			}, this)
		;
		return (aFileItems.length > 0);
	});
	
	this.uploaderButton = ko.observable(null);
	this.uploaderArea = ko.observable(null);
	this.bDragActive = ko.observable(false);

	this.bDragActiveComp = ko.computed(function () {
		var bDrag = this.bDragActive();
		return bDrag && this.searchPattern() === '';
	}, this);
	
	this.bAllowDragNDrop = false;
	
	this.uploadError = ko.observable(false);
	
	this.quota = ko.observable(0);
	this.used = ko.observable(0);
	this.quotaDesc = ko.observable('');
	this.quotaProc = ko.observable(-1);
	
	ko.computed(function () {
		if (!UserSettings.ShowQuotaBar)
		{
			return true;
		}

		var
			iQuota = this.quota(),
			iUsed = this.used(),
			iProc = 0 < iQuota ? Math.ceil((iUsed / iQuota) * 100) : -1
		;

		iProc = 100 < iProc ? 100 : iProc;
		
		this.quotaProc(iProc);
		this.quotaDesc(-1 < iProc ?
			TextUtils.i18n('COREWEBCLIENT/INFO_QUOTA', {
				'PROC': iProc,
				'QUOTA': TextUtils.getFriendlySize(iQuota)
			}) : '')
		;
	}, this);
	
	this.dragover = ko.observable(false);
	
	this.loading = ko.observable(false);
	this.loadedFiles = ko.observable(false);

	this.fileListInfoText = ko.computed(function () {
		var sInfoText = '';
		
		if (this.loading())
		{
			sInfoText = TextUtils.i18n('COREWEBCLIENT/INFO_LOADING');
		}
		else if (this.loadedFiles())
		{
			if (this.collection().length === 0)
			{
				if (this.searchPattern() !== '')
				{
					sInfoText = TextUtils.i18n('%MODULENAME%/INFO_NOTHING_FOUND');
				}
				else
				{
					if (this.currentPath() !== '' || this.bInPopup || this.bPublic)
					{
						sInfoText = TextUtils.i18n('%MODULENAME%/INFO_FOLDER_IS_EMPTY');
					}
					else if (this.bAllowDragNDrop)
					{
						sInfoText = TextUtils.i18n('%MODULENAME%/INFO_DRAGNDROP_FILES_OR_CREATE_FOLDER');
					}
				}
			}
		}
		else if (this.error())
		{
			sInfoText = TextUtils.i18n('%MODULENAME%/ERROR_FILES_NOT_RECEIVED');
		}
		
		return sInfoText;
	}, this);
	
	this.dragAndDropHelperBound = _.bind(this.dragAndDropHelper, this);
	this.bInPopup = !!bPopup;
	this.isCurrentStorageExternal = ko.computed(function () {
		var oStorage = this.getStorageByType(this.storageType());
		return (oStorage && oStorage.isExternal);
	}, this);
	this.timerId = null;
	
	var oParams = {
		'View': this,
		'TemplateName': '%ModuleName%_ItemsView'
	};
	this.itemsViewTemplate = ko.observable(oParams.TemplateName);
	App.broadcastEvent('Files::ChangeItemsView', oParams);
	
	this.addToolbarButtons = ko.observableArray([]);
	
	App.subscribeEvent('Files::ShowList', _.bind(function (oParams) {
		if (oParams.Item)
		{
			this.routeFiles(oParams.Item.storageType(), oParams.Item.fullPath());
		}
	}, this));
	App.broadcastEvent('%ModuleName%::ConstructView::after', {'Name': this.ViewConstructorName, 'View': this});
}

_.extendOwn(CFilesView.prototype, CAbstractScreenView.prototype);

CFilesView.prototype.ViewTemplate = App.isPublic() ? '%ModuleName%_PublicFilesView' : '%ModuleName%_FilesView';
CFilesView.prototype.ViewConstructorName = 'CFilesView';

/**
 * @param {object} $popupDom
 */
CFilesView.prototype.onBind = function ($popupDom)
{
	var $dom = this.$viewDom || $popupDom;
	this.selector.initOnApplyBindings(
		'.items_sub_list .item',
		'.items_sub_list .selected.item',
		'.items_sub_list .item .custom_checkbox',
		$('.panel.files .items_list', $dom),
		$('.panel.files .items_list .files_scroll.scroll-inner', $dom)
	);
	
	this.initUploader();

	this.hotKeysBind();
};

CFilesView.prototype.hotKeysBind = function ()
{
	$(document).on('keydown', _.bind(function(ev) {
		if (this.shown() && ev && ev.keyCode === Enums.Key.s && this.selector.useKeyboardKeys() && !Utils.isTextFieldFocused())
		{
			ev.preventDefault();
			this.isSearchFocused(true);
		}
	}, this));
};

/**
 * Initializes file uploader.
 */
CFilesView.prototype.initUploader = function ()
{
	var self = this;
	
	if (!this.bPublic && this.uploaderButton() && this.uploaderArea())
	{
		this.oJua = new CJua({
			'action': '?/Api/',
			'name': 'jua-uploader',
			'queueSize': 2,
			'clickElement': this.uploaderButton(),
			'hiddenElementsPosition': UserSettings.IsRTL ? 'right' : 'left',
			'dragAndDropElement': this.uploaderArea(),
			'disableAjaxUpload': false,
			'disableFolderDragAndDrop': false,
			'disableDragAndDrop': false,
			'hidden': _.extendOwn({
				'Module': Settings.ServerModuleName,
				'Method': 'UploadFile',
				'Parameters':  function (oFile) {
					return JSON.stringify({
						'Type': self.storageType(),
						'SubPath': oFile && oFile.Folder || '',
						'Path': self.dropPath()
					});
				}
			}, App.getCommonRequestParameters())
		});

		this.oJua
			.on('onProgress', _.bind(this.onFileUploadProgress, this))
			.on('onSelect', _.bind(this.onFileUploadSelect, this))
			.on('onStart', _.bind(this.onFileUploadStart, this))
			.on('onDrop', _.bind(this.onDrop, this))
			.on('onComplete', _.bind(this.onFileUploadComplete, this))
			.on('onBodyDragEnter', _.bind(this.bDragActive, this, true))
			.on('onBodyDragLeave', _.bind(this.bDragActive, this, false))
			.on('onCancel', _.bind(this.onCancelUpload, this))
		;
		
		this.bAllowDragNDrop = this.oJua.isDragAndDropSupported();
	}
};

/**
 * Creates new attachment for upload.
 *
 * @param {string} sFileUid
 * @param {Object} oFileData
 */
CFilesView.prototype.onFileUploadSelect = function (sFileUid, oFileData)
{
	if (Settings.UploadSizeLimitMb > 0 && oFileData.Size/(1024*1024) > Settings.UploadSizeLimitMb)
	{
		Popups.showPopup(AlertPopup, [
			TextUtils.i18n('%MODULENAME%/ERROR_SIZE_LIMIT', {'FILENAME': oFileData.FileName, 'SIZE': Settings.UploadSizeLimitMb})
		]);
		return false;
	}
	
	if (this.storageType() === Enums.FileStorageType.Personal && Types.isPositiveNumber(this.quota()))
	{
		if (this.quota() > 0 && this.used() + oFileData.Size > this.quota())
		{
			Popups.showPopup(AlertPopup, [
				TextUtils.i18n('COREWEBCLIENT/ERROR_CANT_UPLOAD_FILE_QUOTA')
			]);
			return false;
		}
	}
	
	if (this.searchPattern() === '')
	{
		var 
			oData = CFileModel.prepareUploadFileData(oFileData, this.currentPath(), this.storageType(), _.bind(function (sFileName) {
				if (this.getFileByName(sFileName))
				{
					return true;
				}
				else
				{
					return !!_.find(this.getUploadingFiles(), function (oItem) {
						return oItem.fileName() === sFileName;
					});
				}
			}, this)),
			oFile = new CFileModel(oData)
		;
		oFile.onUploadSelect(sFileUid, oFileData, true);
		this.uploadingFiles.push(oFile);
	}
};

/**
 * Finds attachment by uid. Calls it's function to start upload.
 *
 * @param {string} sFileUid
 */
CFilesView.prototype.onFileUploadStart = function (sFileUid)
{
	var oFile = this.getUploadFileByUid(sFileUid);

	if (oFile)
	{
		oFile.onUploadStart();
	}
};

/**
 * Finds attachment by uid. Calls it's function to progress upload.
 *
 * @param {string} sFileUid
 * @param {number} iUploadedSize
 * @param {number} iTotalSize
 */
CFilesView.prototype.onFileUploadProgress = function (sFileUid, iUploadedSize, iTotalSize)
{
	if (this.searchPattern() === '')
	{
		var oFile = this.getUploadFileByUid(sFileUid);

		if (oFile)
		{
			oFile.onUploadProgress(iUploadedSize, iTotalSize);
		}
	}
};

/**
 * Finds attachment by uid. Calls it's function to complete upload.
 *
 * @param {string} sFileUid File identifier.
 * @param {boolean} bResponseReceived Indicates if upload was successfull.
 * @param {Object} oResult Response from the server.
 */
CFilesView.prototype.onFileUploadComplete = function (sFileUid, bResponseReceived, oResult)
{
	if (this.searchPattern() === '')
	{
		var
			oFile = this.getUploadFileByUid(sFileUid),
			bRequestFiles = false
		;
		
		if (oFile)
		{
			oFile.onUploadComplete(sFileUid, bResponseReceived, oResult);
			
			this.deleteUploadFileByUid(sFileUid);
			
			if (oFile.uploadError())
			{
				this.uploadError(true);
				if (oResult && oResult.ErrorCode === Enums.Errors.CanNotUploadFileQuota)
				{
					Popups.showPopup(AlertPopup, [TextUtils.i18n('COREWEBCLIENT/ERROR_CANT_UPLOAD_FILE_QUOTA')]);
				}
				else if (oResult && oResult.ErrorCode === Enums.Errors.FileAlreadyExists)
				{
					bRequestFiles = true;
					Screens.showError(TextUtils.i18n('COREWEBCLIENT/ERROR_FILE_ALREADY_EXISTS'));
				}
				else if (oResult && oResult.ErrorCode === Enums.Errors.FileNotFound)
				{
					bRequestFiles = true;
					Screens.showError(TextUtils.i18n('COREWEBCLIENT/ERROR_FILE_NOT_FOUND'));
				}
				else
				{
					Screens.showError(oFile.statusText());
				}
			}
			else
			{
				this.files.push(oFile);
				if (this.uploadingFiles().length === 0)
				{
					Screens.showReport(TextUtils.i18n('COREWEBCLIENT/REPORT_UPLOAD_COMPLETE'));
					bRequestFiles = true;
				}
			}
		}
		else
		{
			bRequestFiles = true;
		}
		
		if (bRequestFiles)
		{
			this.routeFiles(this.storageType(), this.currentPath(), this.searchPattern(), true);
		}
	}
};

/**
 * @param {Object} oFile
 * @param {Object} oEvent
 */
CFilesView.prototype.onDrop = function (oFile, oEvent)
{
	if (this.bPublic)
	{
		return;
	}
		
	if (oEvent && oEvent.target && this.searchPattern() === '')
	{
		var oFolder = ko.dataFor(oEvent.target);
		if (oFolder && oFolder instanceof CFolderModel)
		{
			this.dropPath(oFolder.fullPath());
		}
	}
	else
	{
		Screens.showReport(TextUtils.i18n('%MODULENAME%/INFO_CANNOT_UPLOAD_SEARCH_RESULT'));
	}
};

/**
 * @param {Object} oFolder
 * @param {Object} oEvent
 * @param {Object} oUi
 */
CFilesView.prototype.filesDrop = function (oFolder, oEvent, oUi)
{
	if (oEvent)
	{
		var
			aChecked = this.selector.listCheckedAndSelected(),
			sMethod = oEvent.ctrlKey ? 'Copy' : 'Move'
		;
		
		if (this.moveItems(sMethod, oFolder, aChecked))
		{
			Utils.uiDropHelperAnim(oEvent, oUi);
		}
	}
};

/**
 * @param {string} sMethod
 * @param {object} oFolder
 * @param {array} aChecked
 * @returns {boolean}
 */
CFilesView.prototype.moveItems = function (sMethod, oFolder, aChecked)
{
	if (this.bPublic)
	{
		return false;
	}
	
	var
		sFromPath = '',
		sFromStorageType = '',
		bFromAllSame = true,
		bFolderIntoItself = false,
		sToPath = oFolder instanceof CFolderModel ? oFolder.fullPath() : '',
		aItems = [],
		sStorageType = oFolder ? (oFolder instanceof CFolderModel ? oFolder.storageType() : oFolder.type) : this.storageType(),
		oToStorage = this.getStorageByType(sStorageType),
		oFromStorage = this.getStorageByType(this.storageType()),
		bSameStorage = oToStorage.type === oFromStorage.type,
		iUsed = this.used(),
		iQuota = this.quota(),
		bAllowMove = true
	;
	
	if (bSameStorage || !bSameStorage && !oToStorage.isExternal && !oFromStorage.isExternal)
	{
		if (oToStorage.type === Enums.FileStorageType.Personal)
		{
			bAllowMove = _.every(aChecked, function (oItem) {
				if (oItem instanceof CFileModel)
				{
					if (iQuota > 0 && iUsed + oItem.size() > iQuota)
					{
						return false;
					}
					iUsed = iUsed + oItem.size();
				}
				return true;
			});

			if (!bAllowMove)
			{
				Popups.showPopup(AlertPopup, [TextUtils.i18n('%MODULENAME%/ERROR_CANT_MOVE_FILES_QUOTA_PLURAL', {}, '', aChecked.length)]);
				return false;
			}
		}
		
		_.each(aChecked, _.bind(function (oItem) {
			if (sFromPath !== '' && sFromPath !== oItem.path() || sFromStorageType !== '' && sFromStorageType !== oItem.storageType())
			{
				bFromAllSame = false;
			}
			sFromPath = oItem.path();
			sFromStorageType = oItem.storageType();
			bFolderIntoItself = oItem instanceof CFolderModel && sToPath === sFromPath + '/' + oItem.id();
			if (!bFolderIntoItself)
			{
				if (sMethod === 'Move')
				{
					if (oItem instanceof CFileModel)
					{
						this.deleteFileByName(oItem.id());
					}
					else
					{
						this.deleteFolderByName(oItem.fileName());
					}
				}
				aItems.push({
					'FromType': sFromStorageType,
					'FromPath': sFromPath,
					'Name':  oItem.id(),
					'IsFolder': oItem instanceof CFolderModel
				});
			}
		}, this));
		
		if (aItems.length > 0)
		{
			if (!bFromAllSame)
			{
				sFromStorageType = '';
				sFromPath = '';
			}
			Ajax.send(sMethod, {
				'FromType': sFromStorageType,
				'ToType': sStorageType,
				'FromPath': sFromPath,
				'ToPath': sToPath,
				'Files': aItems
			}, this.onMoveResponse, this);

			if (oFolder instanceof CFolderModel)
			{
				oFolder.recivedAnim(true);
			}

			return true;
		}
	}

	return false;
};

/**
 * @param {Object} oResponse
 * @param {Object} oRequest
 */
CFilesView.prototype.onMoveResponse = function (oResponse, oRequest)
{
	if (!oResponse.Result)
	{
		if (oResponse.ErrorCode === Enums.Errors.CanNotUploadFileQuota)
		{
			Popups.showPopup(AlertPopup, [TextUtils.i18n('%MODULENAME%/ERROR_CANT_MOVE_FILES_QUOTA_PLURAL', {}, '', oRequest.Parameters.Files.length)]);
		}
		else
		{
			Api.showErrorByCode(oResponse, TextUtils.i18n('%MODULENAME%/ERROR_FILES_MOVE_PLURAL', {}, '', oRequest.Parameters.Files.length));
		}
		this.routeFiles(this.storageType(), this.currentPath(), this.searchPattern());
	}
	else
	{
		if (this.storageType() === oRequest.Parameters.ToType && this.currentPath() === oRequest.Parameters.ToPath)
		{
			this.routeFiles(this.storageType(), this.currentPath(), this.searchPattern());
		}
		else
		{
			this.getQuota();
		}
	}
};

/**
 * @param {Object} oFile
 */
CFilesView.prototype.dragAndDropHelper = function (oFile)
{
	if (oFile)
	{
		oFile.checked(true);
	}

	var
		oHelper = Utils.draggableItems(),
		aItems = this.selector.listCheckedAndSelected(),
		nCount = aItems.length,
		nFilesCount = 0,
		nFoldersCount = 0,
		sText = '';
	
	_.each(aItems, function (oItem) {
		if (oItem instanceof CFolderModel)
		{
			nFoldersCount++;
		}
		else
		{
			nFilesCount++;
		}

	}, this);
	
	if (nFilesCount !== 0 && nFoldersCount !== 0)
	{
		sText = TextUtils.i18n('%MODULENAME%/LABEL_DRAG_ITEMS_PLURAL', {'COUNT': nCount}, null, nCount);
	}
	else if (nFilesCount === 0)
	{
		sText = TextUtils.i18n('%MODULENAME%/LABEL_DRAG_FOLDERS_PLURAL', {'COUNT': nFoldersCount}, null, nFoldersCount);
	}
	else if (nFoldersCount === 0)
	{
		sText = TextUtils.i18n('%MODULENAME%/LABEL_DRAG_FILES_PLURAL', {'COUNT': nFilesCount}, null, nFilesCount);
	}
	
	$('.count-text', oHelper).text(sText);

	return oHelper;
};

CFilesView.prototype.onItemDelete = function ()
{
	var 
		aItems = this.selector.listCheckedAndSelected(),
		bAllow = aItems.every(function (oItem)  {
			return !(oItem.uploaded !== undefined && oItem.uploaded() === false || oItem.downloading !== undefined && oItem.downloading() === true);
		})
	;
	if (0 < aItems.length && bAllow)
	{
		this.executeDelete();
	}
};

/**
 * @param {CFileModel|CFolderModel} oItem
 */
CFilesView.prototype.onEnter = function (oItem)
{
	this.onItemDblClick(oItem);
};

/**
 * Executes on item double click.
 * @param {CFileModel|CFolderModel} oItem
 */
CFilesView.prototype.onItemDblClick = function (oItem)
{
	if (oItem)
	{
		var sMainAction = oItem.getMainAction();
		switch (sMainAction)
		{
			case 'view':
				if (oItem instanceof CFileModel)
				{
					if (this.onSelectClickPopupBound)
					{
						this.onSelectClickPopupBound();
					}
					else
					{
						oItem.executeAction(sMainAction);
					}
				}
				break;
			case 'list':
				this.routeFiles(oItem.storageType(), oItem.fullPath());
				break;
		}
	}
};

/**
 * @param {Object} oResponse
 * @param {Object} oRequest
 */
CFilesView.prototype.onGetFilesResponse = function (oResponse, oRequest)
{
	var
		oResult = oResponse.Result,
		oParameters = oRequest.Parameters
	;

	if ((oParameters.Type === this.storageType() || oParameters.Hash === Settings.PublicHash) && oParameters.Path === this.currentPath())
	{
		if (oResult)
		{
			var
				aNewFolderList = [],
				aNewFileList = []
			;

			_.each(oResult.Items, function (oData) {
				if (oData.IsFolder)
				{
					var oFolder = new CFolderModel();
					oFolder.parse(oData);
					aNewFolderList.push(oFolder);
				}
				else
				{
					var oFile = new CFileModel(oData, this.bInPopup);

					if (oFile.oExtendedProps.Loading)
					{ // if file still loading - show warning in status
						oFile.uploadError(true);
						oFile.statusText(TextUtils.i18n('COREWEBCLIENT/LABEL_FILE_LOADING'));
					}
					oFile.index(aNewFileList.length);
					aNewFileList.push(oFile);
				}
			}, this);
			
			// save status of files that are being loaded
			_.each(this.files(), function (oTmpFile, iFileIndex, aFiles) {
				if (oTmpFile.downloading())
				{
					var iNewIndex = _.findIndex(aNewFileList, function (oNewTmpFile) {
						return oTmpFile.fileName() === oNewTmpFile.fileName();
					});
					if (iNewIndex !== -1)
					{
						aFiles[iFileIndex].index(aNewFileList[iNewIndex].index());
						aNewFileList[iNewIndex] = aFiles[iFileIndex];
					}
				}
			});

			this.folders(aNewFolderList);
			this.files(aNewFileList);

			this.newSearchPattern(oParameters.Pattern || '');
			this.searchPattern(oParameters.Pattern || '');

			this.loading(false);
			this.loadedFiles(true);
			clearTimeout(this.timerId);

			this.parseQuota(oResult.Quota);
			
			if (_.isArray(oResult.Path))
			{
				this.pathItems.removeAll();
				_.each(oResult.Path.reverse(), _.bind(function (oPathItem) {
					var oFolder = new CFolderModel();
					oFolder.parse(oPathItem);
					this.pathItems.push(oFolder);
				}, this));
			}
		}
		else
		{
			this.loading(false);
			if (oResponse.ErrorCode !== Enums.Errors.NotDisplayedError)
			{
				this.error(true);
			}
		}
	}
};

/**
 * Runs after getting quota information from the server. Fill quota values.
 * 
 * @param {Object} oQuota
 */
CFilesView.prototype.parseQuota = function (oQuota)
{
	if (oQuota)
	{
		this.quota(oQuota.Limit);
		this.used(oQuota.Used);
	}
};

/**
 * @param {Object} oResponse
 * @param {Object} oRequest
 */
CFilesView.prototype.onDeleteResponse = function (oResponse, oRequest)
{
	if (oResponse.Result)
	{
		this.expungeFileItems();
		this.getQuota();
	}
	else
	{
		this.routeFiles(this.storageType(), this.currentPath(), this.searchPattern());
	}
};

CFilesView.prototype.executeRename = function ()
{
	var oItem = _.first(this.selector.listCheckedAndSelected());
	if (!this.bPublic && oItem)
	{
		Popups.showPopup(RenamePopup, [oItem.fileName(), _.bind(this.renameItem, this)]);
	}
};

/**
 * @param {string} sName
 * @returns {string}
 */
CFilesView.prototype.renameItem = function (sName)
{
	var oItem = _.first(this.selector.listCheckedAndSelected());
	
	if (!Utils.validateFileOrFolderName(sName))
	{
		return oItem instanceof CFolderModel ?
			TextUtils.i18n('%MODULENAME%/ERROR_INVALID_FOLDER_NAME') : TextUtils.i18n('%MODULENAME%/ERROR_INVALID_FILE_NAME');
	}
	else
	{
		Ajax.send('Rename', {
				'Type': oItem.storageType(),
				'Path': oItem.path(),
				'Name': oItem.id(),
				'NewName': sName,
				'IsLink': oItem.bIsLink ? 1 : 0
			}, this.onRenameResponse, this
		);
	}
	
	return '';
};

CFilesView.prototype.getFileIfOnlyOneSelected = function ()
{
	var aItems = this.selector.listCheckedAndSelected();
	return (1 === aItems.length && aItems[0] instanceof CFileModel) ? aItems[0] : null;
};

CFilesView.prototype.executeDownload = function ()
{
	var oFile = this.getFileIfOnlyOneSelected();
	if (oFile)
	{
		oFile.executeAction('download');
	}
};

CFilesView.prototype.executeShare = function ()
{
	var oItem = _.first(this.selector.listCheckedAndSelected());
	
	if (!this.bPublic && oItem)
	{
		Popups.showPopup(SharePopup, [oItem]);
	}
};

CFilesView.prototype.executeSend = function ()
{
	var
		aItems = this.selector.listCheckedAndSelected(),
		aFileItems = _.filter(aItems, function (oItem) {
			return oItem instanceof CFileModel;
		}, this),
		aFilesData = _.map(aFileItems, function (oItem) {
			return {
				'Storage': oItem.storageType(),
				'Path': oItem.path(),
				'Name': oItem.fileName()
			};
		})
	;
	
	if (this.bAllowSendEmails && aFileItems.length > 0)
	{
		Ajax.send('SaveFilesAsTempFiles', { 'Files': aFilesData }, function (oResponse) {
			if (oResponse.Result)
			{
				ComposeMessageWithAttachments(oResponse.Result);
			}
		}, this);
	}
};

/**
 * @param {Object} oItem
 */
CFilesView.prototype.onShareIconClick = function (oItem)
{
	if (oItem)
	{
		Popups.showPopup(SharePopup, [oItem]);
	}
};

/**
 * @param {Object} oResponse
 * @param {Object} oRequest
 */
CFilesView.prototype.onRenameResponse = function (oResponse, oRequest)
{
	if (!oResponse.Result)
	{
		Api.showErrorByCode(oResponse, TextUtils.i18n('%MODULENAME%/ERROR_FILE_RENAME'));
	}
	
	this.routeFiles(this.storageType(), this.currentPath(), this.searchPattern(), true);
};


CFilesView.prototype.executeDelete = function ()
{
	var aChecked = this.selector.listCheckedAndSelected();
	
	if (!this.bPublic && aChecked && aChecked.length > 0)
	{
		Popups.showPopup(ConfirmPopup, [TextUtils.i18n('COREWEBCLIENT/CONFIRM_ARE_YOU_SURE'), _.bind(this.deleteItems, this, aChecked)]);
	}
};

CFilesView.prototype.onShow = function ()
{
	this.loaded(true);
	
	if (this.bPublic || this.bInPopup)
	{
		this.routeFiles(this.storageType(), this.currentPath());
	}
	else
	{
		this.requestStorages();
	}

	this.selector.useKeyboardKeys(true);

	if (this.oJua)
	{
		this.oJua.setDragAndDropEnabledStatus(true);
	}
};

CFilesView.prototype.onHide = function ()
{
	this.selector.useKeyboardKeys(false);
	if (this.oJua)
	{
		this.oJua.setDragAndDropEnabledStatus(false);
	}
};

CFilesView.prototype.getQuota = function ()
{
	Ajax.send('GetQuota', {}, function (oResponse) {
			if (oResponse.Result)
			{
				this.parseQuota(oResponse.Result);
			}
		}, this
	);
};

/**
 * @param {string} sStorageType
 */
CFilesView.prototype.getStorageByType = function (sStorageType)
{
	return _.find(this.storages(), function (oStorage) { 
		return oStorage.type === sStorageType; 
	});	
};

/**
 * Requests storages from the server.
 */
CFilesView.prototype.requestStorages = function ()
{
	Ajax.send('GetStorages', null, this.onGetStoragesResponse, this);
};

/**
 * Parses server response to a request of storages.
 * @param {Object} oResponse
 * @param {Object} oRequest
 */
CFilesView.prototype.onGetStoragesResponse = function (oResponse, oRequest)
{
	var oResult = oResponse.Result;
	if (oResult)
	{
		_.each(oResult, function(oStorage) {
			if (oStorage.Type && !this.getStorageByType(oStorage.Type))
			{
				this.storages.push({
					isExternal: oStorage.IsExternal,
					type: oStorage.Type,
					displayName: oStorage.DisplayName
				});
			}
		}, this);
		
		this.expungeExternalStorages(_.map(oResult, function(oStorage){
			return oStorage.Type;
		}, this));
	}
	if (!this.getStorageByType(this.storageType()))
	{
		this.storageType(Enums.FileStorageType.Personal);
		this.pathItems.removeAll();
	}
	
	this.routeFiles(this.storageType(), this.currentPath(), this.searchPattern(), true);
};

/**
 * Clears file/folder list and displays loading message.
 */
CFilesView.prototype.showLoading = function ()
{
	this.folders([]);
	this.files([]);
	this.loading(true);
};

/**
 * Sets routing hash.
 * @param {string} sStorage Storage type.
 * @param {string=} sFullPath = '' Path to files/folders to display.
 * @param {string=} sSearch = '' Search string.
 * @param {boolean=} bNotLoading = false Indicates if loading message should be displayed with delay.
 */
CFilesView.prototype.routeFiles = function (sStorage, sFullPath, sSearch, bNotLoading)
{
	var bSame = false;
	
	if (this.bPublic)
	{
		bSame = Routing.setHash(LinksUtils.getFiles('', sFullPath, ''));
		if (bSame)
		{
			this.showLoading();
			Ajax.send('GetPublicFiles', {
					'Hash': Settings.PublicHash,
					'Path': this.currentPath()
				}, this.onGetFilesResponse, this
			);
		}
	}
	else
	{
		this.bNotLoading = bNotLoading;
		bSame = Routing.setHash(LinksUtils.getFiles(sStorage, sFullPath, sSearch));
		if (bSame)
		{
			this.showLoading();
			Ajax.send('GetFiles', {
					'Type': this.storageType(),
					'Path': this.currentPath(),
					'Pattern': this.searchPattern()
				}, this.onGetFilesResponse, this
			);
		}
	}
};

/**
 * Adds path item to path item list.
 * @param {string} sStorage Storage type.
 * @param {string} sPath Path of item.
 * @param {string} sName Name of item.
 */
CFilesView.prototype.addPathItems = function (sStorage, sPath, sName)
{
	var oFolder = new CFolderModel();
	oFolder.storageType(sStorage);
	oFolder.displayName(sName);
	oFolder.fileName(sName);
	oFolder.path(sPath);
	oFolder.fullPath(sPath);
	this.pathItems.unshift(oFolder);
};

/**
 * Requests files after routing parse.
 * @param {array} aParams
 */
CFilesView.prototype.onRoute = function (aParams)
{
	var oParams = LinksUtils.parseFiles(aParams);

	if (App.isPublic())
	{
		this.onPublicRoute(oParams);
	}
	else
	{
		this.onUserRoute(oParams);
	}
};

/**
 * Requests user files after routing parse.
 * @param {object} oParams
 */
CFilesView.prototype.onUserRoute = function (oParams)
{
	var
		sPath = oParams.Path,
		aPath = oParams.PathParts.reverse()
	;
	
	this.error(false);
	
	this.storageType(oParams.Storage);
	this.currentPath(sPath);
	this.loadedFiles(false);
	
	if (oParams.Storage !== 'google' || sPath === '')
	{
		this.pathItems.removeAll();
		_.each(aPath, _.bind(function (sPathItem) {
			var iItemPos = sPath.lastIndexOf(sPathItem);
			this.addPathItems(oParams.Storage, sPath, sPathItem);
			sPath = sPath.substr(0, iItemPos);
		}, this));
	}
	
	if (this.bNotLoading && (this.files().length > 0 || this.folders().length > 0))
	{
		this.timerId = setTimeout(_.bind(function() {
			if (!this.loadedFiles() && !this.error())
			{
				this.showLoading();
			}
		}, this), 3000);				
	}
	else
	{
		this.showLoading();
	}
	
	Ajax.send('GetFiles', {
			'Type': oParams.Storage,
			'Path': oParams.Path,
			'Pattern': Types.pString(oParams.Search)
		}, this.onGetFilesResponse, this
	);
};

/**
 * Requests public files after routing parse.
 * @param {object} oParams
 */
CFilesView.prototype.onPublicRoute = function (oParams)
{
	var 
		sPath = oParams.Path,
		aPath = oParams.PathParts.reverse(),
		sFirstPathItem = ''
	;
	
	this.currentPath(sPath);
	
	this.pathItems.removeAll();
	_.each(aPath, _.bind(function (sPathItem) {
		var iItemPos = sPath.lastIndexOf(sPathItem);
		this.addPathItems(oParams.Storage, sPath, sPathItem);
		sPath = sPath.substr(0, iItemPos);
		sFirstPathItem = sPathItem;
	}, this));
	if (sFirstPathItem !== this.rootPath())
	{
		this.addPathItems(oParams.Storage, '', this.rootPath());
	}
	
	this.showLoading();
	
	Ajax.send('GetPublicFiles', {
			'Hash': Settings.PublicHash,
			'Path': this.currentPath()
		}, this.onGetFilesResponse, this
	);
};

/**
 * @param {Array} aChecked
 * @param {boolean} bOkAnswer
 */
CFilesView.prototype.deleteItems = function (aChecked, bOkAnswer)
{
	var 
		sStorageType = this.storageType(),
		sPath = this.currentPath()
	;
	if (bOkAnswer && 0 < aChecked.length)
	{
		var aItems = _.compact(_.map(aChecked, function (oItem) {
			if (oItem.id() !== '')
			{
				oItem.deleted(true);
				sStorageType = oItem.storageType();
				sPath = oItem.path();
				return {
					'Path': oItem.path(),  
					'Name': oItem.id()
				};
			}
			return null;
		}));
		if (aItems.length)
		{
			Ajax.send('Delete', {
					'Type': sStorageType,
					'Path': sPath,
					'Items': aItems
				}, this.onDeleteResponse, this
			);
		}
	}		
};

/**
 * @param {string} sName
 * 
 * @return {?}
 */
CFilesView.prototype.getFileByName = function (sName)
{
	return _.find(this.files(), function (oItem) {
		return oItem.fileName() === sName;
	});	
};

/**
 * @param {string} sName
 */
CFilesView.prototype.deleteFileByName = function (sName)
{
	this.files(_.filter(this.files(), function (oItem) {
		return oItem.id() !== sName;
	}));
};

/**
 * @param {string} sName
 */
CFilesView.prototype.deleteFolderByName = function (sName)
{
	this.folders(_.filter(this.folders(), function (oItem) {
		return oItem.fileName() !== sName;
	}));
};

CFilesView.prototype.expungeFileItems = function ()
{
	this.folders(_.filter(this.folders(), function (oFolder) {
		return !oFolder.deleted();
	}, this));
	this.files(_.filter(this.files(), function (oFile) {
		return !oFile.deleted();
	}, this));
};

/**
 * @param {array} aStorageTypes
 */
CFilesView.prototype.expungeExternalStorages = function (aStorageTypes)
{
	this.storages(_.filter(this.storages(), function (oStorage) {
		return !oStorage.isExternal || _.include(aStorageTypes, oStorage.type);
	},this));
};

/**
 * @param {string} sFileUid
 * 
 * @return {?}
 */
CFilesView.prototype.getUploadFileByUid = function (sFileUid)
{
	return _.find(this.uploadingFiles(), function(oItem){
		return oItem.uploadUid() === sFileUid;
	});	
};

/**
 * @param {string} sFileUid
 */
CFilesView.prototype.deleteUploadFileByUid = function (sFileUid)
{
	this.uploadingFiles(_.filter(this.uploadingFiles(), function (oItem) {
		return oItem.uploadUid() !== sFileUid;
	}));
};

/**
 * @return {Array}
 */
CFilesView.prototype.getUploadingFiles = function ()
{
	return _.filter(this.uploadingFiles(), _.bind(function (oItem) {
		return oItem.path() === this.currentPath() && oItem.storageType() === this.storageType();
	}, this));	
};

/**
 * @param {string} sFileUid
 */
CFilesView.prototype.onCancelUpload = function (sFileUid)
{
	if (this.oJua)
	{
		this.oJua.cancel(sFileUid);
	}
	this.deleteUploadFileByUid(sFileUid);
};

/**
 * @param {Object} oResponse
 * @param {Object} oRequest
 */
CFilesView.prototype.onCreateFolderResponse = function (oResponse, oRequest)
{
	this.routeFiles(this.storageType(), this.currentPath(), this.searchPattern(), true);
};

/**
 * @param {string} sFolderName
 */
CFilesView.prototype.createFolder = function (sFolderName)
{
	sFolderName = $.trim(sFolderName);
	if (!Utils.validateFileOrFolderName(sFolderName))
	{
		return TextUtils.i18n('%MODULENAME%/ERROR_INVALID_FOLDER_NAME');
	}
	else
	{
		Ajax.send('CreateFolder', {
				'Type': this.storageType(),
				'Path': this.currentPath(),
				'FolderName': sFolderName
			}, this.onCreateFolderResponse, this
		);
	}

	return '';
};

CFilesView.prototype.onCreateFolderClick = function ()
{
	Popups.showPopup(CreateFolderPopup, [_.bind(this.createFolder, this)]);
};

/**
 * @param {Object} oResponse
 * @param {Object} oRequest
 */
CFilesView.prototype.onCreateLinkResponse = function (oResponse, oRequest)
{
	this.routeFiles(this.storageType(), this.currentPath(), this.searchPattern(), true);
};

/**
 * @param {Object} oFileItem
 */
CFilesView.prototype.createLink = function (oFileItem)
{
	Ajax.send('CreateLink', {
		'Type': this.storageType(),
		'Path': this.currentPath(),
		'Link': oFileItem.sLinkUrl,
		'Name': oFileItem.fileName()
	}, this.onCreateLinkResponse, this);
};

CFilesView.prototype.onCreateLinkClick = function ()
{
	var fCallBack = _.bind(this.createLink, this);

	Popups.showPopup(CreateLinkPopup, [fCallBack]);
	
};


CFilesView.prototype.onSearch = function ()
{
	this.routeFiles(this.storageType(), this.currentPath(), this.newSearchPattern());
};

CFilesView.prototype.clearSearch = function ()
{
	this.routeFiles(this.storageType(), this.currentPath());
};

CFilesView.prototype.getCurrentFolder = function ()
{
	var oFolder = new CFolderModel();
	oFolder.fullPath(this.currentPath());
	oFolder.storageType(this.storageType());
	return oFolder;
};

CFilesView.prototype.registerToolbarButtons = function (aToolbarButtons)
{
	if (Types.isNonEmptyArray(aToolbarButtons))
	{
		_.each(aToolbarButtons, _.bind(function (oToolbarButtons) {
			if (_.isFunction(oToolbarButtons.useFilesViewData))
			{
				oToolbarButtons.useFilesViewData(this);
			}
		}, this));
		this.addToolbarButtons(_.union(this.addToolbarButtons(), aToolbarButtons));
	}
};

CFilesView.prototype.onFileRemove = function (sFileUploadUid, oFile)
{
	var 
		/**
		 * Send request for deleting file with sFileName
		 * @param {String} sFileUploadUid
		 * @param {String} sFileName
		 */
		fOnUploadCancelCallback = _.bind(function (sFileUploadUid, sFileName) {
			var aItems = [];
			aItems.push({
				'Path': this.currentPath(),  
				'Name': sFileName
			});
			Ajax.send('Delete', {
					'Type': this.storageType(),
					'Path': this.currentPath(),
					'Items': aItems
				}
			);
			this.deleteUploadFileByUid(sFileUploadUid);
		}, this)
	;
	if (oFile.downloading())
	{
		App.broadcastEvent('CFilseView::FileDownloadCancel', {oFile: oFile});
	}
	else if (!oFile.uploaded() && sFileUploadUid)
	{
		App.broadcastEvent('CFilseView::FileUploadCancel', {sFileUploadUid: sFileUploadUid, fOnUploadCancelCallback: fOnUploadCancelCallback});	
	}
};

module.exports = CFilesView;
