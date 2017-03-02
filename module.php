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
 * 
 * @package Modules
 */

namespace Aurora\Modules;

class FilesWebclientModule extends \Aurora\System\AbstractModule
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
		
		$aPaths = \Aurora\System\Service::GetPaths();
		$sHash = empty($aPaths[1]) ? '' : $aPaths[1];
		$bDownload = !(!empty($aPaths[2]) && $aPaths[2] === 'view');
		$bList = (!empty($aPaths[2]) && $aPaths[2] === 'list');
		
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
						if ($oCoreClientModule instanceof \Aurora\System\AbstractModule) 
						{
							$sResult = \file_get_contents($oCoreClientModule->GetPath().'/templates/Index.html');
							if (\is_string($sResult)) 
							{
								$sFrameOptions = \Aurora\System\Api::GetConf('labs.x-frame-options', '');
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
					$sUrl = (bool) \Aurora\System\Api::GetConf('labs.server-use-url-rewrite', false) ? '/download/' : '?/files-pub/';

					$sUrlRewriteBase = (string) \Aurora\System\Api::GetConf('labs.server-url-rewrite-base', '');
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
						$this->oFilesModuleDecorator->getUUIDById($aHash['UserId']), 
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
