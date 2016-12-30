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
	
	Ajax = require('modules/%ModuleName%/js/Ajax.js'),
	Settings = require('modules/%ModuleName%/js/Settings.js'),
	
	CFileModel = require('modules/%ModuleName%/js/models/CFileModel.js'),
	CFolderModel = require('modules/%ModuleName%/js/models/CFolderModel.js')
;

/**
* @constructor
* @param {boolean=} bPopup = false
*/
function CFilesView(bPopup)
{
	CAbstractScreenView.call(this, '%ModuleName%');
	
	this.browserTitle = ko.observable(TextUtils.i18n('%MODULENAME%/HEADING_BROWSER_TAB'));
	
	this.allowSendEmails = ko.computed(function () {
		return false;//!!(AppData.App && AppData.App.AllowWebMail && AppData.Accounts && AppData.Accounts.isCurrentAllowsMail());
	}, this);
	
	this.error = ko.observable(false);
	this.loaded = ko.observable(false);
	this.isPublic = App.isPublic();
	
	this.sPublicHash = Settings.PublicHash;
	
	this.storages = ko.observableArray();
	this.folders = ko.observableArray();
	this.files = ko.observableArray();
	this.uploadingFiles = ko.observableArray();

	this.rootPath = ko.observable(this.isPublic ? Settings.PublicFolderName : TextUtils.i18n('%MODULENAME%/LABEL_PERSONAL_STORAGE'));
	this.storageType = ko.observable(Enums.FileStorageType.Personal);
	this.storageType.subscribe(function () {
		if (this.isPublic)
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
			this.selector.listCheckedAndSelected(false);
		}
	}, this);
	
	this.iPathIndex = ko.observable(-1);
	this.pathItems = ko.observableArray();
	this.dropPath = ko.observable('');
	this.path = ko.computed(function () {
		var aPath = _.map(this.pathItems(), function (oItem) {
			return oItem.id();
		});
		return aPath.join('/');
	}, this);

	this.path.subscribe(function (value) {
		this.dropPath(value);
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
		
	this.searchPattern = ko.observable('');
	this.newSearchPattern = ko.observable('');
	this.isSearchFocused = ko.observable(false);

	this.renameCommand = Utils.createCommand(this, this.executeRename, function () {
		var items = this.selector.listCheckedAndSelected();
		return (1 === items.length);
	});
	this.deleteCommand = Utils.createCommand(this, this.executeDelete, function () {
		var items = this.selector.listCheckedAndSelected();
		return (0 < items.length);
	});
	this.downloadCommand = Utils.createCommand(this, this.executeDownload, function () {
		var items = this.selector.listCheckedAndSelected();
		return (1 === items.length && items[0] instanceof CFileModel);
	});
	this.shareCommand = Utils.createCommand(this, this.executeShare, function () {
		var items = this.selector.listCheckedAndSelected();
		return (1 === items.length && (!items[0].isLink || !items[0].isLink()));
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
				if (this.isPublic)
				{
					sInfoText = TextUtils.i18n('%MODULENAME%/INFO_PUBLIC_FOLDER_NOT_EXIST');
				}
				else
				{
					if (this.searchPattern() !== '' || this.isPublic)
					{
						sInfoText = TextUtils.i18n('%MODULENAME%/INFO_NOTHING_FOUND');
					}
					else
					{
						if (this.path() !== '' || this.isPopup)
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
		}
		else if (this.error())
		{
			sInfoText = TextUtils.i18n('%MODULENAME%/ERROR_FILES_NOT_RECEIVED');
		}
		
		return sInfoText;
	}, this);
	
	this.dragAndDropHelperBinded = _.bind(this.dragAndDropHelper, this);
	this.isPopup = !!bPopup;
	this.isCurrentStorageExternal = ko.computed(function () {
		var oStorage = this.getStorageByType(this.storageType());
		return (oStorage && oStorage.isExternal);
	}, this);
	this.timerId = null;
	
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
	
	if (this.uploaderButton() && this.uploaderArea())
	{
		this.oJua = new CJua({
			'action': '?/Api/',
			'name': 'jua-uploader',
			'queueSize': 2,
			'clickElement': this.uploaderButton(),
			'hiddenElementsPosition': UserSettings.IsRTL ? 'right' : 'left',
			'dragAndDropElement': this.uploaderArea(),
			'disableAjaxUpload': this.isPublic ? true : false,
			'disableFolderDragAndDrop': this.isPublic ? true : false,
			'disableDragAndDrop': this.isPublic ? true : false,
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
			oFile = new CFileModel(),
			sFileName = oFileData.FileName,
			sFileNameExt = Utils.getFileExtension(sFileName),
			sFileNameWoExt = Utils.getFileNameWithoutExtension(sFileName),
			iIndex = 0
		;
		
		if (sFileNameExt !== '')
		{
			sFileNameExt = '.' + sFileNameExt;
		}

		while (this.getFileByName(sFileName))
		{
			sFileName = sFileNameWoExt + '_' + iIndex + sFileNameExt;
			iIndex++;
		}
		
		oFile.onUploadSelectOwn(sFileUid, oFileData, sFileName, App.currentAccountEmail(), this.path(), this.storageType());
		
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
			oFile = this.getUploadFileByUid(sFileUid)
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
				}
			}
		}

		this.getFiles(this.storageType(), this.getPathItemByIndex(this.iPathIndex()), this.searchPattern(), true);
	}
};

/**
 * @param {Object} oFile
 * @param {Object} oEvent
 */
CFilesView.prototype.onDrop = function (oFile, oEvent)
{
	if (this.isPublic)
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
	if (this.isPublic)
	{
		return;
	}
	
	if (oFolder && oEvent)
	{
		var
			self = this,
			sFromPath = '',
			sFromStorageType = '',
			bFolderIntoItself = false,
			sToPath = oFolder instanceof CFolderModel ? oFolder.fullPath() : '',
			aChecked = [],
			aItems = [],
			sStorageType = oFolder instanceof CFolderModel ? oFolder.storageType() : oFolder.type,
			oToStorage = this.getStorageByType(sStorageType),
			oFromStorage = this.getStorageByType(this.storageType()),
			bSameStorage = oToStorage.type === oFromStorage.type,
			iUsed = this.used(),
			iQuota = this.quota(),
			bAllowMove = true
		;
		
		if (bSameStorage && this.path() !== sToPath || !bSameStorage && !oToStorage.isExternal && !oFromStorage.isExternal)
		{
			if (oFolder instanceof CFolderModel)
			{
				oFolder.recivedAnim(true);
			}
			Utils.uiDropHelperAnim(oEvent, oUi);

			aChecked = this.selector.listCheckedAndSelected();
			
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
					return;
				}
			}
				
			_.each(aChecked, function (oItem) {
				sFromPath = oItem.path();
				sFromStorageType = oItem.storageType();
				bFolderIntoItself = oItem instanceof CFolderModel && sToPath === sFromPath + '/' + oItem.id();
				if (!bFolderIntoItself)
				{
					if (!oEvent.ctrlKey)
					{
						if (oItem instanceof CFileModel)
						{
							self.deleteFileByName(oItem.id());
						}
						else
						{
							self.deleteFolderByName(oItem.fileName());
						}
					}
					aItems.push({
						'Name':  oItem.id(),
						'IsFolder': oItem instanceof CFolderModel
					});
				}
			});
			
			if (aItems.length > 0)
			{
				Ajax.send(oEvent.ctrlKey ? 'Copy' : 'Move', {
					'FromType': sFromStorageType,
					'ToType': sStorageType,
					'FromPath': sFromPath,
					'ToPath': sToPath,
					'Files': aItems
				}, this.onMoveResponse, this);
			}
		}
	}
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
			Popups.showPopup(AlertPopup, [TextUtils.i18n('%MODULENAME%/ERROR_CANT_MOVE_FILES_QUOTA_PLURAL', {}, '', oRequest.Files.length)]);
		}
		else
		{
			Api.showErrorByCode(oResponse, TextUtils.i18n('%MODULENAME%/ERROR_FILES_MOVE_PLURAL', {}, '', oRequest.Files.length));
		}
		this.getFiles(this.storageType(), this.getPathItemByIndex(this.iPathIndex()), this.searchPattern());
	}
	else
	{
		this.getQuota();
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
	this.executeDelete();
};

/**
 * @param {{path:Function,name:Function,isViewable:Function,viewFile:Function,downloadFile:Function}} oItem
 */
CFilesView.prototype.onEnter = function (oItem)
{
	this.onItemDblClick(oItem);
};

/**
 * @param {{path:Function,name:Function,isViewable:Function,viewFile:Function,downloadFile:Function}} oItem
 */
CFilesView.prototype.onItemDblClick = function (oItem)
{
	if (oItem)
	{
		switch (oItem.sMainAction)
		{
			case 'view':
				if (oItem instanceof CFileModel)
				{
					if (oItem.isViewable())
					{
						oItem.viewFile();
					}
					else
					{
						if (this.isPopup)
						{
							if (this.onSelectClickPopupBinded)
							{
								this.onSelectClickPopupBinded();
							}
						}
						else
						{
							oItem.downloadFile();
						}
					}
				}
				break;
			case 'list':
				this.getFiles(this.storageType(), oItem);
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
	
	if (oParameters.Type === this.storageType() && oParameters.Path === this.path())
	{
		if (oResult)
		{
			var
				aFolderList = [],
				aFileList = []
			;

			_.each(oResult.Items, function (oData) {
				if (oData.IsFolder)
				{
					var oFolder = new CFolderModel();
					oFolder.parse(oData);
					aFolderList.push(oFolder);
				}
				else
				{
					var oFile = new CFileModel();
					if (this.sPublicHash) 
					{
						oFile.sPublicHash = this.sPublicHash;
					}
					oFile.parse(oData, this.isPopup);
					aFileList.push(oFile);
				}
			}, this);

			this.folders(aFolderList);
			this.files(aFileList);

			this.newSearchPattern(oParameters.Pattern || '');
			this.searchPattern(oParameters.Pattern || '');

			this.loading(false);
			this.loadedFiles(true);
			clearTimeout(this.timerId);

			this.parseQuota(oResult.Quota);
		}
		else
		{
			this.loading(false);
			this.error(true);
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
		this.getFiles(this.storageType(), this.getPathItemByIndex(this.iPathIndex()), this.searchPattern());
	}
};

CFilesView.prototype.executeRename = function ()
{
	var
		aChecked = this.selector.listCheckedAndSelected(),
		oItem = aChecked[0]
	;
	if (!this.isPublic && oItem)
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
	var
		aChecked = this.selector.listCheckedAndSelected(),
		oItem = aChecked[0]
	;
	
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
				'IsLink': oItem.isLink && oItem.isLink() ? 1 : 0
			}, this.onRenameResponse, this
		);
	}
	
	return '';
};

CFilesView.prototype.executeDownload = function ()
{
	var 
		aChecked = this.selector.listCheckedAndSelected()
	;
	if (aChecked[0] && aChecked[0] instanceof CFileModel)
	{
		aChecked[0].downloadFile();
	}
};

CFilesView.prototype.executeShare = function ()
{
	var 
		aChecked = this.selector.listCheckedAndSelected()
	;
	if (!this.isPublic &&  aChecked[0])
	{
		Popups.showPopup(SharePopup, [aChecked[0]]);
	}
};

CFilesView.prototype.executeSend = function ()
{
	var
		aItems = this.selector.listCheckedAndSelected(),
		aFileItems = _.filter(aItems, function (oItem) {
			return oItem instanceof CFileModel;
		}, this)
	;
	
	if (aFileItems.length > 0)
	{
//		App.Api.composeMessageWithFiles(aFileItems);
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
	this.getFiles(this.storageType(), this.getPathItemByIndex(this.iPathIndex()), this.searchPattern(), true);
};


CFilesView.prototype.executeDelete = function ()
{
	var
		aChecked = this.selector.listCheckedAndSelected()
	;
	if (!this.isPublic && aChecked && aChecked.length > 0)
	{
		Popups.showPopup(ConfirmPopup, [TextUtils.i18n('COREWEBCLIENT/CONFIRM_ARE_YOU_SURE'), _.bind(this.deleteItems, this, aChecked)]);
	}
};

CFilesView.prototype.onShow = function ()
{
	this.loaded(true);
	this.getStorages();

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

CFilesView.prototype.getStorages = function ()
{
	if (!this.isPublic)
	{
		if (!this.isPopup)
		{
			Ajax.send('GetStorages', null, this.onGetStoragesResponse, this);
		}
		else
		{
			this.getFiles(this.storageType(), this.getPathItemByIndex(this.iPathIndex()));
		}
	}
	else
	{
		this.getFiles(this.storageType(), this.getPathItemByIndex(this.iPathIndex()));
	}
};

/**
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
		this.storageType('personal');
		this.pathItems([]);
		this.iPathIndex(-1);
	}
	
	this.getFiles(this.storageType(), this.getPathItemByIndex(this.iPathIndex()), this.searchPattern(), true);
};

/**
 * @param {string} sType
 * @param {object=} oPath = ''
 * @param {string=} sPattern = ''
 * @param {boolean=} bNotLoading = false
 */
CFilesView.prototype.getFiles = function (sType, oPath, sPattern, bNotLoading)
{
	var 
		self = this,
		sTypePrev = this.storageType(),
		iPathIndex = this.iPathIndex(),
		oFolder = new CFolderModel().storageType(sType)
	;
	if (this.isPublic)
	{
		return this.getPublicFiles(oPath);
	}
	this.error(false);
	this.storageType(sType);
	self.loadedFiles(false);
	if (bNotLoading && (this.files().length > 0 || this.folders().length > 0))
	{
		this.timerId = setTimeout(function() {
			if (!self.loadedFiles() && !self.error())
			{
				self.folders([]);
				self.files([]);
				self.loading(true);
			}
		}, 3000);				
	}
	else
	{
		this.folders([]);
		this.files([]);
		this.loading(true);
	}
	
	if (oPath === undefined || oPath.id() === '')
	{
		this.pathItems.removeAll();
		oFolder.displayName(this.rootPath());
	}
	else
	{
		oFolder = oPath;
	}

	this.pathItems.push(oFolder);
	this.iPathIndex(this.pathItems().length - 1);
	
	if (iPathIndex !== this.iPathIndex() || sTypePrev !== this.storageType())
	{
		this.folders([]);
		this.files([]);
	}
	
	Ajax.send('GetFiles', {
			'Type': sType,
			'Path': (oPath !== undefined) ? oPath.fullPath() : this.path(),
			'Pattern': Types.pString(sPattern)
		}, this.onGetFilesResponse, this
	);
};

/**
 * @param {Object} oPath
 */
CFilesView.prototype.getPublicFiles = function (oPath)
{
	var 
		iPathIndex = this.iPathIndex(),
		oFolder = new CFolderModel()
	;
	if (oPath === undefined || oPath.id() === '')
	{
		this.pathItems.removeAll();
		oFolder.displayName(this.rootPath());
	}
	else
	{
		oFolder = oPath;
	}
	
	this.pathItems.push(oFolder);
	
	this.iPathIndex(this.pathItems().length - 1);
	
	if (iPathIndex !== this.iPathIndex())
	{
		this.folders([]);
		this.files([]);
	}
	
	Ajax.send('GetPublicFiles', {
			'Hash': this.sPublicHash,
			'Path': this.path()
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
		sPath =this.path()
	;
	if (bOkAnswer && 0 < aChecked.length)
	{
		var
			aItems = _.map(aChecked, function (oItem) {
				oItem.deleted(true);
				sStorageType = oItem.storageType();
				sPath = oItem.path();
				return {
					'Path': oItem.path(),  
					'Name': oItem.id()
				};
			});
		
		Ajax.send('Delete', {
				'Type': sStorageType,
				'Path': sPath,
				'Items': aItems
			}, this.onDeleteResponse, this
		);
	}		
};

/**
 * @param {number} iIndex
 * 
 * @return {string}
 */
CFilesView.prototype.getPathItemByIndex = function (iIndex)
{
	var 
		oItem = this.pathItems()[iIndex],
		oFolder = new CFolderModel().fileName(this.rootPath()).id('')
	;
	
	this.pathItems(this.pathItems().slice(0, iIndex));
	
	if (oItem && !this.isPublic)
	{
		oFolder = oItem;
	}
	
	return oFolder;
};

/**
 * @param {string} sName
 * 
 * @return {?}
 */
CFilesView.prototype.getFileByName = function (sName)
{
	return _.find(this.files(), function (oItem) {
		return oItem.id() === sName;
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
		return oItem.path() === this.path() && oItem.storageType() === this.storageType();
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
	this.getFiles(this.storageType(), this.getPathItemByIndex(this.iPathIndex()), this.searchPattern(), true);
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
				'Path': this.path(),
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
	this.getFiles(this.storageType(), this.getPathItemByIndex(this.iPathIndex()), this.searchPattern(), true);
};

/**
 * @param {Object} oFileItem
 */
CFilesView.prototype.createLink = function (oFileItem)
{
	Ajax.send('CreateLink', {
		'Type': this.storageType(),
		'Path': this.path(),
		'Link': oFileItem.linkUrl(),
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
	this.getFiles(this.storageType(), this.getPathItemByIndex(this.iPathIndex()), this.newSearchPattern());
};

CFilesView.prototype.clearSearch = function ()
{
	this.getFiles(this.storageType(), this.getPathItemByIndex(this.iPathIndex()));
};

module.exports = CFilesView;
