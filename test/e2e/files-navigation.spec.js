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
  waitForFilesList,
  createFolder,
  uploadFileViaFab,
  openPersonalStorage,
  openFolderItemByName,
  deleteOpenedFile,
} = require('./helpers/files')

async function jqueryClick(locator) {
  await locator.evaluate((el) => {
    const $ = window.jQuery || window.$
    if ($) {
      $(el).trigger('click')
      return
    }
    el.click()
  })
}

test.describe('Desktop files navigation', () => {
  test.skip(!hasCredentials(), 'Set E2E_LOGIN_PRIMARY in .env.e2e')

  test.describe('Breadcrumbs', () => {
    test('opens a nested folder and navigates breadcrumbs', async ({ page }) => {
    test.setTimeout(T(240000))
    await gotoLoggedIn(page)
    await openFiles(page)
    await openPersonalStorage(page)

    const stamp = Date.now()
    const parentName = `E2E Nest ${stamp}`
    const childName = `E2E Child ${stamp}`

    await step('Create parent folder and open it', async () => {
      await createFolder(page, parentName)
      await openFolderItemByName(page, parentName)
      await expect(page.getByTestId('files-breadcrumb-current')).toHaveText(
        parentName,
        { timeout: T(20000) }
      )
    })

    await step('Create nested folder and open it', async () => {
      await createFolder(page, childName)
      await openFolderItemByName(page, childName)
      await expect(page.getByTestId('files-breadcrumb-current')).toHaveText(
        childName,
        { timeout: T(20000) }
      )
      await expect(page.getByTestId('files-breadcrumb').filter({ hasText: parentName })).toBeVisible({
        timeout: T(10000),
      })
      console.log(`  → Nested: ${parentName} / ${childName}`)
      await attachScreenshot(page, 'files-nested-01')
    })

    await step('Breadcrumb back to parent', async () => {
      await jqueryClick(
        page.getByTestId('files-breadcrumb').filter({ hasText: parentName }).first()
      )
      await waitForFilesList(page)
      await expect(
        page.getByTestId('files-item').filter({ hasText: childName }).first()
      ).toBeVisible({ timeout: T(30000) })
      await attachScreenshot(page, 'files-nested-02-parent')
    })

    await step('Breadcrumb back to storage root', async () => {
      await jqueryClick(page.getByTestId('files-breadcrumb').first())
      await waitForFilesList(page)
      await expect(
        page.getByTestId('files-item').filter({ hasText: parentName }).first()
      ).toBeVisible({ timeout: T(30000) })
      await attachScreenshot(page, 'files-nested-03-root')
    })
    })
  })

  test.describe('Preview', () => {
    test('opens a text file preview', async ({ page }) => {
    test.setTimeout(T(180000))
    await gotoLoggedIn(page)
    await openFiles(page)
    await openPersonalStorage(page)

    const uniqueName = `e2e-preview-${Date.now()}.txt`

    await step('Upload text file', async () => {
      await uploadFileViaFab(page, uniqueName)
    })

    await step('Open View action and expect a viewer', async () => {
      const item = page.getByTestId('files-item').filter({ hasText: uniqueName }).first()
      await expect(item).toBeVisible({ timeout: T(30000) })
      await item.hover()
      const viewBtn = item.getByTestId('files-item-view')
      test.skip(
        !(await viewBtn.isVisible().catch(() => false)),
        'View action not available on this file'
      )

      // FileViewerWebclientPlugin intercepts View and opens an in-page popup
      // with an iframe — not a new browser tab (continueView = false).
      const viewer = page.locator(
        '[data-test-id="files-viewer"], .popup.FileViewerWebclientPlugin'
      )
      const newPagePromise = page
        .context()
        .waitForEvent('page', { timeout: T(15000) })
        .catch(() => null)
      await jqueryClick(viewBtn)

      const inPage = await viewer
        .waitFor({ state: 'visible', timeout: T(15000) })
        .then(() => true)
        .catch(() => false)
      if (inPage) {
        await expect(viewer.getByText(uniqueName).first()).toBeVisible({
          timeout: T(10000),
        })
        const preview = viewer.frameLocator('.owl-item.active iframe')
        await expect(preview.locator('body')).toContainText(/E2E/i, {
          timeout: T(15000),
        })
        await jqueryClick(viewer.locator('.close').first())
        await expect(viewer).toBeHidden({ timeout: T(10000) })
      } else {
        const popup = await newPagePromise
        expect(popup, 'Expected in-page FileViewer or a new viewer tab').toBeTruthy()
        await popup.waitForLoadState('domcontentloaded').catch(() => undefined)
        const body = (await popup.locator('body').innerText().catch(() => '')).trim()
        expect(body.length).toBeGreaterThan(0)
        await popup.close().catch(() => undefined)
      }
      await attachScreenshot(page, 'files-preview-01')
    })

    await step('Cleanup', async () => {
      await deleteOpenedFile(page, uniqueName)
    })
    })
  })
})
