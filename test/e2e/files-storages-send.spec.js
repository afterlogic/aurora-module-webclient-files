const path = require('path')
const { sharedHelper } = require(path.join(
  process.env.AURORA_E2E_ROOT,
  'helpers/paths'
))
const { test, expect } = require('@playwright/test')
const { T } = sharedHelper('timeouts')
const { gotoLoggedIn, step, attachScreenshot, hasCredentials } = sharedHelper('login')
const { clickReady, confirmOkIfVisible } = sharedHelper('ready')
const {
  openFiles,
  waitForFilesList,
  uploadFileViaFab,
  openPersonalStorage,
  openCorporateStorage,
  openTrashStorage,
  openSharedStorage,
  openFileByName,
  selectFilesItem,
  storageItem,
  waitForStoragesSidebar,
  storageTabAvailable,
} = require('./helpers/files')


test.describe('Desktop files storages, send, and trash', () => {
  test.skip(!hasCredentials(), 'Set E2E_LOGIN_PRIMARY in .env.e2e')

  test('switches Personal and Corporate storages', async ({ page }) => {
    test.setTimeout(T(180000))
    await gotoLoggedIn(page)
    await openFiles(page)

    await step('Open Personal', async () => {
      await openPersonalStorage(page)
      const personal = storageItem(page, 'personal')
      await expect(personal).toBeVisible({ timeout: T(30000) })
      await expect(personal).toHaveClass(/selected/, { timeout: T(10000) })
    })

    await step('Open Corporate if present', async () => {
      const opened = await openCorporateStorage(page)
      test.skip(!opened, 'Corporate storage is not available on this stand')
      const corporate = storageItem(page, 'corporate')
      await expect(corporate).toHaveClass(/selected/, { timeout: T(10000) })
      await waitForFilesList(page)
      await attachScreenshot(page, 'files-corporate')
    })
  })

  test('opens Shared storage when the tab is available', async ({ page }) => {
    test.setTimeout(T(180000))
    await gotoLoggedIn(page)
    await openFiles(page)

    await waitForStoragesSidebar(page)
    const shared = storageItem(page, 'shared')
    test.skip(
      !(await storageTabAvailable(page, 'shared')),
      'Shared storage tab is not available on this stand'
    )

    await step('Open Shared storage', async () => {
      await openSharedStorage(page)
      await expect(shared).toHaveClass(/selected/, { timeout: T(10000) })
      await waitForFilesList(page)
      await attachScreenshot(page, 'files-shared-storage')
    })
  })

  test('sends a selected file as email', async ({ page }) => {
    test.setTimeout(T(180000))
    const uniqueName = `e2e-send-${Date.now()}.txt`

    await gotoLoggedIn(page)
    await openFiles(page)
    await openPersonalStorage(page)
    await uploadFileViaFab(page, uniqueName)
    await openFileByName(page, uniqueName)

    const sendBtn = page.getByTestId('files-send')
    const sendVisible = await sendBtn
      .waitFor({ state: 'visible', timeout: T(15000) })
      .then(() => true)
      .catch(() => false)
    test.skip(!sendVisible, 'Send files action is not available')

    await step('Send file as email', async () => {
      await clickReady(sendBtn)
      await expect(page.getByTestId('mail-compose')).toBeVisible({
        timeout: T(30000),
      })
      await expect(
        page.locator(
          '.attachments_panel .item.file, .attachments_container .item.file'
        )
      ).toBeVisible({ timeout: T(30000) })
      await attachScreenshot(page, 'files-send-compose')
      await page.keyboard.press('Escape')
    })
  })

  test('deletes a file to Trash and restores it', async ({ page }) => {
    test.setTimeout(T(180000))
    const uniqueName = `e2e-trash-${Date.now()}.txt`

    await gotoLoggedIn(page)
    await openFiles(page)
    await openPersonalStorage(page)
    await uploadFileViaFab(page, uniqueName)
    await openFileByName(page, uniqueName)

    await step('Delete to Trash', async () => {
      await clickReady(page.getByTestId('files-delete'))
      await confirmOkIfVisible(page, 5000)
      await waitForFilesList(page)
      await expect(
        page.getByTestId('files-item').filter({ hasText: uniqueName })
      ).toHaveCount(0, { timeout: T(60000) })
    })

    const trashOpened = await openTrashStorage(page)
    test.skip(!trashOpened, 'Trash storage is not available on this stand')

    await step('Restore from Trash', async () => {
      const item = page
        .getByTestId('files-item')
        .filter({ hasText: uniqueName })
        .first()
      await expect(item).toBeVisible({ timeout: T(30000) })
      await selectFilesItem(page, item)
      await clickReady(page.getByTestId('files-restore'))
      await confirmOkIfVisible(page, 10000)
      await waitForFilesList(page)
    })

    await step('File is back in Personal', async () => {
      await openPersonalStorage(page)
      await expect(
        page.getByTestId('files-item').filter({ hasText: uniqueName })
      ).toBeVisible({ timeout: T(60000) })
      await attachScreenshot(page, 'files-restored')
    })
  })
})
