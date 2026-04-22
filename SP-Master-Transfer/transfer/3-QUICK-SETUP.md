# SharePoint Integration — Quick Setup (5 min)

Use this for a fast setup in a new Power Apps Code App project.

---

## Step 1: Copy the Component

```bash
cp SharePointIntegration.tsx your-project/src/
```

---

## Step 2: Configure

Edit `SharePointIntegration.tsx` and update:

```tsx
const SP_SITE_URL = 'https://YOUR-TENANT.sharepoint.com/sites/YOUR-SITE'
const SP_LIBRARY_NAME = 'Your Library Name'  // or "Shared Documents"
```

---

## Step 3: Add File Operations to Schema

In `.power/schemas/appschemas/dataSourcesInfo.ts`, find the `"documents"` data source and add these three operations to the `"apis"` object:

```json
"CreateFile": {
  "path": "/{connectionId}/datasets/{dataset}/files",
  "method": "POST",
  "parameters": [
    {"name": "connectionId", "in": "path", "required": true, "type": "string"},
    {"name": "dataset", "in": "path", "required": true, "type": "string"},
    {"name": "folderPath", "in": "query", "required": true, "type": "string"},
    {"name": "name", "in": "query", "required": true, "type": "string"},
    {"name": "body", "in": "body", "required": true, "type": "string"},
    {"name": "Content-Type", "in": "header", "required": false, "type": "string"}
  ],
  "responseInfo": {"200": {"type": "object"}, "default": {"type": "void"}}
},
"GetFileContent": {
  "path": "/{connectionId}/datasets/{dataset}/files/{id}/content",
  "method": "GET",
  "parameters": [
    {"name": "connectionId", "in": "path", "required": true, "type": "string"},
    {"name": "dataset", "in": "path", "required": true, "type": "string"},
    {"name": "id", "in": "path", "required": true, "type": "string"}
  ],
  "responseInfo": {"200": {"type": "string"}, "default": {"type": "void"}}
},
"DeleteFile": {
  "path": "/{connectionId}/datasets/{dataset}/files/{id}",
  "method": "DELETE",
  "parameters": [
    {"name": "connectionId", "in": "path", "required": true, "type": "string"},
    {"name": "dataset", "in": "path", "required": true, "type": "string"},
    {"name": "id", "in": "path", "required": true, "type": "string"}
  ],
  "responseInfo": {"204": {"type": "void"}, "default": {"type": "void"}}
}
```

---

## Step 4: Apply SDK Patch

Open `node_modules/@microsoft/power-apps/dist/internal/data/core/runtimeClient/runtimeDataClient.js`

Find the line with `config.headers?.['Content-Type'] === 'application/octet-stream'` (around line 324).

It should already have the patch (look for the `atob()` decoding logic). If not, see **SHAREPOINT-INTEGRATION-COMPLETE.md** Section 4.

---

## Step 5: Use the Component

In `src/App.tsx`:

```tsx
import SharePointIntegration from './SharePointIntegration';

export default function App() {
  return <SharePointIntegration />;
}
```

---

## Step 6: Deploy

```bash
npm run build
pac code push
```

Done! ✅

---

## Troubleshooting at a Glance

| Error | Cause | Fix |
|-------|-------|-----|
| "Cannot read properties of undefined (reading 'path')" | File operations not in schema | Add operations from Step 3 |
| "Upload fails, file corrupted" | SDK patch not applied | Apply patch from Step 4 |
| "Delete shows success but file remains" | Wrong file ID | Use `doc.ID`, not file path |
| "DocumentsService not found" | Not generated | Run `pac code pull` after adding SharePoint in Studio |

---

## Detailed Guide

Read **SHAREPOINT-INTEGRATION-COMPLETE.md** for:
- Architecture explanation
- SDK patch details
- All four operations (upload, download, list, delete)
- Full troubleshooting

---

## Files in This Folder

- **SHAREPOINT-INTEGRATION-COMPLETE.md** — Full guide with all details
- **SharePointIntegration.tsx** — Ready-to-use component
- **QUICK-SETUP.md** — This file (5-min setup)
- **dataSourcesInfo-operations.json** — Copy-paste the file operations if needed
