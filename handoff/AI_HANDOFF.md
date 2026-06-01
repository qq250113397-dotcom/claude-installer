# AI Handoff

This file is the handoff layer for Claude / Claude Code / Codex collaboration.
Keep it updated whenever an AI agent makes meaningful changes.

## Project

- Repo: `/Users/chengwei/claude-installer`
- Site: `Codex.lbenben.cc.cd`
- Deployment: GitHub push -> Cloudflare Pages

## Current Goal

Build and maintain the Claude installer tutorial site, including:

- access gating
- payment / card verification
- V2RayN portable packaging
- installer scripts with mirror fallback
- clear, user-friendly setup flow

## What Was Changed Most Recently

### Access gating and local preview behavior

- The usage disclaimer modal on the site now:
  - appears only once per browser via `localStorage`
  - includes the network-scheme notice inside the modal
  - requires a 3-second countdown before enabling the continue button
- The unlock page now shows explicit loading/status feedback while verifying a card
- Local preview (`localhost` / `127.0.0.1`) bypasses unlock verification so the site can be inspected without auth friction
- Production unlock verification was restored to the existing worker-backed endpoint after the same-origin Pages Function path proved unreliable in practice
- A Pages Function experiment for `/verify` was created, then the live flow was moved back to the worker-backed path because the deployment/root setup did not match the expected Pages Functions directory layout for this site

### Step 1 flow simplification

- Step 1 was trimmed down to avoid repeating the same "connect first, replace later" guidance
- Duplicate download/link blocks under Step 1 were removed
- A backend login / QR scan screenshot was added to Step 1, placed in the mobile / Gmail section as the first screenshot to guide users to:
  - open `https://zuibenniuge.cc.cd/login`
  - enter `ADMIN`
  - scan the QR code to import the subscription

### Portable V2RayN packaging

- Added `build/v2rayn-portable.mjs`
- It can build a portable Windows V2RayN ZIP from:
  - a local `v2rayN-windows-64-desktop.zip`, if present
  - otherwise GitHub release download with fallback URLs
- The generated package includes:
  - `v2rayN.exe`
  - `start-v2rayN.bat`
  - `subscription-url.txt`
  - `ai-abroad-proxy-cn-direct.json`
  - `README.txt`

### Portable macOS V2RayN packaging

- Added `build/v2rayn-macos-portable.mjs`
- It builds a macOS portable ZIP from the local `v2rayN-macos-arm64.dmg`
- The generated package includes:
  - `v2rayN.app`
  - `start-v2rayN.command`
  - `subscription-url.txt`
  - `ai-abroad-proxy-cn-direct.json`
  - `guiConfigs/guiNConfig.json`
  - `guiConfigs/guiNDB.db`
  - `README.txt`

### Installer download fallback

- Split proxy-based and direct-mirror download paths
- Windows scripts now clear proxy env vars when downloading domestic mirrors
- macOS script now uses `env -u ...` for mirror installs
- Added retry-heavy curl / npm behavior to reduce disconnect failures

### Site copy updates

- Step 1 now promotes the portable V2RayN flow
- Step 2 and Step 3 now emphasize that registration is handled in the video tutorial
- `worker/claude-media.js` allowlist was updated for the project domain
- The homepage network-scheme explanation was removed from the page body and moved into the disclaimer modal

### R2 uploads

- Uploaded to bucket `claude`:
  - `claude-code-setup.exe`
  - `install-mac.zip`
- Uploaded through a temporary relay Worker to bucket `claude`:
  - `v2rayN-windows-64-desktop.zip`
  - object size: `116,495,499` bytes
  - ETag: `"6f45cce06f0aaf0d2c49b5087f9931d5"`
  - `v2rayN-windows-64-desktop-portable.zip`
  - object size: `115,669,412` bytes
  - multipart ETag: `"2c38696f66816760dee76c38cfc175fa-19"`
  - `v2rayN-macos-arm64.dmg`
  - object size: `111,024,329` bytes
  - multipart ETag: `"5d408dfd68359565db1c30acd17c3aa2-18"`
  - `v2rayN-macos-arm64-portable.zip`
  - object size: `111,454,373` bytes
  - multipart ETag: `"91d76dc98a8a46cb93b54b3fa31539dc-18"`
- `test-upload.txt` was created and then deleted after validating direct API write access.
- Added a temporary authenticated upload relay Worker and local multipart upload script because the large zip exceeds practical single-request upload reliability.

## Verified

- `node --check website/js/access.js`
- `node --check website/js/access-guard.js`
- `node --check website/js/main.js`
- `node --check website/unlock.html` is not used as a JS check, but the unlock page script was manually updated and reviewed
- `node --check build/v2rayn-portable.mjs`
- `node --check build/v2rayn-macos-portable.mjs`
- `node --check worker/claude-media.js`
- `node --check worker/r2-upload.js`
- `node --check build/upload-r2-multipart.mjs`
- `bash -n install/install-mac.sh`
- `shellcheck install/install-mac.sh`
- Built portable package successfully:
  - `dist/v2rayN-windows-64-desktop-portable.zip`
- Built macOS portable package successfully:
  - `dist/v2rayN-macos-arm64-portable.zip`
- Uploaded small default installer packages to R2 successfully.
- Uploaded the portable V2RayN ZIP to R2 successfully through multipart relay.
- Uploaded the macOS DMG and macOS portable ZIP to R2 successfully through multipart relay.

## Known Risks / Notes

- The portable bundle is still a large binary package, so publishing and update times are non-trivial.
- If the local `v2rayN-windows-64-desktop.zip` path changes, the build script will fall back to GitHub release download.
- This is still a packaging / launcher flow, not a full service-side content protection system.
- The upload relay Worker is temporary and should be removed or rotated once you no longer need large maintenance uploads.
- The current unlock flow is intentionally worker-backed again for production; the Pages Function version was not the reliable route for the current repo layout.
- The local preview bypass is deliberate so reviewers can inspect the site without being blocked by auth.

## Next Things To Check

1. Have Claude Code review:
   - the current worker-backed unlock path
   - local preview bypass behavior
   - the disclaimer modal timing / persistence logic
   - launcher behavior
   - proxy env cleanup
   - mirror fallback logic
   - macOS config seeding behavior
   - package contents
2. Keep the handoff file updated after each significant change.

## Commands Run

- `node --check build/v2rayn-portable.mjs`
- `node --check worker/claude-media.js`
- `bash -n install/install-mac.sh`
- `shellcheck install/install-mac.sh`
- `unzip -l dist/v2rayN-windows-64-desktop-portable.zip`

## For Claude Code Review

Focus on these questions:

- Does the build script correctly prefer local assets and fall back safely?
- Are proxy env vars being cleared only for direct mirror downloads?
- Is the portable bundle contents clear and safe for end users?
- Are there any shell quoting or Windows batch edge cases left?
