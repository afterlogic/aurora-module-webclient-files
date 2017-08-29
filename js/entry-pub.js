'use strict';

var $ = require('jquery');

$('body').ready(function () {
	var
		oAvailableModules = {
			'FilesWebclient': require('modules/FilesWebclient/js/manager.js')
		},
		ModulesManager = require('%PathToCoreWebclientModule%/js/ModulesManager.js'),
		App = require('%PathToCoreWebclientModule%/js/App.js')
	;
	
	App.setPublic();
	ModulesManager.init(oAvailableModules);
	App.init();
});
