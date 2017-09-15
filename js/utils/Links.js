'use strict';

var
	_ = require('underscore'),
	$ = require('jquery'),
	
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js'),
	
	Settings = require('modules/%ModuleName%/js/Settings.js'),
	
	LinksUtils = {}
;

/**
 * Returns true if parameter contains path value.
 * @param {string} sTemp
 * @return {boolean}
 */
function IsPathParam(sTemp)
{
	return ('path' === sTemp.substr(0, 4));
};

/**
 * @param {string=} sStorage
 * @param {string=} sPath
 * @param {string=} sSearch
 * @returns {Array}
 */
LinksUtils.getFiles = function (sStorage, sPath, sSearch)
{
	var aParams = [Settings.HashModuleName];
	
	if (sStorage && sStorage !== '')
	{
		aParams.push(sStorage);
	}
	
	if (sPath && sPath !== '')
	{
		aParams.push('path' + sPath);
	}
	
	if (sSearch && sSearch !== '')
	{
		aParams.push(sSearch);
	}
	
	return aParams;
};

/**
 * @param {Array} aParam
 * 
 * @return {Object}
 */
LinksUtils.parseFiles = function (aParam)
{
	var
		iIndex = 0,
		sStorage = 'personal',
		sPath = '',
		aPath = [],
		sName = '',
		sSearch = ''
	;

	if (Types.isNonEmptyArray(aParam))
	{
		if (aParam.length > iIndex && !IsPathParam(aParam[iIndex]))
		{
			sStorage = Types.pString(aParam[iIndex]);
			iIndex++;
		}
		
		if (aParam.length > iIndex && IsPathParam(aParam[iIndex]))
		{
			sPath = Types.pString(aParam[iIndex].substr(4));
			iIndex++;
		}
		
		if (sPath !== '')
		{
			aPath = _.without(sPath.split(/(?:\/|\$ZIP\:)/g), '');
			sName = aPath[aPath.length - 1];
		}
		
		if (aParam.length > iIndex)
		{
			sSearch = Types.pString(aParam[iIndex]);
		}
	}
	
	return {
		'Storage': sStorage,
		'Path': sPath,
		'PathParts': aPath,
		'Name': sName,
		'Search': sSearch
	};
};

module.exports = LinksUtils;
