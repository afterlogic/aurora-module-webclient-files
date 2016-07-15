'use strict';

var
	ko = require('knockout'),
	
	Types = require('modules/CoreClient/js/utils/Types.js')
;

module.exports = {
	ServerModuleName: 'Files',
	HashModuleName: 'files',
	
	enableModule: ko.observable(true),
	PublicHash: '',
	PublicName: '',
	EnableUploadSizeLimit: false,
	UploadSizeLimitMb: 0,
	EnableCorporate: false,
	UserSpaceLimitMb: 0,
	
	init: function (oAppDataSection) {
		if (oAppDataSection)
		{
			this.enableModule =  ko.observable(!!oAppDataSection.EnableModule);
			this.PublicHash = Types.pString(oAppDataSection.PublicHash);
			this.PublicName = Types.pString(oAppDataSection.PublicName);
			this.EnableUploadSizeLimit = !!oAppDataSection.EnableUploadSizeLimit;
			this.UploadSizeLimitMb = Types.pInt(oAppDataSection.UploadSizeLimitMb);
			this.EnableCorporate = !!oAppDataSection.EnableCorporate;
			this.UserSpaceLimitMb = Types.pInt(oAppDataSection.UserSpaceLimitMb);
		}
	},
	
	update: function (sEnableModule) {
		this.enableModule(sEnableModule === '1');
	}
};
