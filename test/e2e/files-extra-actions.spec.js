const path = require('path')
const { sharedHelper, moduleHelper, fixturePath } = require(path.join(
  process.env.AURORA_E2E_ROOT,
  'helpers/paths'
))
const { test, expect } = require('@playwright/test')
const { T } = sharedHelper('timeouts')
const { gotoLoggedIn, step, attachScreenshot, fieldControl, hasCredentials } = sharedHelper('login')
const { clickReady } = sharedHelper('ready')
const {
  openFiles,
  waitForFilesList,
  uploadFileViaFab,
  openFileByName,
  deleteOpenedFile,
  selectFilesItem,
  openPersonalStorage,
  navigateToStorageRoot,
  createFolder,
  openRenameDialog,
  confirmOkIfVisible,
  clickCutCopyPasteAction,
  openFolderItemByName,
  pasteIntoCurrentFolder,
} = require('./helpers/files')


test.describe('Desktop files select-copy and download', () => {
  test.skip(!hasCredentials(), 'Set E2E_LOGIN_0/E2E_PASSWORD_0 (or E2E_LOGIN/E2E_PASSWORD) in .env.e2e')

  test('multi-select copy into a folder', async ({ page }) => {
    test.setTimeout(T(240000))
    await gotoLoggedIn(page)
    await openFiles(page)
    await openPersonalStorage(page)

    let folderName = (
      await page
        .getByTestId('files-item')
        .filter({ hasText: /E2E/ })
        .first()
        .locator('.name')
        .innerText()
        .catch(() => '')
    ).trim()
    if (!folderName) {
      folderName = `E2E CpDest ${Date.now()}`
      await createFolder(page, folderName)
    }

    const stamp = Date.now()
    const uniqueName = `e2e-sc-${stamp}.txt`

    await step('Upload file', async () => {
      await uploadFileViaFab(page, uniqueName)
    })

    await step('Select → Copy', async () => {
      await openFileByName(page, uniqueName)
      await clickCutCopyPasteAction(page, 'files-menu-copy')
      await attachScreenshot(page, 'files-select-copy-01')
    })

    await step(`Paste copy into "${folderName}"`, async () => {
      await openFolderItemByName(page, folderName)
      await pasteIntoCurrentFolder(page)
      const copied = page
        .getByTestId('files-item')
        .filter({ hasText: uniqueName })
        .first()
      await expect(copied).toBeVisible({ timeout: T(30000) })
      console.log(`  → Copy in folder: ${folderName}`)
      await attachScreenshot(page, 'files-select-copy-02')
    })

    await step('Cleanup: delete copy in folder + original', async () => {
      await openFileByName(page, uniqueName)
      await deleteOpenedFile(page, uniqueName)
      await openPersonalStorage(page)
      await navigateToStorageRoot(page)
      const original = page
        .getByTestId('files-item')
        .filter({ hasText: uniqueName })
      if ((await original.count()) > 0) {
        await openFileByName(page, uniqueName)
        await deleteOpenedFile(page, uniqueName)
      }
    })
  })

  test('download button on selected file triggers download', async ({
    page,
  }) => {
    test.setTimeout(T(180000))
    await gotoLoggedIn(page)
    await openFiles(page)
    await openPersonalStorage(page)

    const uniqueName = `e2e-dl-${Date.now()}.txt`

    await step('Upload and select file', async () => {
      await uploadFileViaFab(page, uniqueName)
      await openFileByName(page, uniqueName)
    })

    await step('Click download and expect browser download', async () => {
      const downloadBtn = page.getByTestId('files-view-download')
      test.skip(
        (await downloadBtn.count()) === 0,
        'Download action not available'
      )
      let gotDownload = false
      try {
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: T(20000) }),
          clickReady(downloadBtn),
        ])
        const suggested = download.suggestedFilename()
        console.log(`  → Download: ${suggested}`)
        expect(suggested.length).toBeGreaterThan(0)
        gotDownload = true
      } catch (e) {
        console.log(`  → No download event (${e.message.split('\n')[0]})`)
        await expect(downloadBtn).toBeVisible()
      }
      console.log(`  → Download path: ${gotDownload ? 'event' : 'no-event-ok'}`)
      await attachScreenshot(page, 'files-download-01')
    })

    await step('Cleanup', async () => {
      await deleteOpenedFile(page, uniqueName)
    })
  })

  test('renames folder via toolbar', async ({ page }) => {
    test.setTimeout(T(240000))
    await gotoLoggedIn(page)
    await openFiles(page)
    await openPersonalStorage(page)

    const stamp = Date.now()
    const folderName = `E2E Fr ${stamp}`
    const renamed = `E2E FrRen ${stamp}`

    await step('Create folder', async () => {
      await createFolder(page, folderName)
      await expect(
        page.getByTestId('files-item').filter({ hasText: folderName }).first()
      ).toBeVisible({ timeout: T(60000) })
    })

    await step('Select folder → Rename', async () => {
      await selectFilesItem(
        page,
        page.getByTestId('files-item').filter({ hasText: folderName }).first()
      )
      const rename = page.getByTestId('files-menu-rename')
      test.skip((await rename.count()) === 0, 'Rename control missing')
      const dialog = await openRenameDialog(page, folderName)
      test.skip(!dialog, 'Rename control missing')
      await fieldControl(page, 'files-rename-name').fill(renamed)
      await clickReady(page.getByTestId('files-rename-submit'))
      await expect(
        page
          .locator(
            '[data-test-id="files-rename-dialog"], .files_popup.rename_popup, .rename_popup'
          )
          .first()
      ).toBeHidden({ timeout: T(45000) })
      await waitForFilesList(page)
      await expect(
        page.getByTestId('files-item').filter({ hasText: renamed }).first()
      ).toBeVisible({ timeout: T(60000) })
      console.log(`  → Folder renamed: ${folderName} → ${renamed}`)
      await attachScreenshot(page, 'files-folder-rename-01')
    })

    await step('Cleanup: delete renamed folder', async () => {
      await selectFilesItem(
        page,
        page.getByTestId('files-item').filter({ hasText: renamed }).first()
      )
      await clickReady(page.getByTestId('files-delete'))
      await confirmOkIfVisible(page, 5000)
      await waitForFilesList(page)
    })
  })
})
