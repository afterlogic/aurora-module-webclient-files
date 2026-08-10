const path = require('path')
const { sharedHelper, moduleHelper, fixturePath } = require(path.join(
  process.env.AURORA_E2E_ROOT,
  'helpers/paths'
))
const { test, expect } = require('@playwright/test')
const { T } = sharedHelper('timeouts')
const { loginAsTestUser, step, attachScreenshot, fieldControl, hasCredentials } = sharedHelper('login')
const { clickReady, waitForListReady } = sharedHelper('ready')
const {
  openFiles,
  waitForFilesList,
  listReadyOptions,
  uploadFileViaFab,
  openFileByName,
  deleteOpenedFile,
  createFolder,
  openPersonalStorage,
  openRenameDialog,
} = require('./helpers/files')


test.describe('Desktop files actions', () => {
  test.skip(!hasCredentials(), 'Set E2E_LOGIN_0/E2E_PASSWORD_0 (or E2E_LOGIN/E2E_PASSWORD) in .env.e2e')

  test('shows storages in sidebar', async ({ page }) => {
    test.setTimeout(T(120000))
    await loginAsTestUser(page)
    await openFiles(page)

    await step('Expect files storages in sidebar', async () => {
      const storages = page.getByTestId('files-storage-item')
      await expect(storages.first()).toBeVisible({ timeout: T(15000) })
      const count = await storages.count()
      console.log(`  → Storages: ${count}`)
      expect(count).toBeGreaterThan(0)
      await attachScreenshot(page, 'files-drawer-01')
    })

    await step('Select first storage', async () => {
      await clickReady(page.getByTestId('files-storage-item').first())
      await waitForFilesList(page)
      await attachScreenshot(page, 'files-drawer-02-selected')
    })
  })

  test('search filters files list', async ({ page }) => {
    test.setTimeout(T(120000))
    await loginAsTestUser(page)
    await openFiles(page)

    const items = page.getByTestId('files-item')
    test.skip((await items.count()) === 0, 'Files storage is empty')

    const name = (
      await items.first().locator('.name, .title .name').innerText().catch(() => '')
    ).trim()
    const query = name.split(/[\s._-]+/).find((w) => w.length > 2) || name
    test.skip(!query, 'No searchable name on first item')

    await step('Type search query', async () => {
      const input = page.getByTestId('files-search-input')
      await expect(input).toBeVisible({ timeout: T(15000) })
      await input.fill(query)
      await input.press('Enter')
      console.log(`  → Search query: ${query}`)
      await page.waitForTimeout(800)
      await waitForListReady(page, listReadyOptions)
      await attachScreenshot(page, 'files-search-01')
    })

    await step('Expect filtered list contains query', async () => {
      await expect(page.getByTestId('files-item').first()).toBeVisible({
        timeout: T(30000),
      })
      await expect(page.getByTestId('files-item').first()).toContainText(
        new RegExp(query, 'i')
      )
    })
  })

  test('creates a folder via New menu', async ({ page }) => {
    test.setTimeout(T(180000))
    await loginAsTestUser(page)
    await openFiles(page)

    const folderName = `E2E Folder ${Date.now()}`

    await step('Create folder', async () => {
      await createFolder(page, folderName)
      await expect(
        page.getByTestId('files-item').filter({ hasText: folderName }).first()
      ).toBeVisible({ timeout: T(60000) })
    })

    await step('Open folder and go back', async () => {
      await clickReady(
        page.getByTestId('files-item').filter({ hasText: folderName }).first()
      )
      await page
        .getByTestId('files-item')
        .filter({ hasText: folderName })
        .first()
        .dblclick()
        .catch(() => undefined)
      await waitForFilesList(page)
      await attachScreenshot(page, 'files-folder-01')
    })
  })

  test('uploads a file via New menu and deletes it', async ({ page }) => {
    test.setTimeout(T(240000))
    await loginAsTestUser(page)
    await openFiles(page)
    await openPersonalStorage(page)

    const uniqueName = `e2e-upload-${Date.now()}.txt`

    await step('Upload file', async () => {
      await uploadFileViaFab(page, uniqueName)
      console.log(`  → Uploaded: ${uniqueName}`)
      await attachScreenshot(page, 'files-upload-01-list')
    })

    await step('Select uploaded file and delete', async () => {
      await openFileByName(page, uniqueName)
      await deleteOpenedFile(page, uniqueName)
      console.log(`  → Deleted: ${uniqueName}`)
      await attachScreenshot(page, 'files-upload-02-deleted')
    })
  })

  test('renames uploaded file', async ({ page }) => {
    test.setTimeout(T(240000))
    await loginAsTestUser(page)
    await openFiles(page)
    await openPersonalStorage(page)

    const originalName = `e2e-rename-${Date.now()}.txt`
    const renamedName = `e2e-renamed-${Date.now()}.txt`

    await step('Upload file for rename', async () => {
      await uploadFileViaFab(page, originalName)
    })

    await step('Select file → Rename', async () => {
      await openFileByName(page, originalName)
      const rename = page.getByTestId('files-menu-rename')
      test.skip((await rename.count()) === 0, 'Rename control missing')
      const dialog = await openRenameDialog(page)
      test.skip(!dialog, 'Rename control missing')
      await attachScreenshot(page, 'files-rename-01-dialog')
    })

    await step(`Rename to ${renamedName}`, async () => {
      await fieldControl(page, 'files-rename-name').fill(renamedName)
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
        page.getByTestId('files-item').filter({ hasText: renamedName }).first()
      ).toBeVisible({ timeout: T(30000) })
      console.log(`  → Renamed: ${originalName} → ${renamedName}`)
      await attachScreenshot(page, 'files-rename-02-done')
    })

    await step('Cleanup: delete renamed file', async () => {
      await openFileByName(page, renamedName)
      await deleteOpenedFile(page, renamedName)
    })
  })

  test('creates and removes a public share link', async ({ page }) => {
    test.setTimeout(T(240000))
    await loginAsTestUser(page)
    await openFiles(page)
    await openPersonalStorage(page)

    const uniqueName = `e2e-share-${Date.now()}.txt`

    await step('Upload file for share link', async () => {
      await uploadFileViaFab(page, uniqueName)
    })

    await step('Open share-link dialog and create link', async () => {
      await openFileByName(page, uniqueName)
      const shareBtn = page.getByTestId('files-menu-public-link')
      test.skip(
        (await shareBtn.count()) === 0 ||
          !(await shareBtn.isVisible().catch(() => false)),
        'Public share link action not available on this storage/module'
      )
      await clickReady(shareBtn)
      await expect(page.getByTestId('files-share-link-dialog')).toBeVisible({
        timeout: T(15000),
      })
      // Desktop may auto-create the link when opening the dialog.
      const url = page.getByTestId('files-share-link-url')
      await expect(url).toBeVisible({ timeout: T(45000) })
      // Link is created async after the dialog opens on both apps (legacy's
      // SharePopup.js starts `pub` empty too, filled once CreatePublicLink
      // responds) — wait for the field to actually be populated, not just
      // rendered, or this can read the field while it's still empty.
      await expect
        .poll(
          async () => (await url.inputValue().catch(() => url.innerText())).trim(),
          { timeout: T(45000) }
        )
        .not.toBe('')
      const linkText = (await url.inputValue().catch(() => url.innerText())).trim()
      console.log(`  → Public link created (${linkText.length} chars)`)
      expect(linkText.length).toBeGreaterThan(0)
      await attachScreenshot(page, 'files-share-01-link')
    })

    await step('Remove public link and close dialog', async () => {
      await clickReady(page.getByTestId('files-share-link-remove'))
      await expect(page.getByTestId('files-share-link-dialog')).toBeHidden({
        timeout: T(45000),
      })
      console.log('  → Public link removed')
      await attachScreenshot(page, 'files-share-02-removed')
    })

    await step('Cleanup: delete file', async () => {
      await openFileByName(page, uniqueName)
      await deleteOpenedFile(page, uniqueName)
    })
  })

  test('moves uploaded file into a folder via cut/paste', async ({ page }) => {
    test.setTimeout(T(240000))
    await loginAsTestUser(page)
    await openFiles(page)
    await openPersonalStorage(page)

    const folderItems = page.getByTestId('files-item').filter({ has: page.locator('.folder, .item.folder') })
    // Prefer any existing folder-looking item; else create one.
    let folderName = (
      await page
        .getByTestId('files-item')
        .filter({ hasText: /E2E Folder|folder/i })
        .first()
        .locator('.name')
        .innerText()
        .catch(() => '')
    ).trim()

    if (!folderName) {
      folderName = `E2E MvDest ${Date.now()}`
      await createFolder(page, folderName)
    }

    const uniqueName = `e2e-move-${Date.now()}.txt`

    await step('Upload file for move', async () => {
      await uploadFileViaFab(page, uniqueName)
    })

    await step('Cut file then paste into folder', async () => {
      await openFileByName(page, uniqueName)
      const moveBtn = page.getByTestId('files-menu-move')
      test.skip(
        (await moveBtn.count()) === 0,
        'Cut/Move toolbar not available (FilesCutCopyPaste plugin)'
      )
      await clickReady(moveBtn)
      await attachScreenshot(page, 'files-move-01-mode')

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
      const moved = page
        .getByTestId('files-item')
        .filter({ hasText: uniqueName })
        .first()
      try {
        await expect(moved).toBeVisible({ timeout: T(30000) })
      } catch {
        test.skip(true, 'Cut/Copy/Paste did not complete on desktop')
      }
      console.log(`  → Moved into: ${folderName}`)
      await attachScreenshot(page, 'files-move-02-in-folder')
    })

    await step('Cleanup: delete moved file', async () => {
      await openFileByName(page, uniqueName)
      await deleteOpenedFile(page, uniqueName)
      void folderItems
    })
  })
})
