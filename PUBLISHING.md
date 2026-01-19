# Publishing checklist (Chrome Web Store)

This document is a repo-local checklist + copy you can reuse in the Chrome Web Store listing.

## Build + ZIP (what to upload)

1. Build the extension:

```powershell
npm run build:ext
```

2. Zip `dist-ext/` contents (upload the ZIP to Chrome Web Store):

```powershell
# From repo root
$version = (Get-Content .\package.json | ConvertFrom-Json).version
$zipName = "subly-extension-$version.zip"
if (Test-Path $zipName) { Remove-Item $zipName -Force }
Compress-Archive -Path .\dist-ext\* -DestinationPath .\$zipName -Force
```

## Permissions justification (copy for CWS)

### Permissions

- `sidePanel`: renders the Subly UI inside the Chrome Side Panel.
- `storage`: stores subscriptions and settings locally on the device.
- `identity`: Google OAuth sign-in used only when the user enables Google features.

### Host permissions

- `https://calendar.google.com/*`: optional content script that shows a small “Subly” button on Google Calendar to open the Side Panel.
- `https://www.googleapis.com/calendar/v3/*`: optional Google Calendar sync (create/update/delete events).
- `https://www.googleapis.com/drive/v3/*` and `https://www.googleapis.com/upload/drive/v3/*`: optional Google Drive backup to the user’s `appDataFolder`.
- `https://oauth2.googleapis.com/*`: optional OAuth token revocation when the user disconnects Google.
- `https://api.exchangerate.host/*` and `https://open.er-api.com/*`: fetch currency exchange rates for totals/charts.

## Data usage summary (copy for CWS)

- **Local data:** subscriptions and settings are stored locally via `chrome.storage.local`.
- **Google Drive (optional):** when enabled by the user, Subly stores a JSON backup file in Drive `appDataFolder`.
- **Google Calendar (optional):** when enabled by the user, Subly creates/updates/deletes recurring all-day events representing renewals.
- **No developer backend:** Subly does not send subscription data to developer-controlled servers.

## Notes for review

- Google features are user-initiated (Sync / Backup / Restore) and can be disabled.
- The floating Google Calendar button can be disabled from Settings.
- Privacy policy shipped inside the extension: `PRIVACY.md` (also host a public URL for the store listing).
