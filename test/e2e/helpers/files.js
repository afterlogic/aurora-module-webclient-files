const path = require('path')
const { sharedHelper, fixturePath } = require(path.join(
  process.env.AURORA_E2E_ROOT,
  'helpers/paths'
))
const fs = require('fs')
const { expect } = require('@playwright/test')
const { step, attachScreenshot, fieldControl } = sharedHelper('login')
const { waitForListReady, clickReady, clickNav, confirmOkIfVisible } = sharedHelper('ready')
const { T } = sharedHelper('timeouts')

const listReadyOptions = {
  itemTestIds: 'files-item',
  emptyTestId: 'files-empty',
  spinnerSelectors: ['.files_panel .list_loading', '.files .list_loading'],
  timeout: 60000,
}

const defaultFixturePath = fixturePath('e2e-attach.txt')

async function openFiles(page) {
  await step('Open Files', async () => {
    await clickNav(page, 'nav-files')
    await expect(page.getByTestId('files-list')).toBeVisible({
      timeout: T(60000),
    })
    await waitForListReady(page, listReadyOptions)
  })
}

async function waitForFilesList(page) {
  await expect(page.getByTestId('files-list')).toBeVisible({
    timeout: T(30000),
  })
  await waitForListReady(page, listReadyOptions)
}

async function openNewItemsMenu(page) {
  await clickReady(
    page
      .getByTestId('files-new-menu')
      .locator('.control.button, .button')
      .first()
  )
}

async function createFolder(page, folderName) {
  await step(`Create folder ${folderName}`, async () => {
    await openNewItemsMenu(page)
    await clickReady(page.getByTestId('files-create-folder'))
    await expect(page.getByTestId('files-create-folder-dialog')).toBeVisible({
      timeout: T(15000),
    })
    await fieldControl(page, 'files-create-folder-name').fill(folderName)
    await clickReady(page.getByTestId('files-create-folder-ok'))
    await expect(page.getByTestId('files-create-folder-dialog')).toBeHidden({
      timeout: T(30000),
    })
    await waitForListReady(page, listReadyOptions)
  })
}

async function uploadFixture(page) {
  await step('Upload e2e-attach.txt', async () => {
    await openNewItemsMenu(page)
    const fileInput = page.locator('input[type="file"]').first()
    if ((await fileInput.count()) > 0) {
      await fileInput.setInputFiles(defaultFixturePath)
    } else {
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        clickReady(page.getByTestId('files-upload')),
      ])
      await fileChooser.setFiles(defaultFixturePath)
    }
    await waitForListReady(page, listReadyOptions)
    await attachScreenshot(page, 'files-after-upload')
  })
}

/**
 * Upload a uniquely named file via New menu → Upload.
 * @returns {import('@playwright/test').Locator}
 */
async function uploadFileViaFab(
  page,
  uniqueName,
  sourcePath = defaultFixturePath
) {
  await openNewItemsMenu(page)
  const fileInput = page.locator('input[type="file"]').first()
  const buffer = fs.readFileSync(sourcePath)
  if ((await fileInput.count()) > 0) {
    await fileInput.setInputFiles({
      name: uniqueName,
      mimeType: 'text/plain',
      buffer,
    })
  } else {
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      clickReady(page.getByTestId('files-upload')),
    ])
    await fileChooser.setFiles({
      name: uniqueName,
      mimeType: 'text/plain',
      buffer,
    })
  }

  const item = page
    .getByTestId('files-item')
    .filter({ hasText: uniqueName })
    .first()
  await expect(item).toBeVisible({ timeout: T(90000) })
  // A completed single-file upload triggers CFilesView's own routeFiles() ->
  // clearAndShowLoading() + currentGetFiles() right after this item is pushed
  // in (onFileUploadComplete), replacing files() with freshly-fetched item
  // objects. If a caller selects this item before that settles, CSelector's
  // list.subscribe drops the selection (no isEqual() on CFileModel -> falls
  // back to reference equality against the new array) and the very next
  // toolbar command (rename/delete/download/...) silently no-ops because
  // nothing is selected anymore. Wait for the list to settle before
  // returning so callers always select the final, stable item.
  await waitForListReady(page, listReadyOptions)
  await waitForFileItemReady(item)
  return item
}

/**
 * Click target that actually selects a files-item.
 *
 * FileView.html overlays each file with a `.main_action` "View" button
 * (position: absolute, top: 0, height: 88px, width: 100%, opacity: 0 until
 * hover) whose Knockout binding sets `clickBubble: false`. A plain click at
 * the item's bounding-box center often lands on that invisible overlay
 * instead of the item — the click fires the View action and never reaches
 * CSelector's delegated listener, so the item is silently never selected.
 * Click the filename text (outside the overlay's region, and present on
 * both FileView and FolderView) instead of the item root to avoid it.
 */
function itemClickTarget(item) {
  return item.locator('.name').first()
}

/** Upload/processing finished — cut/copy require allSelectedFilesReady(). */
async function waitForFileItemReady(item, timeout = 90000) {
  await expect
    .poll(
      async () => {
        if (await item.locator('.progress:visible').count()) {
          return false
        }
        if (await item.locator('.status_text.error:visible').count()) {
          return false
        }
        const status = (
          await item.locator('.status_text:visible').innerText().catch(() => '')
        ).trim()
        return status.length === 0
      },
      { timeout: T(timeout), intervals: [500, 1000, 2000] }
    )
    .toBe(true)
}

async function clickItemToSelect(item) {
  await item.scrollIntoViewIfNeeded()
  const target = itemClickTarget(item)
  await expect(target).toBeVisible({ timeout: T(30000) })
  await target.evaluate((el) => {
    if (window.jQuery) {
      window.jQuery(el).trigger('click')
      return
    }
    el.click()
  })
  await expect(item).toHaveClass(/selected|checked/, { timeout: T(10000) })
}

async function openFileByName(page, name) {
  const item = page.getByTestId('files-item').filter({ hasText: name }).first()
  await expect(item).toBeVisible({ timeout: T(30000) })
  await waitForFileItemReady(item)
  await clickItemToSelect(item)
  return item
}

const CUT_COPY_PASTE_TOOLBAR_CLASS = {
  'files-menu-move': 'cut',
  'files-menu-copy': 'copy',
  'files-paste': 'paste',
}

/** Plugin button by data-test-id, with legacy `.item.cut|copy|paste` fallback on old builds. */
function cutCopyPasteButton(page, testId, { enabledOnly = false, attachedOnly = false } = {}) {
  const cssClass = CUT_COPY_PASTE_TOOLBAR_CLASS[testId]
  const state = enabledOnly
    ? ':visible:not(.disabled):not(.command-disabled):not(.unavailable)'
    : attachedOnly
      ? ''
      : ':visible'
  // Build full selectors — do NOT put commas inside a "toolbar" prefix:
  // `.a, .b [data-test-id=…]` would match `.a` itself (the toolbar), not the button.
  const selectors = [
    `.panel.center_panel.files .toolbar [data-test-id="${testId}"]${state}`,
    `.panel.files .toolbar [data-test-id="${testId}"]${state}`,
  ]
  if (cssClass) {
    selectors.push(
      `.panel.center_panel.files .toolbar .item.${cssClass}${state}`,
      `.panel.files .toolbar .item.${cssClass}${state}`
    )
  }
  if (attachedOnly) {
    selectors.push(`[data-test-id="${testId}"]`)
  }
  return page.locator(selectors.join(', ')).first()
}

/** Cut/Copy/Paste toolbar button that is visible and enabled. */
function enabledToolbarButton(page, testId) {
  return cutCopyPasteButton(page, testId, { enabledOnly: true })
}

/** AlertPopup after Cut/Copy — no data-test-id; dismiss OK to unblock toolbar. */
async function dismissAlertIfVisible(page, timeout = 8000) {
  const alert = page.locator('.alert.popup:visible').first()
  const appeared = await alert
    .waitFor({ state: 'visible', timeout: T(timeout) })
    .then(() => true)
    .catch(() => false)
  if (appeared) {
    await clickReady(alert.locator('.button.success, .buttons .button').first())
    await expect(alert)
      .toBeHidden({ timeout: T(15000) })
      .catch(() => undefined)
  }
}

/** After Cut/Copy, Paste hint shows queued item count. */
async function waitForPasteEnabled(page, timeout = 60000) {
  const paste = cutCopyPasteButton(page, 'files-paste', { attachedOnly: true })
  await expect
    .poll(
      async () => {
        if ((await paste.count()) === 0) {
          return 0
        }
        const hint = paste.locator('.hint')
        if (!(await hint.count())) {
          return 0
        }
        const text = (await hint.textContent().catch(() => '')).trim()
        const n = parseInt(text, 10)
        return Number.isFinite(n) ? n : 0
      },
      { timeout: T(timeout), intervals: [300, 500, 1000] }
    )
    .toBeGreaterThan(0)
}

/** @deprecated Use waitForPasteEnabled — kept so older specs/exports do not throw. */
const waitForClipboardItems = waitForPasteEnabled

/** Cut/Copy/Paste plugin registers toolbar buttons asynchronously after Files loads. */
async function waitForCutCopyPastePlugin(page, testId, timeout = 90000) {
  const btn = cutCopyPasteButton(page, testId, { attachedOnly: true })
  await expect
    .poll(async () => btn.count(), {
      timeout: T(timeout),
      intervals: [500, 1000, 2000],
    })
    .toBeGreaterThan(0)
  return true
}

/** Click an enabled Cut/Copy/Paste toolbar action (waits for plugin + enabled state). */
async function clickCutCopyPasteAction(page, testId, { fileName } = {}) {
  await waitForCutCopyPastePlugin(page, testId)

  if (fileName) {
    await openFileByName(page, fileName)
  }

  const btn = enabledToolbarButton(page, testId)
  await expect
    .poll(async () => (await btn.count()) > 0, {
      timeout: T(90000),
      intervals: [500, 1000, 2000],
    })
    .toBe(true)

  await btn.evaluate((el) => {
    if (window.jQuery) {
      window.jQuery(el).trigger('click')
      return
    }
    el.click()
  })
  await dismissAlertIfVisible(page)
}

async function openFolderItemByName(page, folderName) {
  const folder = page
    .getByTestId('files-item')
    .filter({ hasText: folderName })
    .first()
  await expect(folder).toBeVisible({ timeout: T(30000) })
  const target = itemClickTarget(folder)
  await expect(target).toBeVisible({ timeout: T(10000) })
  await target.evaluate((el) => {
    if (window.jQuery) {
      window.jQuery(el).trigger('dblclick')
      return
    }
    el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  })
  await waitForFilesList(page)
}

async function pasteIntoCurrentFolder(page) {
  await waitForPasteEnabled(page, 60000)

  const paste = enabledToolbarButton(page, 'files-paste')
  await expect
    .poll(async () => (await paste.count()) > 0, {
      timeout: T(30000),
      intervals: [300, 500, 1000],
    })
    .toBe(true)
  await paste.evaluate((el) => {
    if (window.jQuery) {
      window.jQuery(el).trigger('click')
      return
    }
    el.click()
  })
  await waitForFilesList(page)
}

async function deleteOpenedFile(page, name) {
  // Re-select right before acting: selection can silently drop between the
  // caller's earlier select-click and this call (see uploadFileViaFab for
  // why), and deleteCommand's canExecute is gated on something being
  // selected -- a stale/lost selection makes this click a silent no-op.
  const item = page.getByTestId('files-item').filter({ hasText: name }).first()
  await clickItemToSelect(item)
  await clickReady(page.getByTestId('files-delete'))
  // Trash path often deletes without ConfirmPopup (deleteItems(..., true)).
  await confirmOkIfVisible(page, 5000)
  await waitForFilesList(page)
  await expect(
    page.getByTestId('files-item').filter({ hasText: name })
  ).toHaveCount(0, { timeout: T(60000) })
}

async function deleteItemByName(page, name) {
  await step(`Delete item ${name}`, async () => {
    const item = page
      .getByTestId('files-item')
      .filter({ hasText: name })
      .first()
    await clickReady(itemClickTarget(item))
    await clickReady(page.getByTestId('files-delete'))
    await confirmOkIfVisible(page, 5000)
    await waitForListReady(page, listReadyOptions)
  })
}

async function selectFilesItem(page, item, { modifiers } = {}) {
  await item.scrollIntoViewIfNeeded()
  const target = itemClickTarget(item)
  if (modifiers && modifiers.length) {
    await expect(target).toBeVisible({ timeout: 30000 })
    await target.click({ modifiers })
  } else {
    await clickItemToSelect(item)
  }
  await expect(item).toHaveClass(/selected|checked/, { timeout: 10000 })
}

async function navigateToStorageRoot(page) {
  for (let i = 0; i < 10; i++) {
    const crumbs = page.locator(
      '.files_panel .path a, .panel.files .path a, .breadcrumbs a'
    )
    const count = await crumbs.count()
    if (count <= 1) break
    await clickReady(crumbs.first())
    await waitForFilesList(page)
  }
}

async function openPersonalStorage(page) {
  await navigateToStorageRoot(page)
  const personal = page
    .locator(
      '[data-test-id="files-storage-item"][data-storage-type="personal"]'
    )
    .first()
  if ((await personal.count()) > 0) {
    await clickReady(personal)
  } else {
    const first = page.getByTestId('files-storage-item').first()
    if ((await first.count()) > 0) {
      await clickReady(first)
    }
  }
  await waitForFilesList(page)
}

async function openSharedStorage(page) {
  await navigateToStorageRoot(page)
  const shared = page
    .locator('[data-test-id="files-storage-item"][data-storage-type="shared"]')
    .first()
  await expect(shared).toBeVisible({ timeout: T(30000) })
  await clickReady(shared)
  await waitForFilesList(page)
}

/**
 * SharedFiles toolbar Share button.
 * Staging builds may lack data-test-id — fall back to `.item.share`.
 */
function shareToolbarButton(page, { enabledOnly = false } = {}) {
  const state = enabledOnly
    ? ':visible:not(.disabled):not(.command-disabled):not(.unavailable)'
    : ':visible'
  return page
    .locator(
      [
        `.panel.center_panel.files .toolbar [data-test-id="files-menu-share"]${state}`,
        `.panel.files .toolbar [data-test-id="files-menu-share"]${state}`,
        `.panel.center_panel.files .toolbar .item.share${state}`,
        `.panel.files .toolbar .item.share${state}`,
      ].join(', ')
    )
    .first()
}

/** Wait until Share is present (plugin registered); fail if missing. */
async function waitForShareToolbar(page, timeout = 60000) {
  const btn = page.locator(
    [
      '.panel.center_panel.files .toolbar [data-test-id="files-menu-share"]',
      '.panel.files .toolbar [data-test-id="files-menu-share"]',
      '.panel.center_panel.files .toolbar .item.share',
      '.panel.files .toolbar .item.share',
    ].join(', ')
  )
  await expect
    .poll(async () => btn.count(), {
      timeout: T(timeout),
      intervals: [500, 1000, 2000],
    })
    .toBeGreaterThan(0)
}

/** Click enabled Share toolbar action (re-select file if name given). */
async function clickShareToolbarAction(page, { fileName } = {}) {
  await waitForShareToolbar(page)
  if (fileName) {
    await openFileByName(page, fileName)
  }
  const btn = shareToolbarButton(page, { enabledOnly: true })
  await expect
    .poll(async () => (await btn.count()) > 0, {
      timeout: T(60000),
      intervals: [500, 1000, 2000],
    })
    .toBe(true)
  await btn.evaluate((el) => {
    if (window.jQuery) {
      window.jQuery(el).trigger('click')
      return
    }
    el.click()
  })
}

/**
 * Leave share toolbar button.
 * Staging may lack data-test-id — fall back to `.item.leave-share`
 * (not `.item.leave`, which never matched).
 */
function leaveShareToolbarButton(page, { enabledOnly = false } = {}) {
  const state = enabledOnly
    ? ':visible:not(.disabled):not(.command-disabled):not(.unavailable)'
    : ':visible'
  return page
    .locator(
      [
        `.panel.center_panel.files .toolbar [data-test-id="files-menu-share-leave"]${state}`,
        `.panel.files .toolbar [data-test-id="files-menu-share-leave"]${state}`,
        `.panel.center_panel.files .toolbar .item.leave-share${state}`,
        `.panel.files .toolbar .item.leave-share${state}`,
      ].join(', ')
    )
    .first()
}

/** Click enabled Leave share (item must already be a sharedWithMe selection). */
async function clickLeaveShareToolbarAction(page) {
  const btn = leaveShareToolbarButton(page, { enabledOnly: true })
  await expect
    .poll(async () => (await btn.count()) > 0, {
      timeout: T(60000),
      intervals: [500, 1000, 2000],
    })
    .toBe(true)
  await btn.evaluate((el) => {
    if (window.jQuery) {
      window.jQuery(el).trigger('click')
      return
    }
    el.click()
  })
}

function filesShareDialog(page) {
  return page
    .locator(
      '[data-test-id="files-share-dialog"], .popup:has(.popup_panel_shares)'
    )
    .first()
}

/**
 * Share the currently selected file/folder with a teammate email.
 * Relies on corporate autocomplete finding the recipient, then Read access.
 * Staging builds may omit data-test-id on the popup — fall back to classes.
 */
async function shareFileWithTeammate(page, email) {
  await step(`Share with teammate ${email}`, async () => {
    await clickShareToolbarAction(page)

    const dialog = filesShareDialog(page)
    await expect(dialog).toBeVisible({ timeout: T(15000) })

    const recipient = dialog.locator(
      '[data-test-id="files-share-recipient"], .row_new_share input.input, input.input'
    ).first()
    await expect(recipient).toBeVisible({ timeout: T(15000) })
    await recipient.click()
    await recipient.fill(email)

    const suggestion = page
      .locator('.ui-autocomplete .ui-menu-item')
      .filter({
        hasText: new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
      })
      .first()
    const suggestionVisible = await suggestion
      .waitFor({ state: 'visible', timeout: T(30000) })
      .then(() => true)
      .catch(() => false)
    if (!suggestionVisible) {
      const alertText = (
        await page
          .locator('.alert.popup:visible .text, .alert.popup:visible')
          .first()
          .innerText()
          .catch(() => '')
      ).trim()
      throw new Error(
        `Share autocomplete has no teammate "${email}". ` +
          `E2E_LOGIN_SECONDARY must be a user on the same tenant as PRIMARY.` +
          (alertText ? ` UI: ${alertText}` : '')
      )
    }
    await clickReady(suggestion)

    const access = dialog.locator(
      '[data-test-id="files-share-access"], .new_share_access_select, .row_new_share .control'
    ).first()
    if (await access.isVisible().catch(() => false)) {
      await clickReady(access)
      const readOption = dialog
        .locator('.new_share_access_select .dropdown_content .item, .dropdown_content .item')
        .first()
      if (await readOption.isVisible({ timeout: T(5000) }).catch(() => false)) {
        await clickReady(readOption)
      }
    }

    const entry = dialog
      .locator('[data-test-id="files-share-entry"], .item_share')
      .filter({
        hasText: new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
      })
      .first()
    await expect(entry).toBeVisible({ timeout: T(15000) })

    const save = dialog
      .locator(
        '[data-test-id="files-share-save"], .buttons .button:not(.secondary_button):not(.contour_button)'
      )
      .first()
    await clickReady(save)
    await expect(dialog).toBeHidden({ timeout: T(60000) })
    await attachScreenshot(page, 'files-after-share-save')
  })
}

/**
 * Open rename dialog after clicking rename; retry via .item.edit if needed.
 * @param {string=} name Re-select this item by name right before clicking
 *   rename -- selection can silently drop between an earlier select-click
 *   and this call (see uploadFileViaFab), making renameCommand's click a
 *   silent no-op instead of opening the dialog.
 * @returns {import('@playwright/test').Locator} visible rename dialog
 */
async function openRenameDialog(page, name) {
  const renameControl = page.getByTestId('files-menu-rename')
  if ((await renameControl.count()) === 0) {
    return null
  }
  if (name) {
    const item = page.getByTestId('files-item').filter({ hasText: name }).first()
    await clickItemToSelect(item)
  }
  await clickReady(renameControl)
  const dialog = page.getByTestId('files-rename-dialog')
  // A single click is enough — the popup may just take a moment to render.
  // isVisible() does not poll, so we wait properly instead of re-clicking
  // (a re-click here would hit the now-open dialog's own mask).
  await expect(dialog).toBeVisible({ timeout: T(15000) })
  return dialog
}

module.exports = {
  listReadyOptions,
  fixturePath: defaultFixturePath,
  openFiles,
  waitForFilesList,
  openNewItemsMenu,
  createFolder,
  uploadFixture,
  uploadFileViaFab,
  openFileByName,
  deleteOpenedFile,
  deleteItemByName,
  selectFilesItem,
  navigateToStorageRoot,
  openPersonalStorage,
  openSharedStorage,
  shareFileWithTeammate,
  shareToolbarButton,
  waitForShareToolbar,
  clickShareToolbarAction,
  leaveShareToolbarButton,
  clickLeaveShareToolbarAction,
  filesShareDialog,
  openRenameDialog,
  enabledToolbarButton,
  clickCutCopyPasteAction,
  waitForCutCopyPastePlugin,
  waitForPasteEnabled,
  waitForClipboardItems,
  openFolderItemByName,
  pasteIntoCurrentFolder,
  dismissAlertIfVisible,
  confirmOkIfVisible,
  waitForListReady,
  clickReady,
  step,
  attachScreenshot,
}
