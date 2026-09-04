const path = require('path')
const { sharedHelper, moduleHelper, fixturePath } = require(path.join(
  process.env.AURORA_E2E_ROOT,
  'helpers/paths'
))
const { test, expect } = require('@playwright/test')
const { T } = sharedHelper('timeouts')
const {
  gotoLoggedIn,
  step,
  attachScreenshot,
  hasCredentials,
  hasSecondaryCredentials,
  getSecondaryCredentials,
  openLoggedInPage,
} = sharedHelper('login')
const { clickReady } = sharedHelper('ready')
const {
  openFiles,
  waitForFilesList,
  uploadFileViaFab,
  openFileByName,
  deleteOpenedFile,
  selectFilesItem,
  openPersonalStorage,
  openSharedStorage,
  createFolder,
  confirmOkIfVisible,
  clickCutCopyPasteAction,
  clickShareToolbarAction,
  clickLeaveShareToolbarAction,
  filesShareDialog,
  shareFileWithTeammate,
  openFolderItemByName,
  pasteIntoCurrentFolder,
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
      folderName = `E2E Cp ${Date.now()}`
      await createFolder(page, folderName)
    }

    const uniqueName = uniqueFileName('e2e-cp')

    await step('Upload file for copy', async () => {
      await uploadFileViaFab(page, uniqueName)
    })

    await step('Select file → Copy', async () => {
      await openFileByName(page, uniqueName)
      await clickCutCopyPasteAction(page, 'files-menu-copy')
      await attachScreenshot(page, 'files-copy-01-mode')
    })

    await step(`Paste into folder "${folderName}"`, async () => {
      await openFolderItemByName(page, folderName)
      await pasteIntoCurrentFolder(page)
      const copied = page
        .getByTestId('files-item')
        .filter({ hasText: uniqueName })
        .first()
      await expect(copied).toBeVisible({ timeout: T(30000) })
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
    await gotoLoggedIn(page)
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
      // Re-select right before acting: selection/checked state can silently
      // drop between the earlier select step and this click (see
      // uploadFileViaFab), making deleteCommand's click a silent no-op.
      await selectFilesItem(
        page,
        page.getByTestId('files-item').filter({ hasText: nameA }).first()
      )
      await selectFilesItem(
        page,
        page.getByTestId('files-item').filter({ hasText: nameB }).first(),
        { modifiers: ['ControlOrMeta'] }
      )
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
    await gotoLoggedIn(page)
    await openFiles(page)
    await openPersonalStorage(page)

    const uniqueName = uniqueFileName('e2e-tm')

    await step('Upload file', async () => {
      await uploadFileViaFab(page, uniqueName)
    })

    await step('Open Share with teammates', async () => {
      await clickShareToolbarAction(page, { fileName: uniqueName })
      const dialog = filesShareDialog(page)
      await expect(dialog).toBeVisible({ timeout: T(15000) })
      const save = dialog
        .locator('[data-test-id="files-share-save"], .button:not(.secondary_button)')
        .first()
      await expect(save).toBeVisible({ timeout: T(10000) })
      console.log('  → Share with teammates dialog open')
      await attachScreenshot(page, 'files-teammates-01')
    })

    await step('Close dialog without saving', async () => {
      const dialog = filesShareDialog(page)
      await page.keyboard.press('Escape').catch(() => undefined)
      if (await dialog.isVisible().catch(() => false)) {
        const close = dialog.locator('.close, .button.cancel, [data-test-id="files-share-cancel"]').first()
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

  test('leave share action when shared item is available', async ({
    page,
    browser,
    baseURL,
  }) => {
    test.skip(
      !hasSecondaryCredentials(),
      'Set E2E_LOGIN_SECONDARY and E2E_PASSWORD_SECONDARY in .env.e2e'
    )
    test.setTimeout(T(300000))

    const uniqueName = uniqueFileName('e2e-leave')
    const secondaryEmail = getSecondaryCredentials().login

    await gotoLoggedIn(page)
    await openFiles(page)
    await openPersonalStorage(page)

    await step('PRIMARY uploads and shares with SECONDARY', async () => {
      await uploadFileViaFab(page, uniqueName)
      await openFileByName(page, uniqueName)
      await shareFileWithTeammate(page, secondaryEmail)
      await attachScreenshot(page, 'files-leave-01-shared')
    })

    const secondary = await openLoggedInPage(
      browser,
      getSecondaryCredentials(),
      { baseURL }
    )
    try {
      await step('SECONDARY leaves share', async () => {
        await openFiles(secondary.page)
        await openSharedStorage(secondary.page)
        const item = secondary.page
          .getByTestId('files-item')
          .filter({ hasText: uniqueName })
          .first()
        await expect(item).toBeVisible({ timeout: T(90000) })
        await selectFilesItem(secondary.page, item)
        await clickLeaveShareToolbarAction(secondary.page)
        await confirmOkIfVisible(secondary.page, 15000)
        await expect(
          secondary.page
            .getByTestId('files-item')
            .filter({ hasText: uniqueName })
        ).toHaveCount(0, { timeout: T(60000) })
        console.log('  → SECONDARY left share')
        await attachScreenshot(secondary.page, 'files-leave-02-done')
      })
    } finally {
      await secondary.context.close()
    }

    await step('Cleanup: PRIMARY deletes original file', async () => {
      await openPersonalStorage(page)
      await openFileByName(page, uniqueName)
      await deleteOpenedFile(page, uniqueName)
    })
  })
})
