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

async function openFileByName(page, name) {
  const item = page.getByTestId('files-item').filter({ hasText: name }).first()
  await expect(item).toBeVisible({ timeout: T(30000) })
  await clickReady(itemClickTarget(item))
  await expect(item)
    .toHaveClass(/selected|checked/, { timeout: T(10000) })
    .catch(() => undefined)
  return item
}

async function deleteOpenedFile(page, name) {
  // Re-select right before acting: selection can silently drop between the
  // caller's earlier select-click and this call (see uploadFileViaFab for
  // why), and deleteCommand's canExecute is gated on something being
  // selected -- a stale/lost selection makes this click a silent no-op.
  const item = page.getByTestId('files-item').filter({ hasText: name }).first()
  await clickReady(itemClickTarget(item))
  await expect(item).toHaveClass(/selected|checked/, { timeout: 10000 })
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
    await clickReady(target)
  }
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
    await clickReady(itemClickTarget(item))
    await expect(item).toHaveClass(/selected|checked/, { timeout: 10000 })
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
  openRenameDialog,
  confirmOkIfVisible,
  waitForListReady,
  clickReady,
  step,
  attachScreenshot,
}
