'use strict';

var
	_ = require('underscore'),
	ko = require('knockout'),
	
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js')
;

/**
 * @constructor
 * @param {Object} oData
 * @param {bool} oParent
 */

function CStorageModel(isCurrentStorageDroppable)
{
	this.isCurrentStorageDroppable = isCurrentStorageDroppable;
	
	this.isExternal = false;
	this.type = '';
	this.displayName = '';
	this.hideInList = false;
	this.isDroppable = ko.observable(true);

	this.droppable = ko.computed(function () {
		return this.isDroppable() && this.isCurrentStorageDroppable();
	}, this);
	this.droppableDisabled = ko.computed(function () {
		return !this.droppable();
	}, this);
    
}

CStorageModel.prototype.parse = function (oData) {
	this.isExternal = Types.pBool(oData.IsExternal);
	this.type = Types.pString(oData.Type);
	this.displayName = Types.pString(oData.DisplayName);
	this.hideInList = Types.pBool(!!oData.HideInList);
	this.isDroppable(Types.pBool(oData.IsDroppable));
}

module.exports = CStorageModel;