<?php
/**
 * This code is licensed under AGPLv3 license or Afterlogic Software License
 * if commercial version of the product was purchased.
 * For full statements of the licenses see LICENSE-AFTERLOGIC and LICENSE-AGPL3 files.
 */

namespace Aurora\Modules\FilesWebclient;

use Aurora\System\SettingsProperty;

/**
 * @property bool $Disabled
 * @property bool $EditFileNameWithoutExtension
 * @property bool $ShowCommonSettings
 * @property bool $ServerUrlRewriteBase
 * @property bool $ServerUseUrlRewrite
 * @property bool $ShowFilesApps
 * @property array $BottomLeftCornerLinks
 * @property array $AvailableFor
 * @property bool $PublicLinksEnabled
 * @property array $FilesSortBy
 * @property string $CustomTabTitle
 */

class Settings extends \Aurora\System\Module\Settings
{
    protected function initDefaults()
    {
        $this->aContainer = [
            "Disabled" => new SettingsProperty(
                false,
                "bool",
                null,
                "Setting to true disables the module",
            ),
            "EditFileNameWithoutExtension" => new SettingsProperty(
                false,
                "bool",
                null,
                "If true, only filename can be changed when renaming file while extension is kept intact",
            ),
            "ShowCommonSettings" => new SettingsProperty(
                false,
                "bool",
                null,
                "If true, allow for changing basic settings of files functionality, such as enabling table view and preview pane",
            ),
            "ServerUrlRewriteBase" => new SettingsProperty(
                false,
                "bool",
                null,
                "Used for providing short URLs e.g. for file downloads, requires supplying rewrite rules in webserver config",
            ),
            "ServerUseUrlRewrite" => new SettingsProperty(
                false,
                "bool",
                null,
                "Rewrite base for short URLs",
            ),
            "ShowFilesApps" => new SettingsProperty(
                true,
                "bool",
                null,
                "Enables displaying information on desktop and mobile file storage apps in Files tab of Settings screen",
            ),
            "BottomLeftCornerLinks" => new SettingsProperty(
                [],
                "array",
                null,
                "Defines custom links shown at the bottom of left pane in Files",
            ),
            "AvailableFor" => new SettingsProperty(
                [
                    "MailWebclient"
                ],
                "array",
                null,
                "Automatically provide this feature if one of the listed modules is requested by the entry point",
            ),
            "PublicLinksEnabled" => new SettingsProperty(
                true,
                "bool",
                null,
                "If true, allows for creating basic Public links in addition to secure ones",
            ),
            "FilesSortBy" => new SettingsProperty(
                [
                    "Allow" => false,
                    "DisplayOptions" => [
                        "Filename",
                        "Size",
                        "Modified"
                    ],
                    "DefaultSortBy" => "Filename",
                    "DefaultSortOrder" => "Asc"
                ],
                "array",
                null,
                "Defines a set of rules for sorting files and folders. Filename|Size|Modified. DefaultSortOrder - Asc|Desc"
            ),
            "CustomTabTitle" => new SettingsProperty(
                "",
                "string",
                null,
                "The value will be used as the tab title in the web UI",
            ),
        ];
    }
}
