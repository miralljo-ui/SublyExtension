# SublyExtension

Chrome Extension (Manifest V3) with a Side Panel app to manage subscriptions while using Google Calendar.

## Features

- Side Panel (React) with:
  - Dashboard (monthly equivalent totals + next renewals)
  - Subscriptions list + add/edit form
  - Calendar view (agenda of upcoming renewals + Google Calendar sync)
- Optional Google integrations:
- Optional Google integrations:
  - Google Calendar sync creates/updates/recreates/migrates (and, if requested, deletes) recurring all-day events for renewals. Subly uses a dedicated calendar by default; automatic sync may be enabled by default and can be disabled in Settings.
  - Google Drive backup stores a JSON snapshot in `appDataFolder` (used for save/restore)
- Content script on `https://calendar.google.com/*` adds a small floating button "Subly" to open the Side Panel.

## Setup

```powershell
cd SublyExtension
npm install
```

## Dev (web)

```powershell
npm run dev
```

## Build extension

```powershell
npm run build:ext
```

Output: `dist-ext/`

## Load unpacked in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `SublyExtension/dist-ext` folder

Then open Google Calendar and click the floating "Subly" button.

Note: Subly does not embed Google Calendar inside the Side Panel. Instead, it can open Google Calendar in a tab and (optionally) sync renewal events into your calendar.

## Publishing to Chrome Web Store (notes)

- Build and package the extension with `npm run package:ext` (creates a ZIP in the repo root).
- You will need a public **Privacy Policy URL** for the listing. A policy lives in `PRIVACY.md` and `docs/PRIVACY.md` (you can host it with GitHub Pages).
- This extension uses Google OAuth scopes for Google Calendar and Drive appData backup. Depending on Google policies, your OAuth consent screen and requested scopes may require verification.

This extension uses Google OAuth scopes for Google Calendar and Drive appData backup. When enabled, Subly requests the scopes required to create, update, recreate/migrate, and delete events in the dedicated calendar, and to read/write a JSON backup in Drive `appDataFolder`. Depending on Google policies, your OAuth consent screen and requested scopes may require verification. Subly prompts for confirmation before destructive actions (for example: restoring backups, disconnecting Google, or deleting the dedicated calendar).

See `PUBLISHING.md` for copy/paste permission and data-usage text.

Suggested checklist before submitting:

- Verify permissions are least-privilege (manifest `host_permissions`).
- Ensure the injected Google Calendar button can be disabled (Settings → Extension).
- Add store assets: icons, screenshots, short description, detailed description, and support email.
 - Verify permissions are least-privilege (manifest `host_permissions`).
 - Ensure the injected Google Calendar button can be disabled (Settings → Extension) and that automatic calendar sync can be turned off by the user.
 - Add store assets: icons, screenshots, short description, detailed description, and support email.
