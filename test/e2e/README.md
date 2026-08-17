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

## Known product / stand notes

- **Shared storage tab** — skipped when `[data-storage-type="shared"]` is absent (`files-storages-send.spec.js`).
- **Open zip as folder** — `FilesZipFolder`: upload `.zip` → open as folder (`files-zip.spec.js`, `files-zip-selected.spec.js`). Skip when the zip stays a file (module disabled). Desktop Files has **no** “compress selection to zip” toolbar action.
