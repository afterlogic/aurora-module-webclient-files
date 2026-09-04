const path = require('path')
const { sharedHelper } = require(path.join(
  process.env.AURORA_E2E_ROOT,
  'helpers/paths'
))
const { test, expect } = require('@playwright/test')
const { T } = sharedHelper('timeouts')
const { gotoLoggedIn, step, attachScreenshot, hasCredentials } = sharedHelper('login')
const { clickReady } = sharedHelper('ready')
const {
  openFiles,
  openPersonalStorage,
  isCreateShortcutAvailable,
  uniqueShortcutUrl,
  installApiJsonSanitizeRoute,
  uninstallApiJsonSanitizeRoute,
  createShortcut,
  deleteItemByName,
  filesItemByName,
  waitForFilesList,
} = require('./helpers/files')

test.describe('Desktop files shortcuts', () => {
  test.skip(
    !hasCredentials(),
    'Set E2E_LOGIN_PRIMARY/E2E_PASSWORD_PRIMARY (or E2E_LOGIN/E2E_PASSWORD) in .env.e2e'
  )

  test('creates a shortcut via New menu, opens it, and deletes it', async ({
    page,
  }) => {
    test.setTimeout(T(300000))
    await gotoLoggedIn(page)
    await openFiles(page)
    await openPersonalStorage(page)

    const available = await isCreateShortcutAvailable(page)
    test.skip(
      !available,
      'Create shortcut is unavailable (DisableShortcuts or unsupported storage)'
    )

    // Same-origin URL from PLAYWRIGHT_BASE_URL — PHP CheckUrl probes via curl locally.
    const url = uniqueShortcutUrl()
    const urlToken = (url.match(/e2e-sc-\d+/) || [''])[0]
    console.log(`  → Shortcut target URL: ${url}`)
    let shortcutName = ''

    await installApiJsonSanitizeRoute(page)
    try {
      await step('Create shortcut from external URL', async () => {
        const created = await createShortcut(page, url)
        shortcutName = created.name
        console.log(`  → Shortcut: ${shortcutName} → ${url}`)
        await expect(created.item).toBeVisible({ timeout: T(15000) })
        await expect(created.item).toHaveClass(/aslink/, { timeout: T(10000) })
        await attachScreenshot(page, 'files-shortcut-01-created')
      })

      await step('Open shortcut URL', async () => {
        const item = filesItemByName(page, shortcutName)
        await expect(item).toBeVisible({ timeout: T(15000) })
        await item.scrollIntoViewIfNeeded()

        // Links often keep a single "open" action; FileView puts that on
        // secondAction (firstAction / files-item-view stays empty → no-op).
        const openBtn = item
          .locator('.main_actions a.button, a.button')
          .filter({ hasText: /open|открыть/i })
          .first()

        const popupPromise = page.waitForEvent('popup', { timeout: T(30000) })
        if (await openBtn.isVisible().catch(() => false)) {
          await clickReady(openBtn)
        } else {
          const secondary = item.locator('.main_actions a.button').nth(1)
          await expect(secondary).toBeVisible({ timeout: T(10000) })
          await clickReady(secondary)
        }
        const popup = await popupPromise
        await expect(popup).toHaveURL(new RegExp(urlToken || 'e2e-sc-'), {
          timeout: T(30000),
        })
        await popup.close()
        await waitForFilesList(page)
        await attachScreenshot(page, 'files-shortcut-02-opened')
      })

      await step('Delete shortcut', async () => {
        await deleteItemByName(page, shortcutName)
        await expect(filesItemByName(page, shortcutName)).toHaveCount(0, {
          timeout: T(60000),
        })
        await attachScreenshot(page, 'files-shortcut-03-deleted')
      })
    } finally {
      await uninstallApiJsonSanitizeRoute(page)
      if (shortcutName) {
        const leftover = filesItemByName(page, shortcutName)
        if ((await leftover.count().catch(() => 0)) > 0) {
          await deleteItemByName(page, shortcutName).catch((e) => {
            console.log(`  → cleanup shortcut failed: ${e.message}`)
          })
        }
      }
    }
  })
})
