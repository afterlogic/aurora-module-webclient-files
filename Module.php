<?php
/**
 * This code is licensed under AGPLv3 license or Afterlogic Software License
 * if commercial version of the product was purchased.
 * For full statements of the licenses see LICENSE-AFTERLOGIC and LICENSE-AGPL3 files.
 */

namespace Aurora\Modules\FilesWebclient;

use Aurora\System\Application;
use Aurora\System\Utils;

/**
 * This module displays the web interface for managing files.
 *
 * @license https://www.gnu.org/licenses/agpl-3.0.html AGPL-3.0
 * @license https://afterlogic.com/products/common-licensing Afterlogic Software License
 * @copyright Copyright (c) 2023, Afterlogic Corp.
 *
 * @property Settings $oModuleSettings
 *
 * @package Modules
 */
class Module extends \Aurora\System\Module\AbstractWebclientModule
{
    /**
     *
     * @var \Aurora\Modules\Min\Module
     */
    protected $oMinModuleDecorator = null;

    /**
     *
     * @var \Aurora\Modules\Files\Module
     */
    protected $oFilesModuleDecorator = null;

    /**
     * @var array
     */
    protected $aRequireModules = ['Files', 'Min'];

    /***** private functions *****/
    /**
     * Initializes Files Module.
     *
     * @ignore
     */
    public function init()
    {
        $this->oFilesModuleDecorator = \Aurora\Modules\Files\Module::Decorator();
        $this->oMinModuleDecorator = \Aurora\Modules\Min\Module::Decorator();

        $this->AddEntry('files-pub', 'EntryPub');
    }

    /**
     * @return Module
     */
    public static function getInstance()
    {
        return parent::getInstance();
    }

    /**
     * @return Module
     */
    public static function Decorator()
    {
        return parent::Decorator();
    }

    /**
     * @return Settings
     */
    public function getModuleSettings()
    {
        return $this->oModuleSettings;
    }

    /***** private functions *****/

    /***** public functions *****/
    /**
     * @ignore
     */
    public function EntryPub()
    {
        \Aurora\System\Api::checkUserRoleIsAtLeast(\Aurora\System\Enums\UserRole::Anonymous);
        $sResult = '';
        try {
            $sHash = (string) \Aurora\System\Router::getItemByIndex(1, '');
            $sAction = (string) \Aurora\System\Router::getItemByIndex(2, 'download');
            $bSecure = \Aurora\System\Router::getItemByIndex(3, '') === 'secure';
            $bList = (!empty($sAction) && $sAction === 'list');
            $sPassword = $bSecure ? rawurldecode(\Aurora\System\Router::getItemByIndex(4, '')) : '';
            $aHash = $this->oMinModuleDecorator->GetMinByHash($sHash);

            $sType = isset($aHash['Type']) ? $aHash['Type'] : '';
            $sPath = isset($aHash['Path']) ? $aHash['Path'] : '';
            $sName = isset($aHash['Name']) ? $aHash['Name'] : '';
            $sFullPath = \ltrim($sPath, '/') . '/' . \ltrim($sName, '/');
            $sResourceId = $sType . '/' . \ltrim($sFullPath, '/');
            if (isset($aHash['UserId'])) {
                $aArgs = [
                    'UserId' => $aHash['UserId'],
                    'ResourceType' => 'file',
                    'ResourceId' => $sResourceId,
                    'Action' => $sAction
                ];
                $this->broadcastEvent('AddToActivityHistory', $aArgs);
            }

            if ($bList) {
                if ($this->oMinModuleDecorator) {
                    $mResult = null;

                    $this->broadcastEvent(
                        'FileEntryPub',
                        $aHash,
                        $mResult
                    );

                    if ($mResult) {
                        $sResult = $mResult;
                    } else {
                        if (\is_array($aHash) && isset($aHash['IsFolder']) && $aHash['IsFolder']) {
                            $oApiIntegrator = \Aurora\System\Managers\Integrator::getInstance();

                            if ($oApiIntegrator) {
                                $oCoreClientModule = \Aurora\System\Api::GetModule('CoreWebclient');
                                if ($oCoreClientModule instanceof \Aurora\System\Module\AbstractModule) {
                                    $sResult = \file_get_contents($oCoreClientModule->GetPath() . '/templates/Index.html');
                                    if (\is_string($sResult)) {
                                        $oSettings = &\Aurora\System\Api::GetSettings();
                                        $sFrameOptions = $oSettings->XFrameOptions;
                                        if (0 < \strlen($sFrameOptions)) {
                                            @\header('X-Frame-Options: ' . $sFrameOptions);
                                        }

                                        $aConfig = array(
                                            'public_app' => true,
                                            'modules_list' => $oApiIntegrator->GetModulesForEntry('FilesWebclient')
                                        );

                                        $sResult = \strtr($sResult, array(
                                            '{{AppVersion}}' => Application::GetVersion(),
                                            '{{IntegratorDir}}' => $oApiIntegrator->isRtl() ? 'rtl' : 'ltr',
                                            '{{IntegratorLinks}}' => $oApiIntegrator->buildHeadersLink(),
                                            '{{IntegratorBody}}' => $oApiIntegrator->buildBody($aConfig)
                                        ));
                                    }
                                }
                            }
                        } elseif ($aHash && isset($aHash['__hash__'], $aHash['Name'], $aHash['Size'])) {
                            $sUrl = (bool) $this->oModuleSettings->ServerUseUrlRewrite ? '/download/' : '?/files-pub/';

                            $sUrlRewriteBase = (string) $this->oModuleSettings->ServerUrlRewriteBase;
                            if (!empty($sUrlRewriteBase)) {
                                $sUrlRewriteBase = '<base href="' . $sUrlRewriteBase . '" />';
                            }

                            $oModuleManager = \Aurora\System\Api::GetModuleManager();
                            $sTheme = $oModuleManager->getModuleConfigValue('CoreWebclient', 'Theme');
                            $sResult = \file_get_contents($this->GetPath() . '/templates/FilesPub.html');
                            if (\is_string($sResult)) {
                                $sResult = \strtr($sResult, array(
                                    '{{Url}}' => $sUrl . $aHash['__hash__'],
                                    '{{FileName}}' => $aHash['Name'],
                                    '{{FileSize}}' => Utils::GetFriendlySize($aHash['Size']),
                                    '{{FileType}}' => Utils::GetFileExtension($aHash['Name']),
                                    '{{BaseUrl}}' => $sUrlRewriteBase,
                                    '{{Theme}}' => $sTheme,
                                ));
                            } else {
                                \Aurora\System\Api::Log('Empty template.', \Aurora\System\Enums\LogLevel::Error);
                            }
                        } else {
                            throw new \Aurora\System\Exceptions\ApiException(
                                \Aurora\System\Notifications::MethodAccessDenied
                            );
                        }
                    }
                }
            } else {
                \header('Cache-Control: no-cache', true);
                if ($this->oMinModuleDecorator) {
                    if (isset($aHash['__hash__'])
                        && ((isset($aHash['IsFolder']) && (bool) $aHash['IsFolder'] === false) || !isset($aHash['IsFolder']))
                        && (!isset($aHash['Password']) || (isset($aHash['Password']) && $sPassword && Utils::EncryptValue($sPassword) === $aHash['Password']))
                        && isset($aHash['Type']) && isset($aHash['Path']) && isset($aHash['Name'])
                    ) {
                        $bskipCheckUserRoleStatus = \Aurora\Api::skipCheckUserRole(true);
                        $this->oFilesModuleDecorator->getRawFile(
                            null,
                            $aHash['Type'],
                            $aHash['Path'],
                            $aHash['Name'],
                            $sHash,
                            $sAction
                        );
                        \Aurora\Api::skipCheckUserRole($bskipCheckUserRoleStatus);
                        $aArgs = [
                            'UserId' => $aHash['UserId'],
                            'ResourceType' => 'file',
                            'ResourceId' => $sResourceId,
                            'Action' => $sAction . '-finish'
                        ];
                        $this->broadcastEvent('AddToActivityHistory', $aArgs);
                    } else {
                        $aArgs = [
                            'UserId' => $aHash['UserId'],
                            'ResourceType' => 'file',
                            'ResourceId' => $sResourceId,
                            'Action' => 'wrong-password'
                        ];
                        $this->broadcastEvent('AddToActivityHistory', $aArgs);

                        throw new \Aurora\System\Exceptions\ApiException(
                            \Aurora\System\Notifications::MethodAccessDenied
                        );
                    }
                }
            }
        } catch (\Aurora\System\Exceptions\ApiException $oEx) {
            $oModuleManager = \Aurora\System\Api::GetModuleManager();
            $sTheme = $oModuleManager->getModuleConfigValue('CoreWebclient', 'Theme');
            $sResult = \file_get_contents($this->GetPath() . '/templates/NotFound.html');
            $sResult = \strtr($sResult, array(
                '{{NotFound}}' => $this->i18N('INFO_NOTFOUND'),
                '{{Theme}}' => $sTheme,
            ));

            \Aurora\Api::LogException($oEx);
        }

        \Aurora\Modules\CoreWebclient\Module::Decorator()->SetHtmlOutputHeaders();
        return $sResult;
    }

    public function GetSettings()
    {
        \Aurora\System\Api::checkUserRoleIsAtLeast(\Aurora\System\Enums\UserRole::Anonymous);

        $aModuleSettings = array(
            'EditFileNameWithoutExtension' => $this->oModuleSettings->EditFileNameWithoutExtension,
            'ShowCommonSettings' => $this->oModuleSettings->ShowCommonSettings,
            'ServerUrlRewriteBase' => $this->oModuleSettings->ServerUrlRewriteBase,
            'ServerUseUrlRewrite' => $this->oModuleSettings->ServerUseUrlRewrite,
            'ShowFilesApps' => $this->oModuleSettings->ShowFilesApps,
            'BottomLeftCornerLinks' => $this->oModuleSettings->BottomLeftCornerLinks,
            'PublicLinksEnabled' => $this->oModuleSettings->PublicLinksEnabled,
            'FilesSortBy' => $this->oModuleSettings->FilesSortBy
        );

        return $aModuleSettings;
    }
}
