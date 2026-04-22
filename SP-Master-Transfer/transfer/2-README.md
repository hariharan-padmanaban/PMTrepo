# SharePoint Integration Kit for Power Apps Code Apps

Complete, production-ready solution for SharePoint file management with static configuration.

**Supports:** Upload, Download, List, Delete files to/from SharePoint Online  
**Tested with:** .txt, .docx, .pdf, and all binary file types  
**Perfect for:** Copying to other projects, sharing with peers

---

## 📁 What's in This Folder

| File | Purpose |
|------|---------|
| **QUICK-SETUP.md** | 5-minute setup guide — start here! |
| **SHAREPOINT-INTEGRATION-COMPLETE.md** | Comprehensive guide with all details, troubleshooting |
| **SharePointIntegration.tsx** | Ready-to-use React component — copy directly into your project |
| **dataSourcesInfo-operations.json** | Copy-paste file operations for dataSourcesInfo.ts |
| **README.md** | This file |

---

## 🚀 Quick Start

1. **Read** → `QUICK-SETUP.md` (5 minutes)
2. **Copy** → `SharePointIntegration.tsx` to your `src/` directory
3. **Configure** → Update SP_SITE_URL and SP_LIBRARY_NAME in the component
4. **Add operations** → Copy operations from dataSourcesInfo-operations.json into your schema
5. **Deploy** → `npm run build && pac code push`

That's it! ✅

---

## 📚 When You Need More Details

Read **SHAREPOINT-INTEGRATION-COMPLETE.md** for:

- Prerequisites and environment setup
- Why binary uploads fail without the SDK patch
- How the SDK patch works
- Detailed setup for the file operations
- All four operations (upload, download, list, delete)
- Complete troubleshooting guide
- Code examples you can customize

---

## 🔧 Integration Path

```
Your Power Apps Project
  │
  ├─ Copy SharePointIntegration.tsx → src/
  │
  ├─ Update configuration (SP_SITE_URL, SP_LIBRARY_NAME)
  │
  ├─ Add three operations to .power/schemas/appschemas/dataSourcesInfo.ts
  │    (Use dataSourcesInfo-operations.json as reference)
  │
  ├─ Verify SDK patch is applied
  │    (Check node_modules/@microsoft/power-apps/... has atob decoding)
  │
  └─ Deploy: pac code push
```

---

## 📖 Component Features

The **SharePointIntegration.tsx** component includes:

✅ **Upload files** to SharePoint library  
✅ **Download files** with proper binary decoding  
✅ **List all files** in the library  
✅ **Delete files** with confirmation  
✅ **Toast notifications** for success/error feedback  
✅ **Loading states** for all operations  
✅ **Error handling** with detailed messages  
✅ **Static configuration** (no environment variables needed)  

---

## 🛠️ Prerequisites

- Node.js 18+
- Power Platform CLI (`pac`)
- Power Platform environment with auth
- SharePoint Online site with a document library
- Existing Power Apps Code App (React + Vite)

Verify setup:
```bash
pac auth list
```

---

## 📝 How to Use in Your Project

### Option 1: Drop-in Component (Recommended)

```tsx
// src/App.tsx
import SharePointIntegration from './SharePointIntegration';

export default function App() {
  return <SharePointIntegration />;
}
```

Edit the config in `SharePointIntegration.tsx`:
```tsx
const SP_SITE_URL = 'https://your-org.sharepoint.com/sites/your-site'
const SP_LIBRARY_NAME = 'Shared Documents'
```

### Option 2: Customize the Code

Use `SharePointIntegration.tsx` as a reference and build your own component. Key functions to copy:

- `readFileAsBase64()` — Convert file to base64
- `handleUpload()` — Upload file via CreateFile operation
- `handleDownload()` — Download file via GetFileContent operation
- `fetchFiles()` — List files via DocumentsService.getAll()
- `handleDelete()` — Delete file via DocumentsService.delete()

---

## ⚠️ Critical Setup Steps

### 1. Add File Operations to Schema

**File:** `.power/schemas/appschemas/dataSourcesInfo.ts`

Find the `"documents"` data source's `"apis"` object and add:
- `CreateFile` (for upload)
- `GetFileContent` (for download)
- `DeleteFile` (exists but not needed with current setup)

Copy from `dataSourcesInfo-operations.json` in this folder.

### 2. Verify SDK Patch

**File:** `node_modules/@microsoft/power-apps/dist/internal/data/core/runtimeClient/runtimeDataClient.js`

Look for lines around 324 where `application/octet-stream` is checked. You should see:
```js
// PATCH: decode base64 body to raw binary for file upload
...
const bin = atob(raw);
...
```

If missing, see **SHAREPOINT-INTEGRATION-COMPLETE.md** Section 4.

### 3. Update Configuration

In `SharePointIntegration.tsx`, update:
```tsx
const SP_SITE_URL = 'https://YOUR-TENANT.sharepoint.com/sites/YOUR-SITE'
const SP_LIBRARY_NAME = 'Your Library Name'
```

---

## 🐛 Troubleshooting

### Upload Fails with "Cannot read properties of undefined (reading 'path')"

**Cause:** File operations not in dataSourcesInfo.ts

**Fix:** Add CreateFile, GetFileContent, DeleteFile operations (see above)

### Upload Succeeds but File is Corrupted

**Cause:** SDK patch not applied

**Fix:** Apply the patch or reinstall packages

### Delete Shows Success but File Remains

**Cause:** Refresh not working properly

**Fix:** Check browser console for errors, verify file ID format

### DocumentsService Not Found

**Cause:** Not generated yet

**Fix:** Run `pac code pull` after connecting SharePoint in Power Apps Studio

---

## 📞 Need Help?

1. **Quick question?** Check **QUICK-SETUP.md**
2. **More details?** Read **SHAREPOINT-INTEGRATION-COMPLETE.md**
3. **Specific error?** See Troubleshooting section above
4. **Code issue?** Review **SharePointIntegration.tsx** comments

---

## 🎯 What You Can Do

With this solution, you can:

✅ Upload any file type to SharePoint  
✅ Download files directly in browser  
✅ List all files in a library  
✅ Delete files with confirmation  
✅ Handle file sizes up to 250MB+  
✅ Use static SharePoint configuration (no env vars)  
✅ Share this setup with peers — copy the transfer folder  

---

## 📋 Files That Need to Exist

After setup, your project should have:

```
your-project/
├── src/
│   ├── SharePointIntegration.tsx          ← Copy from this kit
│   ├── generated/
│   │   ├── services/DocumentsService.ts   ← Auto-generated (pac code pull)
│   │   └── models/DocumentsModel.ts       ← Auto-generated (pac code pull)
│   └── App.tsx
├── .power/schemas/appschemas/
│   └── dataSourcesInfo.ts                 ← Updated with file operations
└── node_modules/@microsoft/power-apps/dist/internal/data/core/runtimeClient/
    └── runtimeDataClient.js               ← Should have patch applied
```

---

## 🚀 Deployment

```bash
# Build
npm run build

# Deploy to Power Apps
pac code push
```

Your app URL will be printed after deployment.

---

## 📞 Reference

- [Microsoft Learn: Connect to Data in Code Apps](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/connect-to-data)
- [Power Platform CLI](https://learn.microsoft.com/en-us/power-platform/developer/cli/introduction)
- [SharePoint Online Connector](https://learn.microsoft.com/en-us/connectors/sharepointonline/)

---

## 💡 Tips for Your Peers

When sharing this with teammates:

1. **Start them with QUICK-SETUP.md** — it's faster than the full guide
2. **Have them copy SharePointIntegration.tsx** — it's production-ready
3. **Point them to SHAREPOINT-INTEGRATION-COMPLETE.md** if issues arise
4. **Mention the SDK patch** — it's critical for upload to work

---

**Version:** 1.0  
**Last Updated:** 2026-04-17  
**Status:** ✅ Production Ready
