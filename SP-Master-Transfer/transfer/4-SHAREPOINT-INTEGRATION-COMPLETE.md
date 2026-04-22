# SharePoint Integration for Power Apps Code Apps — Complete Guide

**Working solution for file upload/download/list/delete to SharePoint Online with static configuration.**

Tested with: `.txt`, `.docx`, `.pdf`, and binary file types on React + Vite + TypeScript Power Apps Code App.

---

## Quick Start (For Reuse)

If you're copying this to another project:

1. **Copy the code file** → `SharePointIntegration.tsx` into your `src/` directory
2. **Update config** → Change `SP_SITE_URL` and `SP_LIBRARY_NAME` in the component
3. **Ensure SDK patch is applied** → Check `node_modules/@microsoft/power-apps/dist/internal/data/core/runtimeClient/runtimeDataClient.js` has the binary upload patch (lines ~326-335 should decode base64)
4. **Add file operations to schema** → Update `.power/schemas/appschemas/dataSourcesInfo.ts` with CreateFile, GetFileContent, DeleteFile operations (see Section 3)
5. **Deploy** → `pac code push`

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Architecture Overview](#2-architecture-overview)
3. [Setup: Adding File Operations to Schema](#3-setup-adding-file-operations-to-schema)
4. [SDK Patch for Binary Upload](#4-sdk-patch-for-binary-upload)
5. [Integrating the Code](#5-integrating-the-code)
6. [Deployment](#6-deployment)
7. [Troubleshooting](#7-troubleshooting)
8. [Reference: All Four Operations](#8-reference-all-four-operations)

---

## 1. Prerequisites

### Required Software
- **Node.js** v18+ 
- **Power Platform CLI (pac)** — [Install guide](https://learn.microsoft.com/en-us/power-platform/developer/cli/introduction)
- **Power Platform environment** with valid auth profile
- **SharePoint Online site** with a document library

### Verify Setup
```bash
pac auth list
# Should show your authenticated environments
```

### Create a Power Apps Code App (if needed)
```bash
pac code init --template react
npm install
```

---

## 2. Architecture Overview

### The Problem with SharePoint File Uploads

The `@microsoft/power-apps` SDK (v1.0.3) has a bug: when uploading binary files, it:
1. Converts file to base64
2. JSON.stringify() it (adds quotes)
3. Sends as `application/json` instead of binary
4. SharePoint writes the base64 **text** as file content (file becomes corrupted, unreadable)

### The Solution: Two-Part Patch

**Part A:** Add `Content-Type` header parameter to CreateFile operation in schema  
**Part B:** Patch the SDK to decode base64 to binary when Content-Type = `application/octet-stream`

### Data Flow (with patch applied)

```
File Upload:
Browser → base64 → SDK JSON.stringify() → PATCH strips quotes & decodes → Binary Uint8Array → Blob → SharePoint

File Download:
SharePoint → base64 → SDK JSON.parse() → App receives base64 → atob() → Binary Uint8Array → Blob → Browser download

List:
DocumentsService.getAll() → SharePoint list items → App displays

Delete:
DocumentsService.delete(id) → SharePoint item deleted
```

---

## 3. Setup: Adding File Operations to Schema

The auto-generated `dataSourcesInfo.ts` may not include file operations. You need to add them manually.

### Step 1: Open `.power/schemas/appschemas/dataSourcesInfo.ts`

### Step 2: Find the documents connector

Look for:
```ts
"documents": {
  "tableId": "...",
  "apis": {
    "GetEditor": { ... },
    "GetAuthor": { ... },
    ...
  }
}
```

### Step 3: Add these three operations to the `apis` object

```ts
"CreateFile": {
  "path": "/{connectionId}/datasets/{dataset}/files",
  "method": "POST",
  "parameters": [
    {
      "name": "connectionId",
      "in": "path",
      "required": true,
      "type": "string"
    },
    {
      "name": "dataset",
      "in": "path",
      "required": true,
      "type": "string"
    },
    {
      "name": "folderPath",
      "in": "query",
      "required": true,
      "type": "string"
    },
    {
      "name": "name",
      "in": "query",
      "required": true,
      "type": "string"
    },
    {
      "name": "body",
      "in": "body",
      "required": true,
      "type": "string"
    },
    {
      "name": "Content-Type",
      "in": "header",
      "required": false,
      "type": "string"
    }
  ],
  "responseInfo": {
    "200": {
      "type": "object"
    },
    "default": {
      "type": "void"
    }
  }
},

"GetFileContent": {
  "path": "/{connectionId}/datasets/{dataset}/files/{id}/content",
  "method": "GET",
  "parameters": [
    {
      "name": "connectionId",
      "in": "path",
      "required": true,
      "type": "string"
    },
    {
      "name": "dataset",
      "in": "path",
      "required": true,
      "type": "string"
    },
    {
      "name": "id",
      "in": "path",
      "required": true,
      "type": "string"
    }
  ],
  "responseInfo": {
    "200": {
      "type": "string"
    },
    "default": {
      "type": "void"
    }
  }
},

"DeleteFile": {
  "path": "/{connectionId}/datasets/{dataset}/files/{id}",
  "method": "DELETE",
  "parameters": [
    {
      "name": "connectionId",
      "in": "path",
      "required": true,
      "type": "string"
    },
    {
      "name": "dataset",
      "in": "path",
      "required": true,
      "type": "string"
    },
    {
      "name": "id",
      "in": "path",
      "required": true,
      "type": "string"
    }
  ],
  "responseInfo": {
    "204": {
      "type": "void"
    },
    "default": {
      "type": "void"
    }
  }
}
```

---

## 4. SDK Patch for Binary Upload

### Step 1: Verify the Patch

Open `node_modules/@microsoft/power-apps/dist/internal/data/core/runtimeClient/runtimeDataClient.js`

Search for line with `config.headers?.['Content-Type'] === 'application/octet-stream'` (around line 324).

You should see code like this (the PATCH):
```js
? (() => {
    // PATCH: decode base64 body to raw binary for file upload
    let raw = typeof config.body === 'string' ? config.body : '';
    if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1);
    try {
        const bin = atob(raw);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new Blob([bytes], { type: 'application/octet-stream' });
    } catch (_e) {
        return new Blob([config.body], { type: 'application/octet-stream' });
    }
})()
```

**If you don't see this code:**

### Step 2: Apply the Patch

In the same file, find the `_executeRequest` method. Look for where `requestBody` is constructed:

```js
// BEFORE (original SDK - broken for binary):
const requestBody = config.body
    ? config.headers?.['Content-Type'] === 'application/octet-stream'
        ? new Blob([config.body], { type: 'application/octet-stream' })
        : new Blob([config.body], { type: 'application/json' })
    : '';
```

Replace with:
```js
// AFTER (patched - fixes binary upload):
const requestBody = config.body
    ? config.headers?.['Content-Type'] === 'application/octet-stream'
        ? (() => {
            // PATCH: decode base64 body to raw binary for file upload
            let raw = typeof config.body === 'string' ? config.body : '';
            if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1);
            try {
                const bin = atob(raw);
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                return new Blob([bytes], { type: 'application/octet-stream' });
            } catch (_e) {
                return new Blob([config.body], { type: 'application/octet-stream' });
            }
        })()
        : new Blob([config.body], { type: 'application/json' })
    : '';
```

### Step 3: Persist the Patch (Optional but Recommended)

To keep the patch after `npm install`, use patch-package:

```bash
npm install patch-package --save-dev
npx patch-package @microsoft/power-apps
```

Add to `package.json`:
```json
{
  "scripts": {
    "postinstall": "patch-package"
  }
}
```

---

## 5. Integrating the Code

### Option A: Use the Provided Component (Recommended)

Copy `SharePointIntegration.tsx` to your `src/` directory.

In your `src/App.tsx` or main component:
```tsx
import SharePointIntegration from './SharePointIntegration';

export default function App() {
  return <SharePointIntegration />;
}
```

Then edit the config at the top of `SharePointIntegration.tsx`:
```tsx
// CHANGE THESE FOR YOUR SHAREPOINT
const SP_SITE_URL = 'https://yourorg.sharepoint.com/sites/your-site-name';
const SP_LIBRARY_NAME = 'Shared Documents';  // or your library name
```

### Option B: Build Your Own

Use `SharePointIntegration.tsx` as a reference. Key pieces:

#### Initialize client and services
```tsx
import { getClient } from '@microsoft/power-apps/data';
import { DocumentsService } from './generated/services/DocumentsService';
import { dataSourcesInfo } from '../.power/schemas/appschemas/dataSourcesInfo';

const client = getClient(dataSourcesInfo);
```

#### Convert file to base64
```tsx
const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);  // Strip "data:...;base64," prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
```

#### Upload file
```tsx
const base64Content = await readFileAsBase64(file);
const result = await client.executeAsync<unknown, unknown>({
  connectorOperation: {
    tableName: 'documents',
    operationName: 'CreateFile',
    parameters: {
      'Content-Type': 'application/octet-stream',  // Triggers patch
      dataset: SP_SITE_URL,                         // SharePoint site
      folderPath: '/' + SP_LIBRARY_NAME,
      name: file.name,
      body: base64Content
    }
  }
});
```

#### List files
```tsx
const result = await DocumentsService.getAll();
const files = result.data || [];
```

#### Delete file
```tsx
await DocumentsService.delete(String(fileId));
```

#### Download file
```tsx
const result = await client.executeAsync<unknown, unknown>({
  connectorOperation: {
    tableName: 'documents',
    operationName: 'GetFileContent',
    parameters: { id: fileId }
  }
});

const base64Data = result.data as string;
const binaryString = atob(base64Data);
const bytes = new Uint8Array(binaryString.length);
for (let i = 0; i < binaryString.length; i++) {
  bytes[i] = binaryString.charCodeAt(i);
}

const blob = new Blob([bytes]);
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = fileName;
a.click();
URL.revokeObjectURL(url);
```

---

## 6. Deployment

From your project directory:

```bash
# Build
npm run build

# Deploy to Power Apps
pac code push
```

The URL to your app will be printed in the output.

---

## 7. Troubleshooting

### "Cannot read properties of undefined (reading 'path')"

**Cause:** File operations not properly defined in dataSourcesInfo.ts

**Fix:**
1. Verify CreateFile, GetFileContent, DeleteFile are in `.power/schemas/appschemas/dataSourcesInfo.ts` (see Section 3)
2. If missing, run `pac code pull` to regenerate
3. Re-add operations if they're overwritten

### "Upload failed: file is corrupted / opens as text"

**Cause:** SDK patch not applied

**Fix:**
1. Check `node_modules/@microsoft/power-apps/dist/internal/data/core/runtimeClient/runtimeDataClient.js` has the patch (Section 4)
2. Verify `'Content-Type': 'application/octet-stream'` is in upload parameters
3. If patch missing, apply manually or reinstall packages and re-apply

### "Delete succeeds but file still there"

**Cause:** File ID format issue or refresh not working

**Fix:**
1. Check that `file.ID` or `file.Id` matches SharePoint list item ID
2. Verify `DocumentsService.delete()` was called, not DeleteFile operation directly
3. Ensure `fetchFiles()` or equivalent runs after delete to refresh list

### "DocumentsService not found"

**Cause:** `pac code pull` not run yet

**Fix:**
```bash
pac code push  # Create app in Power Apps
# Then in Power Apps Studio: Data panel > Add data > SharePoint > select site & library
pac code pull  # Generate DocumentsService
```

---

## 8. Reference: All Four Operations

### 8.1 Upload File (CreateFile)

```tsx
async function uploadFile(file: File, spSiteUrl: string, spLibrary: string) {
  const base64 = await readFileAsBase64(file);
  
  const result = await client.executeAsync<unknown, unknown>({
    connectorOperation: {
      tableName: 'documents',
      operationName: 'CreateFile',
      parameters: {
        'Content-Type': 'application/octet-stream',
        dataset: spSiteUrl,
        folderPath: '/' + spLibrary,
        name: file.name,
        body: base64
      }
    }
  });
  
  return result.success;
}
```

**Required:** SDK patch + Content-Type header parameter in schema

---

### 8.2 List Files

```tsx
async function listFiles() {
  const result = await DocumentsService.getAll();
  const files = result.data || [];
  
  // Transform if needed
  return files.map(file => ({
    id: file.ID,
    name: file['{Name}'] || file.Title,
    displayName: file['{FilenameWithExtension}'],
    modified: file.Modified,
    isFolder: file['{IsFolder}'],
    identifier: file['{Identifier}'],
    path: file['{Path}']
  }));
}
```

**No requirements — uses auto-generated service**

---

### 8.3 Download File (GetFileContent)

```tsx
async function downloadFile(fileId: string, fileName: string) {
  const result = await client.executeAsync<unknown, unknown>({
    connectorOperation: {
      tableName: 'documents',
      operationName: 'GetFileContent',
      parameters: { id: fileId }
    }
  });
  
  if (!result.success) return;
  
  const base64Data = result.data as string;
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const blob = new Blob([bytes]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
```

**Required:** File operation in schema, SDK patch

---

### 8.4 Delete File

```tsx
async function deleteFile(fileId: string) {
  await DocumentsService.delete(String(fileId));
}
```

**No requirements — uses auto-generated service**

---

## Key Takeaways

✅ Use **DocumentsService.getAll()** and **DocumentsService.delete()** for read/delete  
✅ Use **client.executeAsync()** with **CreateFile** and **GetFileContent** for upload/download  
✅ Always pass **`'Content-Type': 'application/octet-stream'`** for upload  
✅ Always include **dataset** (SharePoint site URL) in all operation parameters  
✅ Ensure SDK patch is applied for binary upload to work  
✅ After `pac code pull`, re-add file operations if they're overwritten  

---

## Resources

- [Microsoft Learn: Connect to data in Code Apps](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/connect-to-data)
- [Power Platform CLI Docs](https://learn.microsoft.com/en-us/power-platform/developer/cli/introduction)
- [SharePoint Online Connector Reference](https://learn.microsoft.com/en-us/connectors/sharepointonline/)
