'use strict';

var
	_ = require('underscore'),
	Enums = {}
;

/**
 * @enum {number}
 */
Enums.FileStorageType = {
	'Personal': 'personal',
	'Corporate': 'corporate',
	'Shared': 'shared',
	'GoogleDrive': 'google',
	'Dropbox': 'dropbox',
	'Encrypted': 'encrypted'
};

/**
 * @enum {number}
 */
Enums.FileStorageLinkType = {
	'Unknown': 0,
	'GoogleDrive': 1,
	'Dropbox': 2,
	'YouTube': 3,
	'Vimeo': 4,
	'SoundCloud': 5
};

/**
 * @enum {number}
 */
Enums.SharedFileAccess = {
	'NoAccess': 0,
	'Write': 1,
	'Read': 2,
	'Reshare': 3
};

if (typeof window.Enums === 'undefined')
{
	window.Enums = {};
}

_.extendOwn(window.Enums, Enums);