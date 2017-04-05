<?php
/**
 * @copyright Copyright (c) 2017, Afterlogic Corp.
 * @license AGPL-3.0
 *
 * This code is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License, version 3,
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License, version 3,
 * along with this program.  If not, see <http://www.gnu.org/licenses/>
 */

namespace Aurora\Modules\FilesWebclient;

/**
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

	/***** private functions *****/
	/**
	 * Initializes Files Module.
	 * 
	 * @ignore
	 */
	public function init() 
	{
		$this->oFilesModuleDecorator = \Aurora\System\Api::GetModuleDecorator('Files');
		$this->oMinModuleDecorator = \Aurora\System\Api::GetModuleDecorator('Min');
		
		$this->AddEntry('files-pub', 'EntryPub');
	}

	/***** private functions *****/
	
	/***** public functions *****/
	/**
	 * @ignore
	 */
	public function EntryPub()
	{
		\Aurora\System\Api::checkUserRoleIsAtLeast(\EUserRole::Anonymous);
		
		$sHash = (string) \Aurora\System\Application::GetPathItemByIndex(1, '');
		$sAction = (string) \Aurora\System\Application::GetPathItemByIndex(2, '');
		
		$bDownload = !(!empty($sAction) && $sAction === 'view');
		$bList = (!empty($sAction) && $sAction === 'list');
		
		if ($bList)
		{
			$sResult = '';
			if ($this->oMinModuleDecorator)
			{
				$mData = $this->oMinModuleDecorator->GetMinByHash($sHash);

				if (\is_array($mData) && isset($mData['IsFolder']) && $mData['IsFolder'])
				{
					$oApiIntegrator = \Aurora\System\Api::GetSystemManager('integrator');

					if ($oApiIntegrator)
					{
						$oCoreClientModule = \Aurora\System\Api::GetModule('CoreWebclient');
						if ($oCoreClientModule instanceof \Aurora\System\Module\AbstractModule) 
						{
							$sResult = \file_get_contents($oCoreClientModule->GetPath().'/templates/Index.html');
							if (\is_string($sResult)) 
							{
								$oSettings =& \Aurora\System\Api::GetSettings();
								$sFrameOptions = $oSettings->GetConf('XFrameOptions', '');
								if (0 < \strlen($sFrameOptions)) 
								{
									@\header('X-Frame-Options: '.$sFrameOptions);
								}
								
								$aConfig = array(
									'public_app' => true,
									'modules_list' => array("FilesWebclient")
								);

								$sResult = \strtr($sResult, array(
									'{{AppVersion}}' => AURORA_APP_VERSION,
									'{{IntegratorDir}}' => $oApiIntegrator->isRtl() ? 'rtl' : 'ltr',
									'{{IntegratorLinks}}' => $oApiIntegrator->buildHeadersLink(),
//									'{{IntegratorBody}}' => $oApiIntegrator->buildBody('-files-pub')
									'{{IntegratorBody}}' => $oApiIntegrator->buildBody($aConfig)
								));
							}
						}
					}
				}
				else if ($mData && isset($mData['__hash__'], $mData['Name'], $mData['Size']))
				{
					$sUrl = (bool) $this->getConfig('ServerUseUrlRewrite', false) ? '/download/' : '?/files-pub/';

					$sUrlRewriteBase = (string) $this->getConfig('ServerUrlRewriteBase', '');
					if (!empty($sUrlRewriteBase))
					{
						$sUrlRewriteBase = '<base href="'.$sUrlRewriteBase.'" />';
					}

					$sResult = \file_get_contents($this->oFilesModuleDecorator->GetPath().'/templates/FilesPub.html');
					if (\is_string($sResult))
					{
						$sResult = \strtr($sResult, array(
							'{{Url}}' => $sUrl.$mData['__hash__'], 
							'{{FileName}}' => $mData['Name'],
							'{{FileSize}}' => \Aurora\System\Utils::GetFriendlySize($mData['Size']),
							'{{FileType}}' => \Aurora\System\Utils::GetFileExtension($mData['Name']),
							'{{BaseUrl}}' => $sUrlRewriteBase 
						));
					}
					else
					{
						\Aurora\System\Api::Log('Empty template.', \ELogLevel::Error);
					}
				}
				else 
				{
					$sResult = \file_get_contents($this->oFilesModuleDecorator->GetPath().'/templates/NotFound.html');
					$sResult = \strtr($sResult, array(
						'{{NotFound}}' => $this->oFilesModuleDecorator->i18N('INFO_NOTFOUND')
					));
				}
			}

			return $sResult;
		}
		else
		{
			if ($this->oMinModuleDecorator)
			{
				$aHash = $this->oMinModuleDecorator->GetMinByHash($sHash);

				if (isset($aHash['__hash__']) && ((isset($aHash['IsFolder']) && (bool) $aHash['IsFolder'] === false) || !isset($aHash['IsFolder'])))
				{
					echo $this->oFilesModuleDecorator->getRawFile(
						\Aurora\System\Api::getUserUUIDById($aHash['UserId']), 
						$aHash['Type'], 
						$aHash['Path'], 
						$aHash['Name'], 
						$sHash, 
						$bDownload
					);
				}
				else 
				{
					$sResult = \file_get_contents($this->oFilesModuleDecorator->GetPath().'/templates/NotFound.html');
					$sResult = \strtr($sResult, array(
						'{{NotFound}}' => $this->oFilesModuleDecorator->i18N('INFO_NOTFOUND')
					));

					return $sResult;
				}
			}
		}
	}
}
