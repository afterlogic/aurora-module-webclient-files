'use strict';

var
	ko = require('knockout'),
	_ = require('underscore'),
	
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js')
;

module.exports = {
	ServerModuleName: 'Files',
	CorporateServerModuleName: 'CorporateFiles',
	PersonalServerModuleName: 'PersonalFiles',
	HashModuleName: 'files',
	
	CustomTabTitle: '',
	enableModule: ko.observable(true),
	EnableUploadSizeLimit: false,
	PublicFolderName: '',
	PublicHash: '',
	UploadSizeLimitMb: 0,
	PersonalSpaceLimitMb: 0,
	CorporateSpaceLimitMb: 0,
	
	EditFileNameWithoutExtention: false,
	ShowCommonSettings: true,
	ShowFilesApps: true,
	
	/**
	 * Initializes settings from AppData object sections.
	 * 
	 * @param {Object} oAppData Object contained modules settings.
	 */
	init: function (oAppData)
	{
		var
			oAppDataFilesSection = oAppData[this.ServerModuleName],
			oAppDataPersonalFilesSection = oAppData['PersonalFiles'],
			oAppDataCorporateFilesSection = oAppData['CorporateFiles'],
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
		}
		
		if (!_.isEmpty(oAppDataPersonalFilesSection))
		{
			this.PersonalSpaceLimitMb = Types.pNonNegativeInt(oAppDataPersonalFilesSection.UserSpaceLimitMb, this.PersonalSpaceLimitMb);
		}
		
		if (!_.isEmpty(oAppDataCorporateFilesSection))
		{
			this.CorporateSpaceLimitMb = Types.pNonNegativeInt(oAppDataCorporateFilesSection.SpaceLimitMb, this.CorporateSpaceLimitMb);
		}
			
		if (!_.isEmpty(oAppDataFilesWebclientSection))
		{
			this.EditFileNameWithoutExtention = Types.pBool(oAppDataFilesWebclientSection.EditFileNameWithoutExtention, this.EditFileNameWithoutExtention);
			this.ShowCommonSettings = Types.pBool(oAppDataFilesWebclientSection.ShowCommonSettings, this.ShowCommonSettings);
			this.ShowFilesApps = Types.pBool(oAppDataFilesWebclientSection.ShowFilesApps, this.ShowFilesApps);
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
	 */
	updateAdmin: function (bEnableUploadSizeLimit, iUploadSizeLimitMb)
	{
		this.EnableUploadSizeLimit = bEnableUploadSizeLimit;
		this.UploadSizeLimitMb = iUploadSizeLimitMb;
	},
	
	updateAdminPersonal: function (iUserSpaceLimitMb)
	{
		this.PersonalSpaceLimitMb = iUserSpaceLimitMb;
	},
	
	updateAdminCorporate: function (iSpaceLimitMb)
	{
		this.CorporateSpaceLimitMb = iSpaceLimitMb;
	}
};
