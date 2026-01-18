# Privacy Policy (Subly)

Last updated: 2026-01-18

## Summary

Subly is a Chrome extension that helps you manage subscription reminders in a Side Panel while using Google Calendar.

Subly stores your subscriptions locally on your device. If you enable Google integrations, Subly uses Google OAuth to:

- Create, update, and delete calendar events in your Google Calendar.
- Save and load a backup JSON file in your Google Drive **appDataFolder** (a hidden, app-specific folder).

## Data Subly Stores

### Locally (on your device)

Subly stores an app state object that includes:

- Your subscriptions (name, price, currency, period, start date, optional category)
- Optional Google Calendar linkage metadata for each subscription (calendarId, eventId, sync timestamps, last error)
- App settings (language, currency display, calendar sync preferences, Drive backup metadata, etc.)

This is stored using `chrome.storage.local` when running as an extension.

### In Google Drive (optional)

If you use the Drive backup feature, Subly saves a JSON file (default name: `subly-state.json`) to your Drive **appDataFolder**.

- This file is not visible in your main Drive folders.
- Subly only reads/writes this app-specific file.

### In Google Calendar (optional)

If you use Calendar sync, Subly creates/updates/deletes recurring all-day events that represent your subscription renewals.

Those events may include:

- Event title (subscription name + "Renewal")
- Event description (amount, currency, billing period, and optionally category)

Depending on your settings, Subly may create a dedicated calendar (e.g., "Subly Subscriptions") or use your primary calendar.

## Data Sharing

Subly does not sell your data.

Subly does not send your subscriptions to any third-party servers owned by the developer.

Subly may call third-party exchange rate APIs to fetch currency conversion rates (for charts/totals). These requests are made directly from your device to the exchange rate provider(s) and may contain:

- The selected base currency (e.g., `USD`)
- No personally identifying information

The exchange rate providers currently used include:

- `open.er-api.com`
- `api.exchangerate.host`

## Permissions

Subly requests the following Chrome permissions:

- `storage`: to save your subscriptions and settings locally
- `sidePanel`: to render the UI in the Chrome Side Panel
- `identity`: to perform Google OAuth when you enable Google integrations

Subly also requests host permissions to reach:

- `calendar.google.com` (to show an open-panel button on Google Calendar, optional)
- `www.googleapis.com` endpoints for Google Calendar and Google Drive APIs
- Exchange rate providers used for currency conversion

## Your Choices

- You can disable the floating Google Calendar button in Settings.
- You can clear local data in Settings.
- You can choose whether to use Google Drive backup and Google Calendar sync.

## Contact

If you have questions about privacy, contact the developer via the support email listed on the Chrome Web Store listing.
