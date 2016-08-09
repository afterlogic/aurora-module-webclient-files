'use strict';

var
	ko = require('knockout'),
	
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js')
;

module.exports = {
	ServerModuleName: 'Files',
	HashModuleName: 'files',
	
	enableModule: ko.observable(true),
	PublicName: '',
	EnableUploadSizeLimit: false,
	UploadSizeLimitMb: 0,
	EnableCorporate: false,
	UserSpaceLimitMb: 0,
	CustomTabTitle: '',
	
	init: function (oAppDataSection) {
		if (oAppDataSection)
		{
			this.enableModule =  ko.observable(!!oAppDataSection.EnableModule);
			this.PublicName = Types.pString(oAppDataSection.PublicName);
			this.EnableUploadSizeLimit = !!oAppDataSection.EnableUploadSizeLimit;
			this.UploadSizeLimitMb = Types.pInt(oAppDataSection.UploadSizeLimitMb);
			this.EnableCorporate = !!oAppDataSection.EnableCorporate;
			this.UserSpaceLimitMb = Types.pInt(oAppDataSection.UserSpaceLimitMb);
			this.CustomTabTitle = Types.pString(oAppDataSection.CustomTabTitle);
		}
	},
	
	update: function (sEnableModule) {
		this.enableModule(sEnableModule === '1');
	},
	
	/**
	 * Updates settings from settings tab in admin panel.
	 * 
	 * @param {boolean} bEnableUploadSizeLimit Indicates if upload size limit is enabled.
	 * @param {number} iUploadSizeLimitMb Value of upload size limit in Mb.
	 * @param {boolean} bEnableCorporate Indicates if corporate storage is enabled.
	 * @param {number} iUserSpaceLimitMb Value of user space limit in Mb.
	 */
	updateAdmin: function (bEnableUploadSizeLimit, iUploadSizeLimitMb, bEnableCorporate, iUserSpaceLimitMb)
	{
		this.EnableUploadSizeLimit = bEnableUploadSizeLimit;
		this.UploadSizeLimitMb = iUploadSizeLimitMb;
		this.EnableCorporate = bEnableCorporate;
		this.UserSpaceLimitMb = iUserSpaceLimitMb;
	}
};
