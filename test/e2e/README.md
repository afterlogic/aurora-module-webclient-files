# Desktop E2E (Playwright)

Scenarios for **FilesWebclient**. Runner lives at the Aurora install root:

```bash
# from install root
npm run test:e2e-desktop
./modules/CoreWebclient/test/e2e/run.sh

# this module only (Chrome)
npm run test:e2e-desktop -- --setup "FilesWebclient Chrome"
```

Shared helpers: `modules/CoreWebclient/test/e2e/helpers/` (`AURORA_E2E_ROOT`).
Domain helpers: `./helpers/` in this folder.

Filter Playwright UI / CLI by **file name** or nested `test.describe`.

| File | What it covers |
|------|----------------|
| `files.spec.js` | Open first file, list + create folder + upload |
| `files-actions.spec.js` | Storages, search, New folder/upload, rename, public link, cut/paste |
| `files-shortcut.spec.js` | New → Create shortcut, open external URL, delete |
| `files-extra-actions.spec.js` | Multi-select copy, download, rename folder |
| `files-select-actions.spec.js` | Copy, bulk delete, Share with teammates, leave share |
| `files-share-multiuser.spec.js` | PRIMARY shares → SECONDARY sees Shared |
| `files-storages-send.spec.js` | Personal / Corporate / Shared, send as email, Trash restore |
| `files-zip.spec.js` | Open uploaded zip as a folder |
| `files-zip-selected.spec.js` | Open selected zip as a folder |
| `files-navigation.spec.js` | Nested folders + breadcrumbs, text preview |

## Stand gates

- **Shared storage tab** — skipped when `[data-storage-type="shared"]` is absent (`files-storages-send.spec.js`).
- **Open zip as folder** — `FilesZipFolder`: upload `.zip` → open as folder (`files-zip.spec.js`, `files-zip-selected.spec.js`). Skip when the zip stays a file (module disabled). Desktop Files has **no** “compress selection to zip” toolbar action.
