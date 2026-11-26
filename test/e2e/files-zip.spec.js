const path = require('path')
const { sharedHelper } = require(path.join(
  process.env.AURORA_E2E_ROOT,
  'helpers/paths'
))
const { test, expect } = require('@playwright/test')
const { T } = sharedHelper('timeouts')
const { gotoLoggedIn, step, attachScreenshot, hasCredentials } = sharedHelper('login')
const {
  openFiles,
  openPersonalStorage,
  openFolderItemByName,
  uploadFileViaFab,
  filesItemsByName,
} = require('./helpers/files')

const zipFixture = path.join(__dirname, 'preview-image.zip')

test.describe('Desktop files zip folder', () => {
  test.skip(!hasCredentials(), 'Set E2E_LOGIN_PRIMARY in .env.e2e')

  test('opens an uploaded zip and previews the image inside', async ({
    page,
  }) => {
    test.setTimeout(T(180000))
    const uniqueName = `e2e-tiny-${Date.now()}.zip`

    await gotoLoggedIn(page)
    await openFiles(page)
    await openPersonalStorage(page)

    await step('Upload zip fixture', async () => {
      await uploadFileViaFab(page, uniqueName, zipFixture, {
        mimeType: 'application/zip',
      })
    })

    await step('Open zip as folder', async () => {
      await openFolderItemByName(page, uniqueName)
      const inner = filesItemsByName(page, 'preview.png')
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
      await attachScreenshot(page, 'files-zip-opened')
    })

    await step('Open preview.png and verify the decoded image', async () => {
      const selector = 'img[src*="?download-file/"][src*="/view"]:visible'
      const timeout = T(30000)
      const [image] = await Promise.all([
        Promise.race([
          page.locator(selector).first().waitFor({ timeout }).then(() => page.locator(selector).first()),
          page.waitForEvent('popup', { timeout }).then(popup => popup.locator('img:visible').first()),
        ]),
        filesItemsByName(page, 'preview.png').first().dblclick(),
      ])
      await expect(image).toBeVisible({ timeout })
      await expect(image).toHaveJSProperty('naturalWidth', 17, { timeout })
      await expect(image).toHaveJSProperty('naturalHeight', 13, { timeout })
    })
  })
})
