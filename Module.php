<?php
/**
 * This code is licensed under AGPLv3 license or Afterlogic Software License
 * if commercial version of the product was purchased.
 * For full statements of the licenses see LICENSE-AFTERLOGIC and LICENSE-AGPL3 files.
 */

namespace Aurora\Modules\FilesWebclient;

/**
 * This module displays the web interface for managing files.
 *
 * @license https://www.gnu.org/licenses/agpl-3.0.html AGPL-3.0
 * @license https://afterlogic.com/products/common-licensing Afterlogic Software License
 * @copyright Copyright (c) 2020, Afterlogic Corp.
 *
 * @package Modules
 */
class Module extends \Aurora\System\Module\AbstractWebclientModule
{
	/**
	 *
	 * @var \CApiModuleDecorator
	 */
	protected $oMinModuleDecorator = null;

	/**
	 *
	 * @var \CApiModuleDecorator
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

	/***** private functions *****/

	/***** public functions *****/
	/**
	 * @ignore
	 */
	public function EntryPub()
	{
		\Aurora\System\Api::checkUserRoleIsAtLeast(\Aurora\System\Enums\UserRole::Anonymous);

		$sHash = (string) \Aurora\System\Router::getItemByIndex(1, '');
		$sAction = (string) \Aurora\System\Router::getItemByIndex(2, 'download');
		$bSecure = \Aurora\System\Router::getItemByIndex(3, '') === 'secure';
		$bDownload = !(!empty($sAction) && $sAction === 'view');
		$bList = (!empty($sAction) && $sAction === 'list');
		$sPassword = $bSecure ? rawurldecode(\Aurora\System\Router::getItemByIndex(4, '')) : '';
		$aHash = $this->oMinModuleDecorator->GetMinByHash($sHash);

		$sType = isset($aHash['Type']) ? $aHash['Type'] : '';
		$sPath = isset($aHash['Path']) ? $aHash['Path'] : '';
		$sName = isset($aHash['Name']) ? $aHash['Name'] : '';
		$sFullPath = \ltrim($sPath, '/') . '/' . \ltrim($sName, '/');
		$sResourceId = $sType . '/' . \ltrim($sFullPath, '/');
		$aArgs = [
			'UserId' => $aHash['UserId'],
			'ResourceType' => 'file',
			'ResourceId' => $sResourceId,
			'Action' => $sAction
		];
		$this->broadcastEvent('AddToActivityHistory', $aArgs);

		if ($bList)
		{
			$sResult = '';
			if ($this->oMinModuleDecorator)
			{
				$mResult = null;
				$this->broadcastEvent(
					'FileEntryPub',
					$aHash,
					$mResult
				);
				if ($mResult)
				{
					$sResult = $mResult;
				}
				else
				{
					if (\is_array($aHash) && isset($aHash['IsFolder']) && $aHash['IsFolder'])
					{
						$oApiIntegrator = \Aurora\System\Managers\Integrator::getInstance();

						if ($oApiIntegrator)
						{
							$oCoreClientModule = \Aurora\System\Api::GetModule('CoreWebclient');
							if ($oCoreClientModule instanceof \Aurora\System\Module\AbstractModule)
							{
								$sResult = \file_get_contents($oCoreClientModule->GetPath().'/templates/Index.html');
								if (\is_string($sResult))
								{
									$oSettings =& \Aurora\System\Api::GetSettings();
									$sFrameOptions = $oSettings->GetValue('XFrameOptions', '');
									if (0 < \strlen($sFrameOptions))
									{
										@\header('X-Frame-Options: '.$sFrameOptions);
									}

									$aConfig = array(
										'public_app' => true,
										'modules_list' => $oApiIntegrator->GetModulesForEntry('FilesWebclient')
									);

									$sResult = \strtr($sResult, array(
										'{{AppVersion}}' => AU_APP_VERSION,
										'{{IntegratorDir}}' => $oApiIntegrator->isRtl() ? 'rtl' : 'ltr',
										'{{IntegratorLinks}}' => $oApiIntegrator->buildHeadersLink(),
										'{{IntegratorBody}}' => $oApiIntegrator->buildBody($aConfig)
									));
								}
							}
						}
					}
					else if ($aHash && isset($aHash['__hash__'], $aHash['Name'], $aHash['Size']))
					{
						$sUrl = (bool) $this->getConfig('ServerUseUrlRewrite', false) ? '/download/' : '?/files-pub/';

						$sUrlRewriteBase = (string) $this->getConfig('ServerUrlRewriteBase', '');
						if (!empty($sUrlRewriteBase))
						{
							$sUrlRewriteBase = '<base href="'.$sUrlRewriteBase.'" />';
						}

						$oModuleManager = \Aurora\System\Api::GetModuleManager();
						$sTheme = $oModuleManager->getModuleConfigValue('CoreWebclient', 'Theme');
						$sResult = \file_get_contents($this->GetPath().'/templates/FilesPub.html');
						if (\is_string($sResult))
						{
							$sResult = \strtr($sResult, array(
								'{{Url}}' => $sUrl.$aHash['__hash__'],
								'{{FileName}}' => $aHash['Name'],
								'{{FileSize}}' => \Aurora\System\Utils::GetFriendlySize($aHash['Size']),
								'{{FileType}}' => \Aurora\System\Utils::GetFileExtension($aHash['Name']),
								'{{BaseUrl}}' => $sUrlRewriteBase,
								'{{Theme}}' => $sTheme,
							));
						}
						else
						{
							\Aurora\System\Api::Log('Empty template.', \Aurora\System\Enums\LogLevel::Error);
						}
					}
					else
					{
						$oModuleManager = \Aurora\System\Api::GetModuleManager();
						$sTheme = $oModuleManager->getModuleConfigValue('CoreWebclient', 'Theme');
						$sResult = \file_get_contents($this->GetPath().'/templates/NotFound.html');
						$sResult = \strtr($sResult, array(
							'{{NotFound}}' => $this->oFilesModuleDecorator->i18N('INFO_NOTFOUND'),
							'{{Theme}}' => $sTheme,
						));
					}
				}
			}

			\Aurora\Modules\CoreWebclient\Module::Decorator()->SetHtmlOutputHeaders();
			return $sResult;
		}
		else
		{
			\header('Cache-Control: no-cache', true);
			if ($this->oMinModuleDecorator)
			{
				if (isset($aHash['__hash__'])
					&& ((isset($aHash['IsFolder']) && (bool) $aHash['IsFolder'] === false) || !isset($aHash['IsFolder']))
					&& (
						(
							isset($aHash['Password'])
							&& $sPassword
							&& \Aurora\System\Utils::EncryptValue($sPassword) === $aHash['Password']
						)
						|| !isset($aHash['Password'])
					)
					&& isset($aHash['Type']) && isset($aHash['Path']) && isset($aHash['Name'])
				)
				{
					$bskipCheckUserRoleStatus = \Aurora\Api::skipCheckUserRole(true);
					echo $this->oFilesModuleDecorator->getRawFile(
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
				}
				else
				{
					$aArgs = [
						'UserId' => $aHash['UserId'],
						'ResourceType' => 'file',
						'ResourceId' => $sResourceId,
						'Action' => 'wrong-password'
					];
					$this->broadcastEvent('AddToActivityHistory', $aArgs);

					$sResult = \file_get_contents($this->GetPath().'/templates/NotFound.html');
					$sResult = \strtr($sResult, array(
						'{{NotFound}}' => $this->oFilesModuleDecorator->i18N('INFO_NOTFOUND')
					));

					\Aurora\Modules\CoreWebclient\Module::Decorator()->SetHtmlOutputHeaders();
					return $sResult;
				}
			}
		}
	}

	public function GetSettings()
	{
		\Aurora\System\Api::checkUserRoleIsAtLeast(\Aurora\System\Enums\UserRole::Anonymous);

		$aModuleSettings = array(
			'EditFileNameWithoutExtension' => $this->getConfig('EditFileNameWithoutExtension', false),
			'ShowCommonSettings' => $this->getConfig('ShowCommonSettings', false),
			'ServerUrlRewriteBase' => $this->getConfig('ServerUrlRewriteBase', false),
			'ServerUseUrlRewrite' => $this->getConfig('ServerUseUrlRewrite', false),
			'ShowFilesApps' => $this->getConfig('ShowFilesApps', true),
			'BottomLeftCornerLinks' => $this->getConfig('BottomLeftCornerLinks', []),
			'PublicLinksEnabled' => $this->getConfig('PublicLinksEnabled', true)
		);

		return $aModuleSettings;
	}
}
