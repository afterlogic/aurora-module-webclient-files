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

function filesItemsByName(page, name) {
  return page
    .locator(
      [
        '[data-test-id="files-item"]',
        '.items_list .item.file',
        '.items_list .item.folder',
        '.item_list_table_view .item.file',
        '.item_list_table_view .item.folder2',
      ].join(', ')
    )
    .filter({ hasText: name })
}

function filesItemByName(page, name) {
  return filesItemsByName(page, name).first()
}

const defaultFixturePath = fixturePath('e2e-attach.txt')

async function isFilesListLoading(page) {
  const empty = page.getByTestId('files-empty')
  if (!(await empty.isVisible().catch(() => false))) {
    return false
  }
  const text = (await empty.innerText().catch(() => '')).trim()
  return /loading/i.test(text)
}

async function waitForFilesList(page) {
  await expect(page.getByTestId('files-list')).toBeVisible({
    timeout: T(60000),
  })
  // files-empty is reused for INFO_LOADING — waitForListReady would treat
  // that as a settled empty list after 2s.
  await expect
    .poll(async () => !(await isFilesListLoading(page)), {
      timeout: T(60000),
    })
    .toBe(true)
  await waitForListReady(page, listReadyOptions)
}

async function openFiles(page) {
  await step('Open Files', async () => {
    await clickNav(page, 'nav-files')
    await waitForFilesList(page)
  })
}

function storageItem(page, type) {
  return page
    .locator(
      `[data-test-id="files-storage-item"][data-storage-type="${type}"]`
    )
    .first()
}

async function waitForStoragesSidebar(page) {
  await expect(page.getByTestId('files-storage-item').first()).toBeVisible({
    timeout: T(30000),
  })
}

/** True if the storage row is in the DOM (may be below the sidebar fold). */
async function storageTabAvailable(page, type, timeout = T(15000)) {
  const item = storageItem(page, type)
  return item
    .waitFor({ state: 'attached', timeout })
    .then(() => true)
    .catch(() => false)
}

async function clickStorageItem(page, item) {
  await item.scrollIntoViewIfNeeded()
  await clickReady(item)
}

async function openNewItemsMenu(page) {
  const folderItem = page.getByTestId('files-create-folder')
  // Dropdown toggles on each click — do not close an already-open menu.
  if (await folderItem.isVisible().catch(() => false)) {
    return
  }
  await clickReady(
    page
      .getByTestId('files-new-menu')
      .locator('.control.button, .button')
      .first()
  )
  await expect(folderItem).toBeVisible({ timeout: T(15000) })
}

async function closeNewItemsMenu(page) {
  const folderItem = page.getByTestId('files-create-folder')
  if (!(await folderItem.isVisible().catch(() => false))) {
    return
  }
  await page.keyboard.press('Escape').catch(() => undefined)
  if (await folderItem.isVisible().catch(() => false)) {
    // Escape may not close the Knockout dropdown — toggle via the New button.
    await clickReady(
      page
        .getByTestId('files-new-menu')
        .locator('.control.button, .button')
        .first()
    )
  }
  await expect(folderItem).toBeHidden({ timeout: T(10000) }).catch(() => undefined)
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

/**
 * True when New → Create shortcut is available (not DisableShortcuts / wrong storage).
 */
async function isCreateShortcutAvailable(page) {
  await openNewItemsMenu(page)
  const item = page.getByTestId('files-create-shortcut')
  const visible = await item.isVisible().catch(() => false)
  await closeNewItemsMenu(page)
  return visible
}

/**
 * Match Files API form posts (Module/Method in urlencoded body).
 */
function isFilesApiMethod(res, methodName) {
  if (!res.url().includes('Api')) return false
  if (res.request().method() !== 'POST') return false
  const post = res.request().postData() || ''
  return (
    post.includes(`Method=${methodName}`) ||
    post.includes(`"Method":"${methodName}"`) ||
    post.includes(`Method%22%3A%22${methodName}`)
  )
}

/** Tolerate non-JSON prefixes in Aurora API bodies. */
function parseApiResponseText(text) {
  const trimmed = String(text || '').trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) {
      return null
    }
    try {
      return JSON.parse(trimmed.slice(start, end + 1))
    } catch {
      return null
    }
  }
}

/**
 * Strip PHP notice HTML that local stands emit before JSON when display_errors=On.
 * Desktop jQuery Ajax uses a strict JSON parse; a `<br /><b>Deprecated</b>…`
 * prefix becomes DataTransferFailed, so Create shortcut never enables Add.
 * Production typically has display_errors=Off — this keeps E2E aligned with that.
 */
function stripPhpNoticePrefix(body) {
  const text = String(body || '')
  const trimmed = text.trimStart()
  if (!trimmed.startsWith('<')) {
    return text
  }
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start === -1 || end <= start) {
    return text
  }
  return trimmed.slice(start, end + 1)
}

async function installApiJsonSanitizeRoute(page) {
  if (page.__auroraApiJsonSanitize) {
    return
  }
  page.__auroraApiJsonSanitize = true
  const handler = async (route) => {
    try {
      const response = await route.fetch()
      const headers = { ...response.headers() }
      const raw = await response.text()
      const body = stripPhpNoticePrefix(raw)
      // Drop length so Playwright / browser recompute for the rewritten body.
      delete headers['content-length']
      await route.fulfill({
        status: response.status(),
        headers,
        body,
      })
    } catch {
      // Test ended or request aborted while a route was in flight.
      try {
        await route.abort()
      } catch {
        // ignore
      }
    }
  }
  page.__auroraApiJsonSanitizeHandler = handler
  await page.route((url) => String(url).includes('?/Api'), handler)
}

async function uninstallApiJsonSanitizeRoute(page) {
  if (!page.__auroraApiJsonSanitize) {
    return
  }
  const handler = page.__auroraApiJsonSanitizeHandler
  page.__auroraApiJsonSanitize = false
  page.__auroraApiJsonSanitizeHandler = null
  if (handler) {
    await page
      .unroute((url) => String(url).includes('?/Api'), handler)
      .catch(() => {})
  }
}

/**
 * URL for Create shortcut that PHP CheckUrl can probe without outbound internet.
 * Prefer 127.0.0.1 (avoids IPv6/localhost curl quirks) and a unique path for Name.
 */
function uniqueShortcutUrl() {
  const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8888/'
  let origin = 'http://127.0.0.1:8888'
  try {
    const u = new URL(base)
    if (u.hostname === 'localhost') {
      u.hostname = '127.0.0.1'
    }
    origin = u.origin
  } catch {
    // keep default
  }
  // Non-html path: CheckUrl uses the basename (unique) instead of an HTML <title>
  // like "404 Not Found" / the site title that collides across runs.
  return `${origin}/e2e-sc-${Date.now()}.txt`
}

/**
 * Wait until CheckUrl succeeds for this URL (UI enables Add shortcut).
 */
async function waitForShortcutCheckUrl(page, url) {
  const submit = page.getByTestId('files-create-link-submit')
  const token = (url.match(/e2e-sc-\d+/) || [url])[0]
  let checkResult = null
  let lastCheckBody = null
  let lastRawSnippet = ''
  let sawMatchingRequest = false
  let sawPhpNoticePrefix = false

  const onResponse = async (res) => {
    try {
      if (!isFilesApiMethod(res, 'CheckUrl')) return
      const post = res.request().postData() || ''
      if (!post.includes(token) && !post.includes(encodeURIComponent(token))) {
        return
      }
      sawMatchingRequest = true
      const raw = await res.text()
      lastRawSnippet = String(raw || '').slice(0, 240).replace(/\s+/g, ' ')
      if (/<(br|b)\b/i.test(raw) && /Deprecated|Warning/i.test(raw)) {
        sawPhpNoticePrefix = true
      }
      const body = parseApiResponseText(raw)
      lastCheckBody = body
      if (body?.Result) {
        checkResult = body.Result
      }
    } catch {
      // ignore parse races
    }
  }

  page.on('response', onResponse)
  try {
    await expect(submit).not.toHaveClass(/disabled/, { timeout: T(45000) })
  } catch (e) {
    const err = new Error(
      `Files.CheckUrl did not enable Add shortcut for "${url}". ` +
        `sawMatchingRequest=${sawMatchingRequest}. ` +
        `sawPhpNoticePrefix=${sawPhpNoticePrefix}. ` +
        `Last API body: ${JSON.stringify(lastCheckBody)}. ` +
        `Raw snippet: ${lastRawSnippet}`
    )
    err.code = 'CHECK_URL_FAILED'
    throw err
  } finally {
    page.off('response', onResponse)
  }

  return checkResult
}

/**
 * Set CreateLinkPopup URL via Knockout observable (valueUpdate typing is flaky in PW).
 */
async function fillShortcutUrlInput(page, url) {
  const urlInput = fieldControl(page, 'files-create-link-url')
  await expect(urlInput).toBeVisible({ timeout: T(10000) })
  await urlInput.click()

  const setOk = await page.evaluate((value) => {
    const el = document.querySelector(
      'input[data-test-id="files-create-link-url"], [data-test-id="files-create-link-url"] input'
    )
    if (!el) {
      return false
    }
    el.focus()
    el.value = value
    if (window.ko) {
      try {
        const ctx = window.ko.contextFor(el)
        if (ctx && ctx.$data && typeof ctx.$data.link === 'function') {
          ctx.$data.link(value)
          return true
        }
      } catch (e) {
        // fall through
      }
    }
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.dispatchEvent(
      new KeyboardEvent('keyup', { bubbles: true, key: 'a', keyCode: 65 })
    )
    if (typeof window.jQuery === 'function') {
      window.jQuery(el).val(value).trigger('input').trigger('keyup')
    }
    return true
  }, url)

  if (!setOk) {
    await urlInput.fill(url)
  }
  // CreateLinkPopup polls CheckUrl about once per second after open.
  await page.waitForTimeout(1200)
}

/**
 * New → Create shortcut → CheckUrl → CreateLink.
 * @returns {{ name: string, url: string, item: import('@playwright/test').Locator }}
 */
async function createShortcut(page, url) {
  await installApiJsonSanitizeRoute(page)
  await openNewItemsMenu(page)
  const shortcutEntry = page.getByTestId('files-create-shortcut')
  await expect(shortcutEntry).toBeVisible({ timeout: T(15000) })
  await clickReady(shortcutEntry)

  const dialog = page.getByTestId('files-create-link-dialog')
  await expect(dialog).toBeVisible({ timeout: T(15000) })

  const checkResultPromise = waitForShortcutCheckUrl(page, url)
  await fillShortcutUrlInput(page, url)

  const checkResult = await checkResultPromise

  let name = String(checkResult?.Name || '').trim()
  if (!name) {
    name = (
      await dialog
        .locator('.attachments .name, .item.file .name, .item .name')
        .first()
        .textContent()
        .catch(() => '')
    ).trim()
  }
  if (!name) {
    const err = new Error(
      `Files.CheckUrl did not yield a name for "${url}"`
    )
    err.code = 'CHECK_URL_FAILED'
    throw err
  }

  const submit = page.getByTestId('files-create-link-submit')
  const createRespPromise = page.waitForResponse(
    (res) => isFilesApiMethod(res, 'CreateLink'),
    { timeout: T(60000) }
  )
  await clickReady(submit)
  const createResp = await createRespPromise
  const createBody = parseApiResponseText(await createResp.text())
  if (!createBody?.Result) {
    throw new Error(
      `Files.CreateLink failed for "${url}": ${JSON.stringify(createBody)}`
    )
  }

  await expect(dialog).toBeHidden({ timeout: T(30000) })
  await waitForFilesList(page)

  const item = filesItemByName(page, name)
  const visible = await item
    .waitFor({ state: 'visible', timeout: T(30000) })
    .then(() => true)
    .catch(() => false)
  if (!visible) {
    const withExt = filesItemByName(page, `${name}.url`)
    await expect(withExt).toBeVisible({ timeout: T(60000) })
    return { name: `${name}.url`, url, item: withExt }
  }
  return { name, url, item }
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
  sourcePath = defaultFixturePath,
  { mimeType = 'text/plain' } = {}
) {
  await openNewItemsMenu(page)
  const fileInput = page.locator('input[type="file"]').first()
  const buffer = fs.readFileSync(sourcePath)
  if ((await fileInput.count()) > 0) {
    await fileInput.setInputFiles({
      name: uniqueName,
      mimeType,
      buffer,
    })
  } else {
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      clickReady(page.getByTestId('files-upload')),
    ])
    await fileChooser.setFiles({
      name: uniqueName,
      mimeType,
      buffer,
    })
  }

  const item = filesItemByName(page, uniqueName)
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
  const item = filesItemByName(page, name)
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
  const folder = filesItemByName(page, folderName)
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
  const item = filesItemByName(page, name)
  await clickItemToSelect(item)
  await clickReady(page.getByTestId('files-delete'))
  // Trash path often deletes without ConfirmPopup (deleteItems(..., true)).
  await confirmOkIfVisible(page, 5000)
  await waitForFilesList(page)
  await expect(filesItemsByName(page, name)).toHaveCount(0, { timeout: T(60000) })
}

async function deleteItemByName(page, name) {
  await step(`Delete item ${name}`, async () => {
    const item = filesItemByName(page, name)
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
      '[data-test-id="files-breadcrumb"], .files_panel .path a, .panel.files .path a, .pathway a, .breadcrumbs a'
    )
    const count = await crumbs.count()
    if (count <= 1) break
    await clickReady(crumbs.first())
    await waitForFilesList(page)
  }
}

async function openPersonalStorage(page) {
  await navigateToStorageRoot(page)
  await waitForStoragesSidebar(page)
  const personal = storageItem(page, 'personal')
  if (await storageTabAvailable(page, 'personal', T(5000))) {
    await clickStorageItem(page, personal)
  } else {
    await clickStorageItem(page, page.getByTestId('files-storage-item').first())
  }
  await waitForFilesList(page)
}

async function openSharedStorage(page) {
  await navigateToStorageRoot(page)
  await waitForStoragesSidebar(page)
  const shared = storageItem(page, 'shared')
  await expect(shared).toBeAttached({ timeout: T(30000) })
  await clickStorageItem(page, shared)
  await waitForFilesList(page)
}

async function openStorageByType(page, type) {
  await navigateToStorageRoot(page)
  await waitForStoragesSidebar(page)
  const storage = storageItem(page, type)
  if (!(await storageTabAvailable(page, type, T(5000)))) {
    return false
  }
  await clickStorageItem(page, storage)
  await waitForFilesList(page)
  return true
}

async function openCorporateStorage(page) {
  return openStorageByType(page, 'corporate')
}

async function openTrashStorage(page) {
  return openStorageByType(page, 'trash')
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
    const item = filesItemByName(page, name)
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

function resolvePublicLinkUrl(link, baseURL) {
  const trimmed = String(link || '').trim()
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }
  try {
    return new URL(trimmed, baseURL).href
  } catch {
    return trimmed
  }
}

/**
 * Open public-link dialog for the selected file and wait until the URL field is populated.
 * @returns {Promise<string>} absolute or app-relative public link URL
 */
async function createPublicLinkUrl(page) {
  const shareBtn = page.getByTestId('files-menu-public-link')
  await clickReady(shareBtn)
  await expect(page.getByTestId('files-share-link-dialog')).toBeVisible({
    timeout: T(15000),
  })
  const urlInput = page.getByTestId('files-share-link-url')
  await expect
    .poll(
      async () => (await urlInput.inputValue().catch(() => urlInput.innerText())).trim(),
      { timeout: T(45000) }
    )
    .not.toBe('')
  return (await urlInput.inputValue().catch(() => urlInput.innerText())).trim()
}

/** Close share-link dialog without revoking the link (Close button / Escape). */
async function closeShareLinkDialog(page) {
  const dialog = page.getByTestId('files-share-link-dialog')
  if (!(await dialog.isVisible().catch(() => false))) {
    return
  }
  const closeBtn = dialog.locator('.button.secondary_button').first()
  if (await closeBtn.isVisible().catch(() => false)) {
    await clickReady(closeBtn)
  } else {
    await page.keyboard.press('Escape').catch(() => undefined)
  }
  await expect(dialog).toBeHidden({ timeout: T(15000) })
}

/** Remove public link via the open share-link dialog. */
async function removePublicLinkFromDialog(page) {
  const dialog = page.getByTestId('files-share-link-dialog')
  if (!(await dialog.isVisible().catch(() => false))) {
    const shareBtn = page.getByTestId('files-menu-public-link')
    if ((await shareBtn.count()) === 0) {
      return
    }
    await clickReady(shareBtn)
    await expect(dialog).toBeVisible({ timeout: T(15000) })
  }
  await clickReady(page.getByTestId('files-share-link-remove'))
  await expect(dialog).toBeHidden({ timeout: T(45000) })
}

module.exports = {
  listReadyOptions,
  fixturePath: defaultFixturePath,
  filesItemByName,
  filesItemsByName,
  openFiles,
  waitForFilesList,
  openNewItemsMenu,
  closeNewItemsMenu,
  createFolder,
  isCreateShortcutAvailable,
  uniqueShortcutUrl,
  installApiJsonSanitizeRoute,
  uninstallApiJsonSanitizeRoute,
  createShortcut,
  uploadFixture,
  uploadFileViaFab,
  openFileByName,
  deleteOpenedFile,
  deleteItemByName,
  selectFilesItem,
  navigateToStorageRoot,
  storageItem,
  waitForStoragesSidebar,
  storageTabAvailable,
  openPersonalStorage,
  openSharedStorage,
  openCorporateStorage,
  openTrashStorage,
  openStorageByType,
  shareFileWithTeammate,
  shareToolbarButton,
  waitForShareToolbar,
  clickShareToolbarAction,
  leaveShareToolbarButton,
  clickLeaveShareToolbarAction,
  filesShareDialog,
  openRenameDialog,
  resolvePublicLinkUrl,
  createPublicLinkUrl,
  closeShareLinkDialog,
  removePublicLinkFromDialog,
  itemClickTarget,
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
