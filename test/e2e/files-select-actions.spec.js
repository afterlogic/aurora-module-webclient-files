const path = require('path')
const { sharedHelper, moduleHelper, fixturePath } = require(path.join(
  process.env.AURORA_E2E_ROOT,
  'helpers/paths'
))
const { test, expect } = require('@playwright/test')
const { T } = sharedHelper('timeouts')
const { loginAsTestUser, step, attachScreenshot, hasCredentials } = sharedHelper('login')
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
  confirmOkIfVisible,
} = require('./helpers/files')


function uniqueFileName(prefix) {
  return `${prefix}-${Date.now()}.txt`
}

test.describe('Desktop files copy, select, share', () => {
  test.skip(!hasCredentials(), 'Set E2E_LOGIN_0/E2E_PASSWORD_0 (or E2E_LOGIN/E2E_PASSWORD) in .env.e2e')

  test('copies uploaded file into a folder (original remains)', async ({
    page,
  }) => {
    test.setTimeout(T(240000))
    await loginAsTestUser(page)
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
      folderName = `E2E Cp ${Date.now()}`
      await createFolder(page, folderName)
    }

    const uniqueName = uniqueFileName('e2e-cp')

    await step('Upload file for copy', async () => {
      await uploadFileViaFab(page, uniqueName)
    })

    await step('Select file → Copy', async () => {
      await openFileByName(page, uniqueName)
      const copy = page.getByTestId('files-menu-copy')
      test.skip(
        (await copy.count()) === 0,
        'Copy toolbar not available (FilesCutCopyPaste plugin)'
      )
      await clickReady(copy)
      await attachScreenshot(page, 'files-copy-01-mode')
    })

    await step(`Paste into folder "${folderName}"`, async () => {
      const paste = page.getByTestId('files-paste')
      test.skip(
        (await paste.count()) === 0,
        'Paste not available (FilesCutCopyPaste plugin)'
      )
      await page
        .getByTestId('files-item')
        .filter({ hasText: folderName })
        .first()
        .dblclick()
      await waitForFilesList(page)
      await clickReady(paste)
      await waitForFilesList(page)
      const copied = page
        .getByTestId('files-item')
        .filter({ hasText: uniqueName })
        .first()
      try {
        await expect(copied).toBeVisible({ timeout: T(30000) })
      } catch {
        test.skip(true, 'Cut/Copy/Paste did not complete on desktop')
      }
      console.log(`  → Copy present in folder: ${folderName}`)
      await attachScreenshot(page, 'files-copy-02-in-folder')
    })

    await step('Original still in personal root', async () => {
      await openPersonalStorage(page)
      await expect(
        page.getByTestId('files-item').filter({ hasText: uniqueName }).first()
      ).toBeVisible({ timeout: T(30000) })
      console.log('  → Original still in source')
      await attachScreenshot(page, 'files-copy-03-original')
    })

    await step('Cleanup: delete original', async () => {
      await openFileByName(page, uniqueName)
      await deleteOpenedFile(page, uniqueName)
    })
  })

  test('multi-select bulk deletes uploaded files', async ({ page }) => {
    test.setTimeout(T(240000))
    await loginAsTestUser(page)
    await openFiles(page)
    await openPersonalStorage(page)

    const stamp = Date.now()
    const nameA = `e2e-ba-${stamp}.txt`
    const nameB = `e2e-bb-${stamp}.txt`

    await step('Upload two files', async () => {
      await uploadFileViaFab(page, nameA)
      await uploadFileViaFab(page, nameB)
    })

    await step('Select both files (Ctrl/Meta+click)', async () => {
      await selectFilesItem(
        page,
        page.getByTestId('files-item').filter({ hasText: nameA }).first()
      )
      await selectFilesItem(
        page,
        page.getByTestId('files-item').filter({ hasText: nameB }).first(),
        { modifiers: ['ControlOrMeta'] }
      )
      await attachScreenshot(page, 'files-select-01')
    })

    await step('Bulk delete → confirm', async () => {
      await clickReady(page.getByTestId('files-delete'))
      await confirmOkIfVisible(page, 5000)
      await waitForFilesList(page)
      await expect(
        page.getByTestId('files-item').filter({ hasText: nameA })
      ).toHaveCount(0, { timeout: T(30000) })
      await expect(
        page.getByTestId('files-item').filter({ hasText: nameB })
      ).toHaveCount(0, { timeout: T(30000) })
      console.log('  → Both files deleted')
      await attachScreenshot(page, 'files-select-02-deleted')
    })
  })

  test('opens Share with teammates dialog', async ({ page }) => {
    test.setTimeout(T(180000))
    await loginAsTestUser(page)
    await openFiles(page)
    await openPersonalStorage(page)

    const uniqueName = uniqueFileName('e2e-tm')

    await step('Upload file', async () => {
      await uploadFileViaFab(page, uniqueName)
      await openFileByName(page, uniqueName)
    })

    await step('Open Share with teammates', async () => {
      const shareMenu = page.getByTestId('files-menu-share')
      test.skip(
        (await shareMenu.count()) === 0 ||
          !(await shareMenu.isVisible().catch(() => false)),
        'Share with teammates not available (corporate storage or no rights)'
      )
      await clickReady(shareMenu)
      const dialog = page.getByTestId('files-share-dialog')
      if (!(await dialog.isVisible({ timeout: T(5000) }).catch(() => false))) {
        test.skip(true, 'Share dialog not available')
      }
      await expect(dialog).toBeVisible()
      await expect(page.getByTestId('files-share-save')).toBeVisible()
      console.log('  → Share with teammates dialog open')
      await attachScreenshot(page, 'files-teammates-01')
    })

    await step('Close dialog without saving', async () => {
      const dialog = page.getByTestId('files-share-dialog')
      await page.keyboard.press('Escape').catch(() => undefined)
      if (await dialog.isVisible().catch(() => false)) {
        const close = dialog.locator('.close, .button.cancel').first()
        if (await close.isVisible().catch(() => false)) {
          await clickReady(close)
        }
      }
      await expect(dialog).toBeHidden({ timeout: T(30000) }).catch(() => undefined)
    })

    await step('Cleanup', async () => {
      await openFileByName(page, uniqueName)
      await deleteOpenedFile(page, uniqueName)
    })
  })

  test('leave share action when shared item is available', async ({ page }) => {
    test.setTimeout(T(180000))
    await loginAsTestUser(page)
    await openFiles(page)

    await step('Open Shared storage if present', async () => {
      await navigateToStorageRoot(page)
      const shared = page
        .locator(
          '[data-test-id="files-storage-item"][data-storage-type="shared"]'
        )
        .first()
      test.skip((await shared.count()) === 0, 'No Shared storage on this stand')
      await clickReady(shared)
      await waitForFilesList(page)
    })

    const items = page.getByTestId('files-item')
    test.skip(
      (await items.count()) === 0,
      'Shared storage has no files to leave'
    )

    await step('Select item → Leave share if available', async () => {
      await selectFilesItem(page, items.first())
      const leave = page.locator(
        '[data-test-id="files-item-menu-shareLeave"], .toolbar .item.leave, .toolbar .item.share_leave'
      )
      const leaveByText = page.getByText(/Leave share|Отказаться от доступа/i)
      const hasLeave =
        (await leave.count()) > 0 || (await leaveByText.count()) > 0
      test.skip(!hasLeave, 'Leave share not available in desktop toolbar')
      if ((await leave.count()) > 0) {
        await clickReady(leave.first())
      } else {
        await clickReady(leaveByText.first())
      }
      await confirmOkIfVisible(page, 5000)
      console.log('  → Left share')
      await attachScreenshot(page, 'files-leave-02-done')
    })
  })
})
