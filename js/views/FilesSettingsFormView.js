'use strict';

var
	_ = require('underscore'),
	
	ModulesManager = require('%PathToCoreWebclientModule%/js/ModulesManager.js'),
	CAbstractSettingsFormView = ModulesManager.run('SettingsWebclient', 'getAbstractSettingsFormViewClass')
;

/**
 * @constructor
 */
function CFilesSettingsFormView()
{
	CAbstractSettingsFormView.call(this, 'FilesWebclient');
}

_.extendOwn(CFilesSettingsFormView.prototype, CAbstractSettingsFormView.prototype);


module.exports = new CFilesSettingsFormView();
