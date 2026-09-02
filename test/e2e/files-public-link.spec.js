const path = require('path')
const { sharedHelper } = require(path.join(
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
  openAnonymousPage,
} = sharedHelper('login')
const { clickReady } = sharedHelper('ready')
const {
  openFiles,
  openPersonalStorage,
  uploadFileViaFab,
  openFileByName,
  deleteOpenedFile,
  createPublicLinkUrl,
  closeShareLinkDialog,
  removePublicLinkFromDialog,
  resolvePublicLinkUrl,
} = require('./helpers/files')

test.describe('Desktop files public link (anonymous)', () => {
  test.skip(!hasCredentials(), 'Set E2E_LOGIN_PRIMARY in .env.e2e')

  test('opens public link URL in a clean session and downloads the file', async ({
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(T(300000))

    const uniqueName = `e2e-pub-${Date.now()}.txt`

    await gotoLoggedIn(page)
    await openFiles(page)
    await openPersonalStorage(page)

    await step('Upload file and create public link', async () => {
      await uploadFileViaFab(page, uniqueName)
      await openFileByName(page, uniqueName)
      const shareBtn = page.getByTestId('files-menu-public-link')
      test.skip(
        (await shareBtn.count()) === 0 ||
          !(await shareBtn.isVisible().catch(() => false)),
        'Public share link action not available on this storage/module'
      )
      const publicUrl = await createPublicLinkUrl(page)
      expect(publicUrl.length).toBeGreaterThan(0)
      console.log(`  → Public link ready (${publicUrl.length} chars)`)
      await closeShareLinkDialog(page)
      await attachScreenshot(page, 'files-pub-01-created')

      const anon = await openAnonymousPage(browser, { baseURL })
      try {
        await step('Anonymous visitor opens public URL', async () => {
          await anon.page.goto(resolvePublicLinkUrl(publicUrl, baseURL), {
            waitUntil: 'domcontentloaded',
            timeout: T(90000),
          })
          await expect(anon.page.getByTestId('files-pub-page')).toBeVisible({
            timeout: T(30000),
          })
          await expect(anon.page.getByTestId('files-pub-name')).toContainText(
            uniqueName
          )
          await attachScreenshot(anon.page, 'files-pub-02-anonymous-view')
        })

        await step('Download file from public page', async () => {
          const [download] = await Promise.all([
            anon.page.waitForEvent('download', { timeout: T(60000) }),
            clickReady(anon.page.getByTestId('files-pub-download')),
          ])
          expect(download.suggestedFilename()).toContain(
            uniqueName.replace(/\.txt$/i, '')
          )
          console.log(`  → Downloaded as: ${download.suggestedFilename()}`)
        })
      } finally {
        await anon.context.close()
      }
    })

    await step('Cleanup: revoke link and delete file', async () => {
      await openFiles(page)
      await openPersonalStorage(page)
      await openFileByName(page, uniqueName)
      await removePublicLinkFromDialog(page)
      await deleteOpenedFile(page, uniqueName)
      await attachScreenshot(page, 'files-pub-03-cleaned')
    })
  })

  test('revoked public link shows not-found page to anonymous visitor', async ({
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(T(300000))

    const uniqueName = `e2e-pub-revoke-${Date.now()}.txt`

    await gotoLoggedIn(page)
    await openFiles(page)
    await openPersonalStorage(page)

    let publicUrl = ''
    await step('Upload, create link, then revoke', async () => {
      await uploadFileViaFab(page, uniqueName)
      await openFileByName(page, uniqueName)
      const shareBtn = page.getByTestId('files-menu-public-link')
      test.skip(
        (await shareBtn.count()) === 0 ||
          !(await shareBtn.isVisible().catch(() => false)),
        'Public share link action not available on this storage/module'
      )
      publicUrl = await createPublicLinkUrl(page)
      await removePublicLinkFromDialog(page)
      console.log('  → Public link revoked')
    })

    const anon = await openAnonymousPage(browser, { baseURL })
    try {
      await step('Anonymous visitor sees not-found after revoke', async () => {
        await anon.page.goto(resolvePublicLinkUrl(publicUrl, baseURL), {
          waitUntil: 'domcontentloaded',
          timeout: T(90000),
        })
        await expect(anon.page.getByTestId('files-pub-not-found')).toBeVisible({
          timeout: T(30000),
        })
        await attachScreenshot(anon.page, 'files-pub-revoked')
      })
    } finally {
      await anon.context.close()
    }

    await step('Cleanup: delete file', async () => {
      await openFiles(page)
      await openPersonalStorage(page)
      await openFileByName(page, uniqueName)
      await deleteOpenedFile(page, uniqueName)
    })
  })
})
