# SublyExtension

Chrome Extension (Manifest V3) with a Side Panel app to manage subscriptions while using Google Calendar.

## Features

- Side Panel (React) with:
  - Dashboard (monthly equivalent totals + next renewals)
  - Subscriptions list + add/edit form
  - Calendar route opens the real Google Calendar (cannot embed)
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
