const path = require('path')
const { sharedHelper, moduleHelper, fixturePath } = require(path.join(
  process.env.AURORA_E2E_ROOT,
  'helpers/paths'
))
const { test, expect } = require('@playwright/test')
const { T } = sharedHelper('timeouts')
const { gotoLoggedIn, step, attachScreenshot, hasCredentials } = sharedHelper('login')
const { clickReady } = sharedHelper('ready')
const {
  openFiles,
  waitForFilesList,
  createFolder,
  uploadFixture,
  deleteItemByName,
} = require('./helpers/files')


test.describe('Desktop files', () => {
  test.skip(!hasCredentials(), 'Set E2E_LOGIN_0/E2E_PASSWORD_0 (or E2E_LOGIN/E2E_PASSWORD) in .env.e2e')

  test('opens first file from the list', async ({ page }) => {
    test.setTimeout(T(120000))

    await gotoLoggedIn(page)
    await openFiles(page)
    await attachScreenshot(page, 'files-01-list')

    const fileItems = page.getByTestId('files-item')
    const count = await fileItems.count()

    await step(`Inspect files list (found ${count})`, async () => {
      if (count === 0) {
        console.log('  → Storage/folder is empty')
        await attachScreenshot(page, 'files-02-empty')
        return
      }
      const name = (
        await fileItems
          .first()
          .locator('.name, .title .name')
          .innerText()
          .catch(() => '')
      ).trim()
      console.log(`  → First item: ${name || '(unnamed)'}`)
      await attachScreenshot(page, 'files-02-list')
    })

    test.skip(
      count === 0,
      'Files storage is empty — add a file or folder for this smoke'
    )

    await step('Select first item', async () => {
      await clickReady(fileItems.first())
      await expect(fileItems.first()).toHaveClass(/selected|checked/, {
        timeout: T(10000),
      })
      await attachScreenshot(page, 'files-03-selected')
    })

    await step('List still present', async () => {
      await waitForFilesList(page)
    })
  })

  test('lists files, creates folder, uploads file', async ({ page }) => {
    test.setTimeout(T(180000))

    const folderName = `e2e-folder-${Date.now()}`

    await gotoLoggedIn(page)
    await openFiles(page)
    await attachScreenshot(page, 'files-create-01-list')

    await createFolder(page, folderName)

    await step('Expect folder in list', async () => {
      const folder = page
        .getByTestId('files-item')
        .filter({ hasText: folderName })
        .first()
      await expect(folder).toBeVisible({ timeout: T(30000) })
      console.log(`  → Folder created: ${folderName}`)
    })

    await uploadFixture(page)

    await step('Expect uploaded file in list', async () => {
      const file = page
        .getByTestId('files-item')
        .filter({ hasText: 'e2e-attach.txt' })
        .first()
      await expect(file).toBeVisible({ timeout: T(60000) })
      console.log('  → Upload visible')
      await attachScreenshot(page, 'files-create-02-after-upload')
    })

    await deleteItemByName(page, 'e2e-attach.txt').catch((err) => {
      console.log(`  → Cleanup upload skipped: ${err.message}`)
    })
    await deleteItemByName(page, folderName).catch((err) => {
      console.log(`  → Cleanup folder skipped: ${err.message}`)
    })
  })
})
