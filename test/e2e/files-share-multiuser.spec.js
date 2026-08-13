const path = require('path')
const { sharedHelper } = require(path.join(
  process.env.AURORA_E2E_ROOT,
  'helpers/paths'
))
const { test, expect } = require('@playwright/test')
const {
  loginAsTestUser,
  openLoggedInPage,
  step,
  attachScreenshot,
  hasCredentials,
  hasSecondaryCredentials,
  getSecondaryCredentials,
} = sharedHelper('login')
const {
  openFiles,
  uploadFileViaFab,
  openFileByName,
  deleteOpenedFile,
  selectFilesItem,
  openPersonalStorage,
  openSharedStorage,
  shareFileWithTeammate,
  clickLeaveShareToolbarAction,
  confirmOkIfVisible,
} = require('./helpers/files')

function uniqueFileName(prefix) {
  return `${prefix}-${Date.now()}.txt`
}

test.describe('Desktop files multi-user share', () => {
  test.skip(
    !hasCredentials(),
    'Set E2E_LOGIN_PRIMARY and E2E_PASSWORD_PRIMARY in .env.e2e'
  )
  test.skip(
    !hasSecondaryCredentials(),
    'Set E2E_LOGIN_SECONDARY and E2E_PASSWORD_SECONDARY in .env.e2e'
  )

  test('PRIMARY shares file; SECONDARY sees it in Shared storage', async ({
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(300000)

    const uniqueName = uniqueFileName('e2e-share-ab')
    const secondaryEmail = getSecondaryCredentials().login

    await loginAsTestUser(page)
    await openFiles(page)
    await openPersonalStorage(page)

    await step('Upload file as PRIMARY', async () => {
      await uploadFileViaFab(page, uniqueName)
      await openFileByName(page, uniqueName)
      await attachScreenshot(page, 'share-ab-01-uploaded')
    })

    await step('Share file with SECONDARY', async () => {
      await shareFileWithTeammate(page, secondaryEmail)
    })

    const secondary = await openLoggedInPage(
      browser,
      getSecondaryCredentials(),
      { baseURL }
    )
    try {
      await step('SECONDARY opens Shared storage and finds file', async () => {
        await openFiles(secondary.page)
        await openSharedStorage(secondary.page)
        const item = secondary.page
          .getByTestId('files-item')
          .filter({ hasText: uniqueName })
          .first()
        await expect(item).toBeVisible({ timeout: 90000 })
        await attachScreenshot(secondary.page, 'share-ab-02-secondary-sees')
      })

      await step('SECONDARY leaves share', async () => {
        const item = secondary.page
          .getByTestId('files-item')
          .filter({ hasText: uniqueName })
          .first()
        await selectFilesItem(secondary.page, item)
        await clickLeaveShareToolbarAction(secondary.page)
        await confirmOkIfVisible(secondary.page, 15000)
        await expect(
          secondary.page
            .getByTestId('files-item')
            .filter({ hasText: uniqueName })
        ).toHaveCount(0, { timeout: 60000 })
        console.log('  → SECONDARY left share')
        await attachScreenshot(secondary.page, 'share-ab-02b-left')
      })
    } finally {
      await secondary.context.close()
    }

    await step('Cleanup: PRIMARY deletes shared file', async () => {
      await openFiles(page)
      await openPersonalStorage(page)
      await openFileByName(page, uniqueName)
      await deleteOpenedFile(page, uniqueName)
      await attachScreenshot(page, 'share-ab-03-cleaned')
    })
  })
})
