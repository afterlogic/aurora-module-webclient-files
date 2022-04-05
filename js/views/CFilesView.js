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
	ModulesManager = require('%PathToCoreWebclientModule%/js/ModulesManager.js'),
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
	FilesSharePopup = ModulesManager.run('SharedFiles', 'getFilesSharePopup'),
	
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
	
	this.storages = ko.observableArray([]);
	this.folders = ko.observableArray();
	this.files = ko.observableArray();
	this.uploadingFiles = ko.observableArray();

	this.rootPath = ko.observable(this.bPublic ? Settings.PublicFolderName : TextUtils.i18n('%MODULENAME%/LABEL_PERSONAL_STORAGE'));
	this.storageType = ko.observable(Enums.FileStorageType.Personal);
	this.currentStorage = ko.computed(function () {
		return this.getStorageByType(this.storageType());
	}, this);
	this.storageDroppable = ko.computed(function () {
		return this.currentStorage() ? this.currentStorage().droppable() : '';
	}, this);
	this.storageDisplayName = ko.computed(function () {
		return this.currentStorage() ? this.currentStorage().displayName : '';
	}, this);
	this.storageType.subscribe(function () {
		if (this.bPublic) {
			this.rootPath(Settings.PublicFolderName);
		} else {
			if (this.currentStorage()) {
				this.rootPath(this.currentStorage().displayName);
			}
			this.selector.listCheckedAndSelected(false);
		}
	}, this);
	this.createButtonsControllers = ko.observableArray([]);

	this.pathItems = ko.observableArray();
	this.currentPath = ko.observable('');
	this.isZipFolder = ko.computed(function () {
		var aPath = this.currentPath().split('$ZIP:');
		return Utils.getFileExtension(aPath[0]) === 'zip';
	}, this);
	this.dropPath = ko.observable('');
	ko.computed(function () {
		this.dropPath(this.currentPath());
	}, this);

	this.isCorporateStorage = ko.computed(function () {
		return this.storageType() === Enums.FileStorageType.Corporate;
	}, this);
	this.isSharedStorage = ko.computed(function () {
		return this.storageType() === Enums.FileStorageType.Shared;
	}, this);
	this.isEncryptedStorage = ko.computed(function () {
		return this.storageType() === Enums.FileStorageType.Encrypted;
	}, this);
	this.isExternalStorage = ko.computed(function () {
		return (this.currentStorage() && this.currentStorage().isExternal);
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
	
	this.selector = new CSelector(this.collection, _.bind(this.onItemSelect, this),
		_.bind(this.onItemDelete, this), _.bind(this.onItemDblClick, this), _.bind(this.onEnter, this), this.columnCount, true, true, true);
		
	this.firstSelectedFile = ko.computed(function () {
		return _.find(this.selector.listCheckedAndSelected(), function (oItem) {
			return oItem.IS_FILE;
		});
	}, this);
	this.selectedOwnItems = ko.computed(function () {
		return _.filter(this.selector.listCheckedAndSelected(), function(item) {
			return !item.sharedWithMe();
		});
	}, this);
	this.selectedHasShared = ko.computed(function () {
		return !!_.find(this.selector.listCheckedAndSelected(), function(oItem) {
			return oItem.sharedWithMe();
		});
	}, this);

	this.searchPattern = ko.observable('');
	this.newSearchPattern = ko.observable('');
	this.isSearchFocused = ko.observable(false);

	this.selectedFiles = ko.computed(function () {
		return _.filter(this.selector.listCheckedAndSelected(), function (oItem) {
			return oItem.IS_FILE;
		}, this);
	}, this);
	this.allSelectedFilesReady = ko.computed(function () {
		return _.every(this.selectedFiles(), function (oItem)  {
			var
				bUploading = oItem.uploaded() === false,
				bDownloading = oItem.downloading() === true
			;
			return !bUploading && !bDownloading;
		});
	}, this);
	this.sharedParentFolder = ko.computed(function () {
		return _.find(this.pathItems(), function (oParentFolder) {
			return oParentFolder.sharedWithMe();
		});
	}, this);

	this.isDownloadAllowed = ko.computed(function () {
		var oFile = this.getFileIfOnlyOneSelected();
		return !!oFile && oFile.hasAction('download') && this.allSelectedFilesReady();
	}, this);
	this.downloadCommand = Utils.createCommand(this, this.executeDownload, this.isDownloadAllowed);

	this.isSendAllowed = ko.computed(function () {
		return !this.isZipFolder() && this.selectedFiles().length > 0 && this.allSelectedFilesReady();
	}, this);
	this.sendCommand = Utils.createCommand(this, this.executeSend, this.isSendAllowed);

	this.isRenameAllowed = ko.computed(function () {
		var
			oSharedParentFolder = this.sharedParentFolder(),
			aItems = this.selector.listCheckedAndSelected(),
			oSelectedItem = aItems.length === 1 ? aItems[0] : null
		;
		return	!this.isZipFolder()
				&& (!oSharedParentFolder || oSharedParentFolder.sharedWithMeAccessWrite())
				&& this.allSelectedFilesReady() && oSelectedItem;
	}, this);
	this.renameCommand = Utils.createCommand(this, this.executeRename, this.isRenameAllowed);

	this.itemsToDeleteCount = ko.computed(function () {
		var sharedParentFolder = this.sharedParentFolder();
		if (!!sharedParentFolder && sharedParentFolder.sharedWithMeAccessWrite()) {
			return this.selector.listCheckedAndSelected().length;
		}
		return this.selectedOwnItems().length;
	}, this);
	this.isDeleteAllowed = ko.computed(function () {
		return	!this.isZipFolder()
				&& this.itemsToDeleteCount() > 0
				&& this.allSelectedFilesReady();
	}, this);
	this.deleteCommand = Utils.createCommand(this, this.executeDelete, this.isDeleteAllowed);

	this.needToCopyDraggedItems = ko.observable(false);
	this.isCutAllowed = ko.computed(function () {
		var
			oSharedParentFolder = this.sharedParentFolder(),
			aItems = this.selector.listCheckedAndSelected()
		;
		return	!this.isZipFolder()
				&& (!oSharedParentFolder && !this.isSharedStorage() || !!oSharedParentFolder && oSharedParentFolder.sharedWithMeAccessWrite())
				&& this.allSelectedFilesReady() && aItems.length > 0;
	}, this);
	this.isCopyAllowed = ko.computed(function () {
		return this.allSelectedFilesReady() && this.selector.listCheckedAndSelected().length > 0;
	}, this);
	this.isDragAllowed = ko.computed(function () {
		return this.isCutAllowed() || this.needToCopyDraggedItems() && this.isCopyAllowed();
	}, this);

	// is used for share and simple public link
	this.isShareAllowed = ko.computed(function () {
		const
			items = this.selector.listCheckedAndSelected(),
			selectedItem = items.length === 1 ? items[0] : null,
			extendedProps = selectedItem && selectedItem.oExtendedProps
		;
		return !this.isZipFolder() &&
				selectedItem && !selectedItem.bIsLink &&
				(!this.sharedParentFolder() || this.sharedParentFolder().sharedWithMeAccessReshare() || selectedItem.sharedWithMeAccessReshare()) &&
				this.allSelectedFilesReady() &&
				(selectedItem.IS_FILE || !this.isEncryptedStorage()) &&
				(!selectedItem.sharedWithMe() || selectedItem.sharedWithMeAccessReshare());
	}, this);
	this.createPublicLinkCommand = Utils.createCommand(this, this.createPublicLink, this.isShareAllowed);

	// Create in general for all kind of items
	this.isCreateAllowed = ko.computed(function () {
		var oSharedParentFolder = this.sharedParentFolder();
		return	!this.isZipFolder()
				&& (oSharedParentFolder && oSharedParentFolder.sharedWithMeAccessWrite()
				|| !oSharedParentFolder && !this.isSharedStorage());
	}, this);
	this.createFolderCommand = Utils.createCommand(this, this.executeCreateFolder, this.isCreateAllowed);

	this.isCreateShortcutAllowed = ko.computed(function () {
		return this.isCreateAllowed() && !this.isExternalStorage() && !this.isEncryptedStorage();
	}, this);
	this.createShortcutCommand = Utils.createCommand(this, this.executeCreateShortcut, this.isCreateShortcutAllowed);

	this.uploaderButton = ko.observable(null);
	this.uploaderArea = ko.observable(null);
	this.bDragActive = ko.observable(false);
	this.isNewItemsMenuOpened = ko.observable(false);

	this.bDragActiveComp = ko.computed(function () {
		var bDrag = this.bDragActive();
		return bDrag && this.searchPattern() === '';
	}, this);
	
	this.isDragAndDropSupported = ko.observable(false);
	this.isCreateAllowed.subscribe(function () {
		if (this.oJua) {
			this.oJua.setDragAndDropEnabledStatus(this.isCreateAllowed());
		}
	}, this);
	
	this.uploadError = ko.observable(false);
	
	this.quota = ko.observable(0);
	this.used = ko.observable(0);
	this.quotaDesc = ko.observable('');
	this.quotaProc = ko.observable(-1);
	this.bShowQuotaBarTextAsTooltip = UserSettings.ShowQuotaBarTextAsTooltip;
	
	this.aBottomLeftCornerLinks = Settings.BottomLeftCornerLinks;
	
	ko.computed(function () {
		if (!UserSettings.ShowQuotaBar)
		{
			return true;
		}

		var
			iQuota = this.quota(),
			iUsed = this.used(),
			iProc = 0 < iQuota ? Math.round((iUsed / iQuota) * 100) : -1
		;

		iProc = 100 < iProc ? 100 : iProc;
		
		this.quotaProc(iProc);
		this.quotaDesc(-1 < iProc ?
			TextUtils.i18n('COREWEBCLIENT/INFO_QUOTA', {
				'PROC': iProc,
				'QUOTA': TextUtils.getFriendlySize(iQuota)
			}) : '')
		;
		
		if (UserSettings.QuotaWarningPerc > 0 && iProc !== -1 && UserSettings.QuotaWarningPerc > (100 - iProc))
		{
			Screens.showError(TextUtils.i18n('COREWEBCLIENT/WARNING_QUOTA_ALMOST_REACHED'), true);
		}
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
				else if (this.isSharedStorage())
				{
					sInfoText = TextUtils.i18n('%MODULENAME%/INFO_SHARED_FOLDER_IS_EMPTY');
				}
				else if (this.currentPath() !== '' || this.bInPopup || this.bPublic)
				{
					sInfoText = TextUtils.i18n('%MODULENAME%/INFO_FOLDER_IS_EMPTY');
				}
				else if (this.isDragAndDropSupported())
				{
					sInfoText = TextUtils.i18n('%MODULENAME%/INFO_DRAGNDROP_FILES_OR_CREATE_FOLDER');
				}
			}
		}
		else if (this.error())
		{
			sInfoText = TextUtils.i18n('%MODULENAME%/ERROR_FILES_NOT_RECEIVED');
		}
		
		return sInfoText;
	}, this);
	
	this.bInPopup = !!bPopup;
	this.timerId = null;
	
	var oParams = {
		'View': this,
		'TemplateName': '%ModuleName%_ItemsView'
	};
	this.itemsViewTemplate = ko.observable(oParams.TemplateName);
	App.broadcastEvent('Files::ChangeItemsView', oParams);
	
	this.addToolbarButtons = ko.observableArray([]);
	
	App.subscribeEvent('Files::ShowList', _.bind(function (oParams) {
		if (this.shown() && oParams.Item)
		{
			this.routeFiles(oParams.Item.storageType(), oParams.Item.fullPath());
		}
	}, this));
	App.broadcastEvent('%ModuleName%::ConstructView::after', {'Name': this.ViewConstructorName, 'View': this});
	
	ConfirmPopup.opened.subscribe(_.bind(function() {
		if (this.shown())
		{
			this.selector.useKeyboardKeys(true);
		}
	}, this));
	
	this.PublicLinksEnabled = Settings.PublicLinksEnabled;
}

_.extendOwn(CFilesView.prototype, CAbstractScreenView.prototype);

CFilesView.prototype.ViewTemplate = App.isPublic() ? '%ModuleName%_PublicFilesView' : '%ModuleName%_FilesView';
CFilesView.prototype.ViewConstructorName = 'CFilesView';

CFilesView.prototype.registerCreateButtonsController = function (oBigButtonView)
{
	this.createButtonsControllers.push(oBigButtonView);
};

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
						'Path': self.dropPath(),
						'Overwrite': false
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
			.on('onDialog', _.bind(function () {
				setTimeout(_.bind(this.isNewItemsMenuOpened, this, false), 10);
			}, this, false))
		;
		
		this.isDragAndDropSupported(this.oJua.isDragAndDropSupported());
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
	if (Settings.EnableUploadSizeLimit && oFileData.Size/(1024*1024) > Settings.UploadSizeLimitMb)
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
			oFile = new CFileModel(oData, this)
		;
		oFile.onUploadSelect(sFileUid, oFileData, true);
		this.uploadingFiles.push(oFile);
		this.onFileFromSubfolderUploadSelect(oFileData);
	}
};

/**
 * If selected for upload file is from subfolder increase uploading files count for this folder.
 * @param {Object} oFileData
 */
CFilesView.prototype.onFileFromSubfolderUploadSelect = function (oFileData)
{
	if (Types.isNonEmptyString(oFileData.Folder))
	{
		var
			aPath = _.compact(oFileData.Folder.split('/')),
			sFolderName = aPath[0],
			oFolder = _.find(this.folders(), function (oTmpFolder) {
				return oTmpFolder.fileName() === sFolderName;
			})
		;
		if (sFolderName && !oFolder)
		{
			oFolder = new CFolderModel(this);
			oFolder.parse({
				Name: sFolderName
			});
			this.folders.push(oFolder);
		}
		oFolder.increaseUploadingFiles();
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
			this.onFileWithSubfolderUploadComplete(oFile);
			this.deleteUploadFileByUid(sFileUid);
			
			if (oFile.uploadError())
			{
				this.uploadError(true);
				if (oResult && oResult.ErrorCode === Enums.Errors.CanNotUploadFileQuota)
				{
					Popups.showPopup(AlertPopup, [TextUtils.i18n('COREWEBCLIENT/ERROR_CANT_UPLOAD_FILE_QUOTA')]);
					bRequestFiles = true;
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
				if (oFile.path() === this.currentPath() && oFile.storageType() === this.storageType())
				{
					this.files.push(oFile);
				}
				if (this.uploadingFiles().length === 0)
				{
					Screens.showReport(TextUtils.i18n('COREWEBCLIENT/REPORT_UPLOAD_COMPLETE'));
				}
			}
			if (this.uploadingFiles().length === 0)
			{
				bRequestFiles = true;
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
 * If uploaded file is from subfolder increase uploaded files count for this folder.
 * @param {Object} oFile
 */
CFilesView.prototype.onFileWithSubfolderUploadComplete = function (oFile)
{
	if (oFile.sUploadSubFolder)
	{
		var
			aPath = _.compact(oFile.sUploadSubFolder.split('/')),
			sFolderName = aPath[0],
			oFolder = _.find(this.folders(), function (oTmpFolder) {
				return oTmpFolder.fileName() === sFolderName;
			})
		;
		if (oFolder)
		{
			oFolder.increaseUploadedFiles();
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
	if (this.bPublic || !this.isDragAllowed())
	{
		return;
	}

	if (oEvent)
	{
		var
			aChecked = this.selector.listCheckedAndSelected(),
			sMethod = this.needToCopyDraggedItems() ? 'Copy' : 'Move'
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
		oFromStorage = this.currentStorage(),
		bSameStorage = oToStorage.type === oFromStorage.type,
		iUsed = this.used(),
		iQuota = this.quota(),
		bAllowMove = true
	;
	
	if (bSameStorage || !bSameStorage && !oToStorage.isExternal && !oFromStorage.isExternal && Enums.FileStorageType.Shared !== oToStorage.type)
	{
		if (oToStorage.type === Enums.FileStorageType.Personal && oFromStorage.type !== Enums.FileStorageType.Personal)
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
 * @param {Object} oDraggedItem
 * @param {boolean} ctrlOrCmdUsed
 */
CFilesView.prototype.dragAndDropHelper = function (oDraggedItem, ctrlOrCmdUsed)
{
	if (!oDraggedItem || !oDraggedItem.allowDrag()) {
		return $('<span></span>');
	}

	oDraggedItem.checked(true);

	this.needToCopyDraggedItems(ctrlOrCmdUsed);

	if (!this.isDragAllowed()) {
		return $('<span></span>');
	}

	var
		oHelper = Utils.draggableItems(),
		aItems = this.selector.listCheckedAndSelected(),
		oCounts = _.countBy(aItems, function(oItem) {
			return oItem.IS_FILE ? 'file': 'folder';
		}),
		sPlusPrefix = ctrlOrCmdUsed ? '+ ' : '',
		sText = ''
	;
	
	if (!oCounts.file) {
		sText = TextUtils.i18n('%MODULENAME%/LABEL_DRAG_FOLDERS_PLURAL', {'COUNT': sPlusPrefix + oCounts.folder}, null, oCounts.folder);
	} else if (!oCounts.folder) {
		sText = TextUtils.i18n('%MODULENAME%/LABEL_DRAG_FILES_PLURAL', {'COUNT': sPlusPrefix + oCounts.file}, null, oCounts.file);
	} else {
		sText = TextUtils.i18n('%MODULENAME%/LABEL_DRAG_ITEMS_PLURAL', {'COUNT': sPlusPrefix + aItems.length}, null, aItems.length);
	}

	$('.count-text', oHelper).text(sText);

	return oHelper;
};

CFilesView.prototype.onItemDelete = function ()
{
	if (this.isDeleteAllowed()) {
		this.executeDelete();
	}
};

CFilesView.prototype.onItemSelect = function (oItem)
{
	if (App.isMobile() && oItem instanceof CFolderModel)
	{
		this.onItemDblClick(oItem);
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
				if (!(oItem instanceof CFolderModel) || !oItem.isIncomplete())
				{
					this.routeFiles(oItem.storageType(), oItem.fullPath());
				}
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
	
	this.bNotLoading = false;
	
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
					var oFolder = new CFolderModel(this);
					oFolder.parse(oData);
					this.checkIfFolderUploading(oFolder);
					aNewFolderList.push(oFolder);
				}
				else
				{
					var oFile = new CFileModel(oData, this);

					if (oFile.oExtendedProps && oFile.oExtendedProps.Loading)
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

			this.loadedFiles(true);
			clearTimeout(this.timerId);

			this.parseQuota(oResult.Quota);

			if (_.isArray(oResult.Path))
			{
				this.pathItems.removeAll();
				_.each(oResult.Path.reverse(), _.bind(function (oPathItem) {
					var oFolder = new CFolderModel(this);
					oFolder.parse(oPathItem);
					this.pathItems.push(oFolder);
				}, this));
			}
			this.loading(false);

			//If the current path does not contain information about access, we obtain such information from the response, if possible
			if (oResult.Access && this.pathItems().length > 0) {
				const
					iLastIndex = this.pathItems().length - 1,
					lastItem = this.pathItems()[iLastIndex]
				;
				if (!lastItem.oExtendedProps || !lastItem.oExtendedProps.SharedWithMeAccess) {
					this.pathItems()[iLastIndex].updateExtendedProps({
						'SharedWithMeAccess': oResult.Access
					});
					this.pathItems.valueHasMutated(); // for triggering sharedParentFolder computing
				}
			}
		}
		else
		{
			if (oResponse.ErrorCode !== Enums.Errors.NotDisplayedError)
			{
				this.loading(false);
				this.error(true);
				Api.showErrorByCode(oResponse, TextUtils.i18n('%MODULENAME%/ERROR_FILES_NOT_RECEIVED'));
			}
		}
	}
};

/**
 * Checks if folder has uploding files and marks it as uploading.
 * @param {Object} oFolder
 */
CFilesView.prototype.checkIfFolderUploading = function (oFolder) {
	_.each(this.uploadingFiles(), function (oFile) {
		if (oFile.sUploadSubFolder)
		{
			var
				aPath = _.compact(oFile.sUploadSubFolder.split('/')),
				sFolderName = aPath[0]
			;
			if (oFolder.fileName() === sFolderName)
			{
				oFolder.increaseUploadingFiles();
			}
		}
	});
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
		this.quota(Types.pInt(oQuota.Limit));
		this.used(Types.pInt(oQuota.Used));
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
		Api.showErrorByCode(oResponse);
		this.routeFiles(this.storageType(), this.currentPath(), this.searchPattern());
	}
};

CFilesView.prototype.executeRename = function ()
{
	var
		oItem = _.first(this.selector.listCheckedAndSelected()),
		bSeparateExtension = Settings.EditFileNameWithoutExtension && oItem instanceof CFileModel,
		sName = bSeparateExtension ? Utils.getFileNameWithoutExtension(oItem.fileName()) : oItem.fileName(),
		sExtension = bSeparateExtension ? Utils.getFileExtension(oItem.fileName()) : ''
	;
	
	if (!this.bPublic && oItem)
	{
		Popups.showPopup(RenamePopup, [sName, _.bind(this.renameItem, this, sExtension)]);
	}
};

/**
 * @param {string} sExtension
 * @param {string} sNamePart
 * @returns {string}
 */
CFilesView.prototype.renameItem = function (sExtension, sNamePart)
{
	var
		sName = (sExtension === '') ? sNamePart : sNamePart + '.' + sExtension,
		oItem = _.first(this.selector.listCheckedAndSelected())
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
				'Name': oItem.id() || oItem.fileName(),
				'NewName': sName,
				'IsLink': oItem.bIsLink,
				'IsFolder': !oItem.IS_FILE
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

CFilesView.prototype.createPublicLink = function ()
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
		aFilesData = _.map(this.selectedFiles(), function (oItem) {
			return {
				'Storage': oItem.storageType(),
				'Path': oItem.path(),
				'Name': oItem.fileName(),
				'Id': oItem.id()
			};
		})
	;
	
	if (this.bAllowSendEmails && aFilesData.length > 0)
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
 * @param {Object} oItem
 */
CFilesView.prototype.onSecureIconClick = function (oItem)
{
	if (oItem && _.isFunction(oItem.onSecureIconClick))
	{
		oItem.onSecureIconClick(oItem);
	}
};

/**
 * @param {Object} oItem
 */
CFilesView.prototype.onFileShareIconClick = function (oItem)
{
	if (FilesSharePopup && oItem)
	{
		Popups.showPopup(FilesSharePopup, [oItem, this.expungeFileItems.bind(this)]);
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

CFilesView.prototype.refresh = function ()
{
	this.routeFiles(this.storageType(), this.currentPath(), this.searchPattern(), true);
};

CFilesView.prototype.executeDelete = function ()
{
	var
		sharedParentFolder = this.sharedParentFolder(),
		allowDeleteSharedItems = !!sharedParentFolder && sharedParentFolder.sharedWithMeAccessWrite(),
		items = this.selector.listCheckedAndSelected() || [],
		itemsToDelete = allowDeleteSharedItems ? items : this.selectedOwnItems(),
		itemsToDeleteCount = itemsToDelete.length
	;

	if (!this.bPublic && itemsToDeleteCount > 0) {
		var
			askAboutSharedItems = items.length !== itemsToDeleteCount,
			hasFolder = !!_.find(itemsToDelete, function (item) { return !item.IS_FILE; }),
			hasFile = !!_.find(itemsToDelete, function (item) { return item.IS_FILE; }),
			confirmText = ''
		;

		if (askAboutSharedItems) {
			confirmText = TextUtils.i18n('%MODULENAME%/CONFIRM_NOT_ALL_ITEMS_OWN');
		} else if (hasFolder && hasFile) {
			confirmText = TextUtils.i18n('%MODULENAME%/CONFIRM_DELETE_ITEMS_PLURAL', {'COUNT': itemsToDeleteCount}, null, itemsToDeleteCount);
		} else if (hasFolder) {
			confirmText = TextUtils.i18n('%MODULENAME%/CONFIRM_DELETE_FOLDERS_PLURAL', {'COUNT': itemsToDeleteCount}, null, itemsToDeleteCount);
		} else {
			confirmText = TextUtils.i18n('%MODULENAME%/CONFIRM_DELETE_FILES_PLURAL', {'COUNT': itemsToDeleteCount}, null, itemsToDeleteCount);
		}

		this.selector.useKeyboardKeys(false);
		Popups.showPopup(ConfirmPopup, [confirmText, _.bind(this.deleteItems, this, itemsToDelete), '', TextUtils.i18n('COREWEBCLIENT/ACTION_DELETE')]);
	}
};

CFilesView.prototype.onShow = function ()
{
	this.loaded(true);
	
	if (!this.bPublic)
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
	Ajax.send('GetQuota',
		{
			'Type': this.storageType()
		},
		function (oResponse) {
			if (oResponse.Result)
			{
				this.parseQuota(oResponse.Result);
			}
		},
		this
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
					displayName: oStorage.DisplayName,
					droppable: ko.computed(function () {
						return oStorage.IsDroppable && (!this.sharedParentFolder() && !this.selectedHasShared()
								|| this.needToCopyDraggedItems()
								|| this.sharedParentFolder() && this.sharedParentFolder().sharedWithMeAccessWrite());
					}, this)
				});
			}
		}, this);
		
		this.expungeExternalStorages(_.map(oResult, function(oStorage){
			return oStorage.Type;
		}, this));
	}

	if (!this.currentStorage()) {
		this.storageType(Enums.FileStorageType.Personal);
		this.pathItems.removeAll();
	}

	if (this.bInPopup)
	{
		this.routeFiles(this.storageType(), this.currentPath(), this.searchPattern(), true);
	}
};

/**
 * Clears file/folder list and displays loading message.
 */
CFilesView.prototype.clearAndShowLoading = function ()
{
	this.folders([]);
	this.files([]);
	this.loading(true);
};

CFilesView.prototype.currentGetFiles = function ()
{
	var
		iPathItemsCount = this.pathItems().length,
		oParameters = {
			'Type': this.storageType(),
			'Path': this.currentPath(),
			'Pattern': this.searchPattern(),
			'PathRequired': this.currentPath() !== '' && iPathItemsCount === 0
		}
	;
	Ajax.send('GetFiles', oParameters, this.onGetFilesResponse, this);
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
			this.clearAndShowLoading();
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
		if (this.bInPopup)
		{
			this.onUserRoute(LinksUtils.getParsedParams(sStorage, sFullPath, sSearch));
		}
		else
		{
			bSame = Routing.setHash(LinksUtils.getFiles(sStorage, sFullPath, sSearch));
			if (bSame)
			{
				this.clearAndShowLoading();
				this.currentGetFiles();
			}
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
	var oFolder = new CFolderModel(this);
	oFolder.storageType(sStorage);
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
	
	if (this.bPublic)
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
		bStorageFound = this.storages().length === 0 || !!_.find(this.storages(), function (oStorage) {
			return oStorage.type === oParams.Storage;
		}),
		sStorage = bStorageFound ? oParams.Storage : (this.storages().length > 0 ? this.storages()[0].type : ''),
		sPath = oParams.Path
	;

	this.error(false);

	this.storageType(sStorage);
	this.currentPath(sPath);
	this.searchPattern(Types.pString(oParams.Search));
	this.loadedFiles(false);

	this.populatePathItems(oParams);

	if (this.bNotLoading && (this.files().length > 0 || this.folders().length > 0)) {
		this.timerId = setTimeout(_.bind(function() {
			if (!this.loadedFiles() && !this.error()) {
				this.clearAndShowLoading();
			}
		}, this), 3000);
	} else {
		this.clearAndShowLoading();
	}

	this.currentGetFiles();
};

CFilesView.prototype.populatePathItems = function (oParams)
{
	var
		sPath = this.currentPath(),
		aPath = oParams.PathParts.reverse(),
		oFolder = _.find(this.folders(), function (oFld) {
			return oFld.fullPath() === sPath;
		}),
		iPathItemIndex = _.findIndex(this.pathItems(), function (oItem) {
			return oItem.fullPath() === sPath;
		})
	;
	if (iPathItemIndex !== -1) {
		this.pathItems(this.pathItems().slice(0, iPathItemIndex + 1));
	} else if (oFolder) {
		this.pathItems.push(oFolder);
	} else if (this.storageType() !== 'google' || sPath === '') {
		this.pathItems.removeAll();
		_.each(aPath, _.bind(function (sPathItem) {
			var iItemPos = sPath.lastIndexOf(sPathItem);
			this.addPathItems(this.storageType(), sPath, sPathItem);
			sPath = sPath.substr(0, iItemPos);
		}, this));
		var
			oParameters = {
				'Type': this.storageType(),
				'Path': this.currentPath()
			}
		;
		Ajax.send('GetAccessInfoForPath', oParameters, function (response) {
			if (response && response.Result) {
				_.each(this.pathItems(), function (pathItem) {
					var itemPath = pathItem.fullPath();
					if (itemPath.substr(itemPath.length - 1, 1) === '/') {
						itemPath = itemPath.substr(0, itemPath.length - 1);
					}
					if (response.Result[itemPath]) {
						pathItem.updateExtendedProps({
							'SharedWithMeAccess': response.Result[itemPath]
						});
					}
				});
				this.pathItems.valueHasMutated(); // for triggering sharedParentFolder computing
			}
		}, this);
	}
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
	
	this.clearAndShowLoading();
	
	Ajax.send('GetPublicFiles', {
			'Hash': Settings.PublicHash,
			'Path': this.currentPath()
		}, this.onGetFilesResponse, this
	);
};

/**
 * @param {Array} aChecked
 * @param {boolean} bOkAnswer
 * @param {string} methodName
 */
CFilesView.prototype.deleteItems = function (aChecked, bOkAnswer, methodName = 'Delete')
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
				return {
					'Path': oItem.path(),
					'Name': oItem.id(),
					'IsFolder': !oItem.IS_FILE
				};
			}
			return null;
		}));
		if (aItems.length)
		{
			Ajax.send(methodName, {
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
 * @param {object} oFile
 */
CFilesView.prototype.addFileToCurrentFolder = function (oFile)
{
	if (this.searchPattern() === '')
	{
		this.files.push(oFile);
	}
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
	this.deleteUploadFileByUid(sFileUid);
	if (this.oJua)
	{
		this.oJua.cancel(sFileUid);
	}
};

/**
 * @param {Object} oResponse
 * @param {Object} oRequest
 */
CFilesView.prototype.onCreateFolderResponse = function (oResponse, oRequest)
{
	if (!oResponse.Result)
	{
		Api.showErrorByCode(oResponse);
	}
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

CFilesView.prototype.executeCreateFolder = function ()
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

CFilesView.prototype.executeCreateShortcut = function ()
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
	var oFolder = new CFolderModel(this);
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
			var oParameters = {
				'Type': this.storageType(),
				'Path': this.currentPath(),
				'Items': [{
					'Path': this.currentPath(),
					'Name': sFileName,
					'IsFolder': false
				}]
			};
			Ajax.send('Delete', oParameters, function (oResponse) {
				if (!oResponse.Result) {
					Api.showErrorByCode(oResponse);
				}
				this.currentGetFiles();
			}, this);
			this.onCancelUpload(sFileUploadUid);
		}, this)
	;
	if (oFile.downloading())
	{
		App.broadcastEvent('CFilesView::FileDownloadCancel', {oFile: oFile});
	}
	else if (!oFile.uploaded() && sFileUploadUid)
	{
		var bEventCaught = App.broadcastEvent('CFilesView::FileUploadCancel', {sFileUploadUid: sFileUploadUid, sFileUploadName: oFile.fileName(), fOnUploadCancelCallback: fOnUploadCancelCallback});	
		if (!bEventCaught)
		{
			fOnUploadCancelCallback(sFileUploadUid, oFile.fileName());
		}
	}
};

module.exports = CFilesView;
