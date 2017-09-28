'use strict';

var
	_ = require('underscore'),
	
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js'),
	
	Settings = require('modules/%ModuleName%/js/Settings.js'),
	
	sSrchPref = 's.',
	sPthPref = 'p.',
	
	LinksUtils = {}
;

/**
 * Returns true if parameter contains path value.
 * @param {string} sTemp
 * @return {boolean}
 */
function IsPathParam(sTemp)
{
	return (sPthPref === sTemp.substr(0, sPthPref.length));
};

/**
 * Returns true if parameter contains search value.
 * @param {string} sTemp
 * @return {boolean}
 */
function IsSearchParam(sTemp)
{
	return (sSrchPref === sTemp.substr(0, sSrchPref.length));
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
		aParams.push(sPthPref + sPath);
	}
	
	if (sSearch && sSearch !== '')
	{
		aParams.push(sSrchPref + sSearch);
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
			sPath = Types.pString(aParam[iIndex].substr(sPthPref.length));
			iIndex++;
		}
		
		if (aParam.length > iIndex && IsSearchParam(aParam[iIndex]))
		{
			sSearch = Types.pString(aParam[iIndex].substr(sSrchPref.length));
		}
	}
	
	return LinksUtils.getParsedParams(sStorage, sPath, sSearch);
};

LinksUtils.getParsedParams = function (sStorage, sPath, sSearch)
{
	var
		aPath = [],
		sName = ''
	;
	
	if (Types.isNonEmptyString(sPath))
	{
		aPath = _.without(sPath.split(/(?:\/|\$ZIP\:)/g), '');
		sName = aPath[aPath.length - 1];
	}
	else
	{
		sPath = '';
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
