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

test.describe('Desktop files P1', () => {
  test.skip(!hasCredentials(), 'Set E2E_LOGIN_PRIMARY in .env.e2e')

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
      await attachScreenshot(page, 'files-p1-nested-01')
    })

    await step('Breadcrumb back to parent', async () => {
      await jqueryClick(
        page.getByTestId('files-breadcrumb').filter({ hasText: parentName }).first()
      )
      await waitForFilesList(page)
      await expect(
        page.getByTestId('files-item').filter({ hasText: childName }).first()
      ).toBeVisible({ timeout: T(30000) })
      await attachScreenshot(page, 'files-p1-nested-02-parent')
    })

    await step('Breadcrumb back to storage root', async () => {
      await jqueryClick(page.getByTestId('files-breadcrumb').first())
      await waitForFilesList(page)
      await expect(
        page.getByTestId('files-item').filter({ hasText: parentName }).first()
      ).toBeVisible({ timeout: T(30000) })
      await attachScreenshot(page, 'files-p1-nested-03-root')
    })
  })

  test('sorts the files list', async ({ page }) => {
    test.setTimeout(T(120000))
    await gotoLoggedIn(page)
    await openFiles(page)
    await openPersonalStorage(page)

    const sortBtn = page.getByTestId('files-sort')
    test.skip(
      !(await sortBtn.isVisible().catch(() => false)),
      'Files sort is disabled on this stand (FilesSortBy.Allow)'
    )

    await step('Toggle sort order', async () => {
      const beforeClass = (await sortBtn.getAttribute('class')) || ''
      await jqueryClick(sortBtn)
      const option = page.getByTestId('files-sort-option').first()
      await expect(option).toBeVisible({ timeout: T(10000) })
      await jqueryClick(option)
      await waitForFilesList(page)
      await expect(sortBtn).toBeVisible({ timeout: T(10000) })
      const afterClass = (await sortBtn.getAttribute('class')) || ''
      console.log(`  → Sort class: ${beforeClass} → ${afterClass}`)
      expect(afterClass).toMatch(/sort_asc|sort_desc/)
      await attachScreenshot(page, 'files-p1-sort-01')
    })
  })

  test('opens a text file preview', async ({ page }) => {
    test.setTimeout(T(180000))
    await gotoLoggedIn(page)
    await openFiles(page)
    await openPersonalStorage(page)

    const uniqueName = `e2e-preview-${Date.now()}.txt`

    await step('Upload text file', async () => {
      await uploadFileViaFab(page, uniqueName)
    })

    await step('Open View action and expect a viewer window', async () => {
      const item = page.getByTestId('files-item').filter({ hasText: uniqueName }).first()
      await expect(item).toBeVisible({ timeout: T(30000) })
      await item.hover()
      const viewBtn = item.getByTestId('files-item-view')
      test.skip(
        !(await viewBtn.isVisible().catch(() => false)),
        'View action not available on this file'
      )
      const popupPromise = page.context().waitForEvent('page', {
        timeout: T(20000),
      })
      await viewBtn.click({ force: true })
      const popup = await popupPromise
      await popup.waitForLoadState('domcontentloaded').catch(() => undefined)
      const body = (await popup.locator('body').innerText().catch(() => '')).trim()
      console.log(`  → Preview length: ${body.length}`)
      expect(body.length).toBeGreaterThan(0)
      await popup.close().catch(() => undefined)
      await attachScreenshot(page, 'files-p1-preview-01')
    })

    await step('Cleanup', async () => {
      await deleteOpenedFile(page, uniqueName)
    })
  })
})
