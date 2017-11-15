'use strict';

var
	Ajax = require('%PathToCoreWebclientModule%/js/Ajax.js'),
	
	Settings = require('modules/%ModuleName%/js/Settings.js')
;

Ajax.registerAbortRequestHandler(Settings.ServerModuleName, function (oRequest, oOpenedRequest) {
	switch (oRequest.Method)
	{
		case 'GetFiles':
			return oOpenedRequest.Method === 'GetFiles';
	}
	
	return false;
});

module.exports = {
	send: function (sMethod, oParameters, fResponseHandler, oContext) {
		Ajax.send(Settings.ServerModuleName, sMethod, oParameters, fResponseHandler, oContext);
	},
	sendToWebclient: function (sMethod, oParameters, fResponseHandler, oContext) {
		Ajax.send('%ModuleName%', sMethod, oParameters, fResponseHandler, oContext);
	}
};