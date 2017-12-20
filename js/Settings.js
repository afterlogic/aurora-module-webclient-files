'use strict';

var
	ko = require('knockout'),
	_ = require('underscore'),
	
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js')
;

module.exports = {
	ServerModuleName: 'Files',
	HashModuleName: 'files',
	
	CustomTabTitle: '',
	enableModule: ko.observable(true),
	EnableUploadSizeLimit: false,
	PublicFolderName: '',
	PublicHash: '',
	UploadSizeLimitMb: 0,
	UserSpaceLimitMb: 0,
	
	EditFileNameWithoutExtention: false,
	bShowCommonSettings: true,
	bShowFilesApps: true,
	
	/**
	 * Initializes settings from AppData object sections.
	 * 
	 * @param {Object} oAppData Object contained modules settings.
	 */
	init: function (oAppData)
	{
		var
			oAppDataFilesSection = oAppData[this.ServerModuleName],
			oAppDataFilesWebclientSection = oAppData['%ModuleName%']
		;
		
		if (!_.isEmpty(oAppDataFilesSection))
		{
			this.CustomTabTitle = Types.pString(oAppDataFilesSection.CustomTabTitle, this.CustomTabTitle);
			this.enableModule =  ko.observable(Types.pBool(oAppDataFilesSection.EnableModule, this.enableModule()));
			this.EnableUploadSizeLimit = Types.pBool(oAppDataFilesSection.EnableUploadSizeLimit, this.EnableUploadSizeLimit);
			this.PublicFolderName = Types.pString(oAppDataFilesSection.PublicFolderName, this.PublicFolderName);
			this.PublicHash = Types.pString(oAppDataFilesSection.PublicHash, this.PublicHash);
			this.UploadSizeLimitMb = Types.pNonNegativeInt(oAppDataFilesSection.UploadSizeLimitMb, this.UploadSizeLimitMb);
			this.UserSpaceLimitMb = Types.pNonNegativeInt(oAppDataFilesSection.UserSpaceLimitMb, this.UserSpaceLimitMb);
		}
			
		if (!_.isEmpty(oAppDataFilesWebclientSection))
		{
			this.EditFileNameWithoutExtention = Types.pBool(oAppDataFilesWebclientSection.EditFileNameWithoutExtention, this.EditFileNameWithoutExtention);
			this.bShowCommonSettings = Types.pBool(oAppDataFilesWebclientSection.ShowCommonSettings, this.bShowCommonSettings);
			this.bShowFilesApps = Types.pBool(oAppDataFilesWebclientSection.ShowFilesApps, this.bShowFilesApps);
		}
	},
	
	/**
	 * Updates new settings values after saving on server.
	 * 
	 * @param {string} sEnableModule
	 */
	update: function (sEnableModule)
	{
		this.enableModule(sEnableModule === '1');
	},
	
	/**
	 * Updates settings from settings tab in admin panel.
	 * 
	 * @param {boolean} bEnableUploadSizeLimit Indicates if upload size limit is enabled.
	 * @param {number} iUploadSizeLimitMb Value of upload size limit in Mb.
	 * @param {number} iUserSpaceLimitMb Value of user space limit in Mb.
	 */
	updateAdmin: function (bEnableUploadSizeLimit, iUploadSizeLimitMb, iUserSpaceLimitMb)
	{
		this.EnableUploadSizeLimit = bEnableUploadSizeLimit;
		this.UploadSizeLimitMb = iUploadSizeLimitMb;
		this.UserSpaceLimitMb = iUserSpaceLimitMb;
	}
};
