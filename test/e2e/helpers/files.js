const path = require('path')
const { sharedHelper, fixturePath } = require(path.join(
  process.env.AURORA_E2E_ROOT,
  'helpers/paths'
))
const fs = require('fs')
const { expect } = require('@playwright/test')
const { step, attachScreenshot, fieldControl } = sharedHelper('login')
const { waitForListReady, clickReady, clickNav, confirmOkIfVisible } = sharedHelper('ready')

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
      timeout: 60000,
    })
    await waitForListReady(page, listReadyOptions)
  })
}

async function waitForFilesList(page) {
  await expect(page.getByTestId('files-list')).toBeVisible({
    timeout: 30000,
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
      timeout: 15000,
    })
    await fieldControl(page, 'files-create-folder-name').fill(folderName)
    await clickReady(page.getByTestId('files-create-folder-ok'))
    await expect(page.getByTestId('files-create-folder-dialog')).toBeHidden({
      timeout: 30000,
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
  await expect(item).toBeVisible({ timeout: 90000 })
  return item
}

async function openFileByName(page, name) {
  const item = page.getByTestId('files-item').filter({ hasText: name }).first()
  await expect(item).toBeVisible({ timeout: 30000 })
  await clickReady(item)
  await expect(item)
    .toHaveClass(/selected|checked/, { timeout: 10000 })
    .catch(() => undefined)
  return item
}

async function deleteOpenedFile(page, name) {
  await clickReady(page.getByTestId('files-delete'))
  // Trash path often deletes without ConfirmPopup (deleteItems(..., true)).
  await confirmOkIfVisible(page, 5000)
  await waitForFilesList(page)
  await expect(
    page.getByTestId('files-item').filter({ hasText: name })
  ).toHaveCount(0, { timeout: 60000 })
}

async function deleteItemByName(page, name) {
  await step(`Delete item ${name}`, async () => {
    const item = page
      .getByTestId('files-item')
      .filter({ hasText: name })
      .first()
    await clickReady(item)
    await clickReady(page.getByTestId('files-delete'))
    await confirmOkIfVisible(page, 5000)
    await waitForListReady(page, listReadyOptions)
  })
}

async function selectFilesItem(page, item, { modifiers } = {}) {
  await item.scrollIntoViewIfNeeded()
  if (modifiers && modifiers.length) {
    await item.click({ modifiers })
  } else {
    await clickReady(item)
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
 * @returns {import('@playwright/test').Locator} visible rename dialog
 */
async function openRenameDialog(page) {
  const renameControl = page.getByTestId('files-menu-rename')
  if ((await renameControl.count()) === 0) {
    return null
  }
  await clickReady(renameControl)
  const dialog = page
    .locator(
      '[data-test-id="files-rename-dialog"], .files_popup.rename_popup, .rename_popup'
    )
    .first()
  if (!(await dialog.isVisible({ timeout: 5000 }).catch(() => false))) {
    const edit = page.locator('.item.edit, [data-test-id="files-menu-rename"]').first()
    if (await edit.isVisible().catch(() => false)) {
      await clickReady(edit)
    }
  }
  await expect(dialog).toBeVisible({ timeout: 15000 })
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
