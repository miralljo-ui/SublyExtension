# Privacy Policy (Subly)

Last updated: 2026-01-22

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

If you use Calendar sync, Subly creates, updates, recreates, migrates, and deletes recurring all-day events that represent your subscription renewals.

Those events may include:

- Event title (subscription name + "Renewal")
- Event description (amount, currency, billing period, and optionally category)

Subly now creates and uses a dedicated calendar by default (for example, "Subly Subscriptions") to host its events. Subly will ensure this calendar exists in your Google account and will generally create or update events there. When necessary (for example, if an event is missing, or if an existing event lives in a different calendar), Subly may recreate or migrate events into the dedicated calendar. If the dedicated calendar is deleted or you disconnect your Google account, Subly will prompt for confirmation before taking destructive actions and may remove the events it previously created in that calendar.

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

Note on Calendar permissions: when you enable Calendar sync Subly requests the Google Calendar scopes necessary to create, update, and delete events in the calendar it uses. These operations are performed by Subly via the Google Calendar API using your OAuth consent and occur from your device using the authorized credentials.

## Your Choices

- You can disable the floating Google Calendar button in Settings.
- You can clear local data in Settings.
- You can choose whether to use Google Drive backup and Google Calendar sync.

- Calendar sync may be enabled by default: Subly's calendar synchronization can come enabled by default (configuration `calendarAutoSyncAll`). When enabled, Subly may automatically create and update events in the dedicated calendar. You can disable automatic synchronization from the app Settings to stop Subly from creating or updating Google Calendar events automatically.

## Contact

If you have questions about privacy, contact the developer via the support email listed on the Chrome Web Store listing.
