'use strict';

var $ = require('jquery');

$('body').ready(function () {
	var
		oAvaliableModules = {
			'FilesWebclient': require('modules/FilesWebclient/js/manager-pub.js')
		},
		ModulesManager = require('modules/CoreClient/js/ModulesManager.js'),
		App = require('modules/CoreClient/js/App.js')
	;
	
	App.setPublic();
	ModulesManager.init(oAvaliableModules, App.getUserRole(), App.isPublic());
	App.init();
});
