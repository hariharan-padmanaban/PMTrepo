---
name: Publish app after each code change
description: User wants me to run npm run build + npx power-apps push after every code change in the ENJAX project
type: feedback
---

After making any code change in the ENJAX project, run `npm run build` followed by `npx power-apps push` to publish the app.

**Why:** User explicitly requested this workflow on 2026-05-04. They are deploying to Power Apps and want changes to be visible without having to manually publish each time.

**How to apply:** After completing an Edit/Write to any source file (especially in `src/`), run the build + push commands. If they fail (e.g., PowerShell execution policy), report the failure and let the user run them manually. Use `cmd.exe /c` via Bash if PowerShell scripts are blocked.
