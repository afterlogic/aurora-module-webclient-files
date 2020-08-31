'use strict';

var
	ko = require('knockout'),
	
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js'),
	App = require('%PathToCoreWebclientModule%/js/App.js'),
	CAbstractFileModel = require('%PathToCoreWebclientModule%/js/models/CAbstractFileModel.js')
;

/**
 * @constructor
 */
function CFolderModel()
{
	//template
	this.selected = ko.observable(false);
	this.checked = ko.observable(false); // ? = selected ?
	this.deleted = ko.observable(false); // temporary removal until it was confirmation from the server to delete, css-animation
	this.recivedAnim = ko.observable(false).extend({'autoResetToFalse': 500});
	
	this.published = ko.observable(false);
	this.isShared = ko.observable(false);
	this.fileName = ko.observable('');
	
	//onDrop
	this.fullPath = ko.observable('');
	
	//rename
	this.path = ko.observable('');
	
	//pathItems
	this.storageType = ko.observable(Enums.FileStorageType.Personal);
	this.displayName = ko.observable('');
	this.id = ko.observable('');
	
	this.sMainAction = 'list';
	this.oExtendedProps = null;
	
	// The folder can be uploading. Operations should be disabled for such a folder.
	this.uploadingFilesCount = ko.observable(0);
	this.uploadedFilesCount = ko.observable(0);
	this.progressPercent = ko.computed(function () {
		if (this.uploadingFilesCount() > 0)
		{
			return Math.floor((this.uploadedFilesCount() / this.uploadingFilesCount()) * 100);
		}
		return 0;
	}, this);
	this.isIncomplete = ko.computed(function () {
		return this.uploadingFilesCount() > 0;
	}, this);
	this.uploaded = ko.computed(function () {
		return this.uploadingFilesCount() === 0;
	}, this);
}

CFolderModel.prototype.parse = function (oData)
{
	this.published(!!oData.Published);
	this.fileName(Types.pString(oData.Name));
	this.fullPath(Types.pString(oData.FullPath));
	this.path(Types.pString(oData.Path));
	this.storageType(Types.pString(oData.Type));
	this.displayName(this.fileName());
	this.id(Types.pString(oData.Id));
	this.oExtendedProps = oData.ExtendedProps || [];
	if (oData.MainAction)
	{
		this.sMainAction = Types.pString(oData.MainAction);
	}
	App.broadcastEvent('%ModuleName%::ParseFolder::after', [this, oData]);
};

CFolderModel.prototype.getMainAction = function ()
{
	return this.sMainAction;
};

CFolderModel.prototype.increaseUploadingFiles = function ()
{
	return this.uploadingFilesCount(this.uploadingFilesCount() + 1);
};

CFolderModel.prototype.increaseUploadedFiles = function ()
{
	return this.uploadedFilesCount(this.uploadedFilesCount() + 1);
};


CFolderModel.prototype.eventDragStart = CAbstractFileModel.prototype.eventDragStart;

module.exports = CFolderModel;
