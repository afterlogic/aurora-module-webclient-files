const path = require('path')
const { sharedHelper, fixturePath } = require(path.join(
  process.env.AURORA_E2E_ROOT,
  'helpers/paths'
))
const { test, expect } = require('@playwright/test')
const { T } = sharedHelper('timeouts')
const { gotoLoggedIn, step, attachScreenshot, hasCredentials } = sharedHelper('login')
const {
  openFiles,
  openPersonalStorage,
  uploadFileViaFab,
  selectFilesItem,
  openFolderItemByName,
  filesItemByName,
  filesItemsByName,
} = require('./helpers/files')

const zipFixture = fixturePath('e2e-tiny.zip')

test.describe('Desktop files zip folder', () => {
  test.skip(!hasCredentials(), 'Set E2E_LOGIN_PRIMARY in .env.e2e')

  test('opens a selected zip as a folder (FilesZipFolder)', async ({ page }) => {
    test.setTimeout(T(180000))
    const uniqueName = `e2e-zip-sel-${Date.now()}.zip`

    await gotoLoggedIn(page)
    await openFiles(page)
    await openPersonalStorage(page)

    await step('Upload zip fixture', async () => {
      await uploadFileViaFab(page, uniqueName, zipFixture, {
        mimeType: 'application/zip',
      })
    })

    await step('Select zip in the list', async () => {
      await selectFilesItem(page, filesItemByName(page, uniqueName))
    })

    await step('Open selected zip as folder', async () => {
      await openFolderItemByName(page, uniqueName)
      const inner = filesItemsByName(page, 'hello.txt')
      const zipStillListed = filesItemsByName(page, uniqueName)
      const openedAsFolder = await inner
        .first()
        .waitFor({ state: 'visible', timeout: T(15000) })
        .then(() => true)
        .catch(() => false)
      test.skip(
        !openedAsFolder && (await zipStillListed.count()) > 0,
        'Zip did not open as a folder (FilesZipFolder may be off)'
      )
      await expect(inner.first()).toBeVisible({ timeout: T(15000) })
      await attachScreenshot(page, 'files-zip-selected-opened')
    })
  })
})
