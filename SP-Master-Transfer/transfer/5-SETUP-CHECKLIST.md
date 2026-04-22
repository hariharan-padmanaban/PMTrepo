# SharePoint Integration — Setup Checklist

Use this to verify your setup is complete before deploying.

---

## Pre-Setup

- [ ] Node.js 18+ installed (`node --version`)
- [ ] Power Platform CLI installed (`pac --version`)
- [ ] Authenticated with Power Platform (`pac auth list` shows your environment)
- [ ] Power Apps Code App created (`pac code push` has been run once)
- [ ] SharePoint Online site has a document library
- [ ] You have write permissions to the library

---

## Code Setup

- [ ] Copied `SharePointIntegration.tsx` to `src/` directory
- [ ] Updated `SP_SITE_URL` with your SharePoint site URL
- [ ] Updated `SP_LIBRARY_NAME` with your library name
- [ ] Imported the component in `src/App.tsx`
- [ ] TypeScript compiles without errors (`tsc -b`)
- [ ] No import errors in IDE

---

## Schema Setup

In `.power/schemas/appschemas/dataSourcesInfo.ts`:

- [ ] Found the `"documents"` data source
- [ ] Found the `"apis"` object inside documents
- [ ] Added `"CreateFile"` operation with:
  - [ ] Path: `"/{connectionId}/datasets/{dataset}/files"`
  - [ ] Method: `"POST"`
  - [ ] Parameters include: folderPath, name, body, Content-Type header
- [ ] Added `"GetFileContent"` operation with:
  - [ ] Path: `"/{connectionId}/datasets/{dataset}/files/{id}/content"`
  - [ ] Method: `"GET"`
  - [ ] Parameters include: id
- [ ] Added `"DeleteFile"` operation with:
  - [ ] Path: `"/{connectionId}/datasets/{dataset}/files/{id}"`
  - [ ] Method: `"DELETE"`
  - [ ] Parameters include: id

**Quick verification:** File should end with operations added before final closing braces.

---

## SDK Patch Verification

In `node_modules/@microsoft/power-apps/dist/internal/data/core/runtimeClient/runtimeDataClient.js`:

- [ ] Found the `_executeRequest` method (around line 320)
- [ ] Found the line: `config.headers?.['Content-Type'] === 'application/octet-stream'`
- [ ] Code after that contains:
  - [ ] `let raw = typeof config.body === 'string' ? config.body : '';`
  - [ ] `if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1);`
  - [ ] `const bin = atob(raw);`
  - [ ] `new Uint8Array` creation
  - [ ] Comment saying "PATCH: decode base64"

**If patch is missing:** See SHAREPOINT-INTEGRATION-COMPLETE.md Section 4

---

## Package Configuration

In `package.json`:

- [ ] Dependency: `@microsoft/power-apps` version 1.0.3+
- [ ] Dev dependency: `@microsoft/power-apps-vite`
- [ ] If using patch-package:
  - [ ] `postinstall` script includes `"patch-package"`
  - [ ] `patches/` folder exists (if manually applied)

---

## Build & Deploy

- [ ] Build succeeds: `npm run build` (no errors)
  - [ ] `dist/` folder created
  - [ ] `dist/index.html` exists
  - [ ] No TypeScript errors
- [ ] All changes committed (if using git)

---

## Pre-Deployment Test (Local)

Before deploying, test locally (optional):

```bash
npx power-apps run
```

- [ ] App loads in browser
- [ ] Can select a file
- [ ] Upload button is visible
- [ ] Documents list loads
- [ ] No errors in browser console

---

## Deployment

```bash
pac code push
```

- [ ] Command completes without errors
- [ ] App URL is printed in output
- [ ] "App pushed successfully" message shown

---

## Post-Deployment Test

Open your app from the provided URL:

- [ ] App loads without errors
- [ ] Documents list shows files (if any exist)
- [ ] Can select a file from file picker
- [ ] Can click Upload button
- [ ] Can see success/error toast notification
- [ ] After upload, new file appears in list
- [ ] Can click Download for a file
- [ ] Downloaded file opens correctly (not corrupted)
- [ ] Can click Delete for a file
- [ ] Confirmation dialog appears
- [ ] After delete, file is removed from list
- [ ] Refresh button works (reloads list)

---

## If Tests Fail

| Test | Error | Check |
|------|-------|-------|
| Upload | "Cannot read properties undefined (reading 'path')" | Verify file operations in dataSourcesInfo.ts are added correctly |
| Upload | "Upload failed: File too large" | SharePoint limit is usually 250MB, check size |
| Download | "Download failed" or blank file | Verify SDK patch is applied (atob decoding present) |
| Delete | "Delete succeeded" but file remains | Verify refresh works, check browser console for errors |
| List | "No documents found" | Check SP_SITE_URL and SP_LIBRARY_NAME are correct |
| List | Nothing loads | Check browser console, verify network access to SharePoint |

---

## Success Criteria

✅ All checklist items above are checked  
✅ App builds without errors  
✅ App deploys without errors  
✅ All four operations work (upload, download, list, delete)  
✅ Files are properly stored on SharePoint (not corrupted)  
✅ Toast notifications show success/error messages  

---

## Share With Peers

Before handing off the transfer folder to teammates:

- [ ] Copy entire `transfer/` folder
- [ ] Have them start with README.md
- [ ] Point them to QUICK-SETUP.md for speed
- [ ] Mention the SDK patch is critical
- [ ] Keep this checklist for reference

---

## Common Setup Mistakes

❌ **Forgot to add file operations** → Operation not found error  
❌ **SDK patch not applied** → Files upload corrupted  
❌ **Wrong SP_SITE_URL format** → List returns empty  
❌ **Used environment variables** → Not available in Power Apps SDK  
❌ **Copied only component without schema updates** → Upload/download fail  
❌ **Running `pac code pull` after setup** → Overwrites file operations (need to re-add)  

---

**Created:** 2026-04-17  
**For:** Power Apps Code Apps (React + Vite)  
**Status:** Ready for production use ✅
