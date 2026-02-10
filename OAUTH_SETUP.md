# OAuth 2.0 Setup Guide for Subly Extension

This guide explains how to set up Google OAuth 2.0 credentials for the Subly Chrome Extension.
## Overview

Subly supports **two separate OAuth configurations**:
- **Development**: for local testing with `load unpacked` (temporary Extension ID)
- **Production**: for Chrome Web Store (permanent Extension ID)

This separation prevents development testing from interfering with production users.
## Why this is needed

The Subly extension uses Google OAuth to authenticate with:
- **Google Calendar** - to create/sync subscription renewal events
- **Google Drive** - to backup and restore subscription data

Without valid OAuth credentials, users will see `OAuth2 request failed: bad client id` errors when trying to sync.

## Prerequisites

- A Google Cloud Console project (or create a new one)
- Access to the Chrome Web Store Developer account (for production)
- Your local Extension ID from `chrome://extensions` (for development)
- Your permanent Extension ID from Chrome Web Store (for production)

## Quick Start (for production build)

If you already have a public extension on Chrome Web Store:

1. Copy `.env.example` to `.env.local`:
   ```powershell
   Copy-Item .env.example .env.local
   ```

2. Edit `.env.local` and fill in both Client IDs (get them from Step 2 below)

3. Build for production:
   ```powershell
   npm run build:ext:prod
   npm run package:ext  # Creates ZIP for Chrome Web Store
   ```

That's it! Your production package is ready to upload.

---

## Step 0: Configure Environment Variables

1. **Copy the template:**
   ```powershell
   Copy-Item .env.example .env.local
   ```

2. **Edit `.env.local`** (never commit this file):
   ```
   VITE_OAUTH_CLIENT_ID_DEV=YOUR_DEV_CLIENT_ID_HERE
   VITE_OAUTH_CLIENT_ID_PROD=YOUR_PROD_CLIENT_ID_HERE
   ```

3. **Fill in your Client IDs** from Google Cloud Console (see steps below to create them)

4. **Git will ignore it** (in `.gitignore`) so your credentials won't leak

---

## Step 1: Get your Extension IDs

### For Development (local testing)

1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked** → select the `dist-ext/` folder
4. Copy the **Extension ID** shown (temporary, changes each time)

### For Production (Chrome Web Store)

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devcenter)
2. Open your published Subly extension
3. Copy the **Extension ID** from the URL or extension details (permanent)

---

## Step 2: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown → **New Project**
3. Name it (e.g., "Subly Extension")
4. Click **Create**

## Step 3: Enable required APIs

1. In Cloud Console, go to **APIs & Services** → **Library**
2. Search for and enable:
   - **Google Calendar API**
   - **Google Drive API**
3. Verify by visiting **APIs & Services** → **Enabled APIs & services**

## Step 4: Configure OAuth 2.0 Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type (unless you're publishing to a Google Workspace domain)
3. Click **Create**
4. Fill in the required fields:
   - **App name**: Subly
   - **User support email**: your email
   - **Developer contact**: your email
5. Click **Save and Continue**

### Add OAuth Scopes

1. Click **Add or Remove Scopes**
2. Filter and select these scopes:
   - `https://www.googleapis.com/auth/calendar` (Google Calendar)
   - `https://www.googleapis.com/auth/drive.appdata` (Google Drive app data)
3. Click **Update** → **Save and Continue**
4. Review and click **Back to Dashboard**

## Step 5: Create OAuth 2.0 Credentials (Development)

1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. Select **Chrome Extension** as the application type
4. In **Extension IDs**, paste your **development Extension ID** from Step 1
5. Click **Create**
6. Copy the **Client ID** → paste into `.env.local` as `VITE_OAUTH_CLIENT_ID_DEV`

## Step 6: Create OAuth 2.0 Credentials (Production)

Repeat Step 5, but:
- In **Extension IDs**, paste your **production Extension ID** (from Chrome Web Store)
- Copy the new **Client ID** → paste into `.env.local` as `VITE_OAUTH_CLIENT_ID_PROD`

---

## Step 7: Build and Test

### For Development (local testing):

```powershell
npm install  # First time only, installs cross-env
npm run build:ext:dev
# Extension builds to dist-ext/ with DEV Client ID
# Open chrome://extensions, click Load unpacked → dist-ext/
```

### For Production (Chrome Web Store):

```powershell
npm run build:ext:prod
npm run package:ext
# Extension builds to dist-ext/ with PROD Client ID
# Creates subly-extension-0.1.3.zip ready to upload
```

---

## Updating your published extension

When you have a new version ready:

1. **Update version** in `package.json`
2. **Test locally** with `npm run build:ext:dev`
3. **Build for production:**
   ```powershell
   npm run build:ext:prod
   npm run package:ext
   ```
4. **Upload ZIP** to Chrome Web Store
5. Submit for review
6. Users update automatically when review is approved

---

## Troubleshooting

### Error: "bad client id"
- Verify both Client IDs are correctly configured in `.env.local`
- Check that the Extension IDs in Google Cloud match your actual Extension IDs
- For development: Extension ID must match what's shown in `chrome://extensions`
- For production: Extension ID must match your Chrome Web Store listing

### Error: "insufficient permissions" or "daily limit exceeded"
- Verify both APIs (Calendar and Drive) are **Enabled** in Cloud Console
- Check that the OAuth consent screen has **External** user type selected

### Error: "redirect_uri_mismatch" (shouldn't happen with Chrome Extensions)
- Verify you selected **Chrome Extension** (not Web application) when creating credentials
- Verify the Extension IDs are correct in Google Cloud

### Environment variables not loading

If you update `.env.local` but changes don't apply:

1. Clear the build cache:
   ```powershell
   Remove-Item dist-ext -Recurse -Force -ErrorAction SilentlyContinue
   ```

2. Rebuild:
   ```powershell
   npm run build:ext:prod
   ```

---

## Additional Resources

- [Chrome Web Store OAuth Documentation](https://developer.chrome.com/docs/extensions/how-to/integrate-oauth2)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Google Calendar API](https://developers.google.com/calendar)
- [Google Drive API](https://developers.google.com/drive)

