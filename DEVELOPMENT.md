# Development Workflow - Subly Extension

Quick reference for building and testing the Subly extension with separate development/production OAuth credentials.

## Initial Setup

```powershell
# 1. Copy environment template
Copy-Item .env.example .env.local

# 2. Edit .env.local with your Client IDs
# VITE_OAUTH_CLIENT_ID_DEV=<your-dev-client-id>
# VITE_OAUTH_CLIENT_ID_PROD=<your-prod-client-id>

# 3. Install dependencies
npm install
```

## Development Build (local testing)

```powershell
npm run build:ext:dev
```

This builds the extension with your **development Client ID** to `dist-ext/`.

Then in Chrome:
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist-ext/` folder

## Production Build (Chrome Web Store)

```powershell
npm run build:ext:prod
npm run package:ext
```

This builds the extension with your **production Client ID** and creates a ZIP file ready to upload.

## Available Scripts

| Command | Purpose | Uses Client ID |
|---------|---------|-----------------|
| `npm run build:ext:dev` | Build for local development | `VITE_OAUTH_CLIENT_ID_DEV` |
| `npm run build:ext:prod` | Build for Chrome Web Store | `VITE_OAUTH_CLIENT_ID_PROD` |
| `npm run build:ext` | Build (uses prod by default) | `VITE_OAUTH_CLIENT_ID_PROD` |
| `npm run build` | Build web app to `dist/` | N/A |
| `npm run dev` | Dev server (web app) | N/A |
| `npm test` | Run test suite | N/A |

## Workflow: Making Changes

1. **Make code changes**
2. **Test locally:**
   ```powershell
   npm run build:ext:dev
   # Reload in chrome://extensions
   ```
3. **Ready to publish?**
   ```powershell
   npm run build:ext:prod
   npm run package:ext
   ```
4. **Upload ZIP to Chrome Web Store**

## Environment Variables

Create `.env.local` (git-ignored) with:

```
VITE_OAUTH_CLIENT_ID_DEV=297517817732-xxxxx.apps.googleusercontent.com
VITE_OAUTH_CLIENT_ID_PROD=YOUR-PROD-CLIENT-ID.apps.googleusercontent.com
```

See [OAUTH_SETUP.md](OAUTH_SETUP.md) for detailed setup instructions.

## Troubleshooting

### "UNCONFIGURED_DEV_CLIENT_ID" or "UNCONFIGURED_PROD_CLIENT_ID"

Your `.env.local` is missing Client IDs. See [OAUTH_SETUP.md](OAUTH_SETUP.md) Step 0.

### Changes not reflecting in extension

Clear build cache and rebuild:
```powershell
Remove-Item dist-ext -Recurse -Force
npm run build:ext:dev  # or :prod
```

Then reload in Chrome.

### TypeScript errors after build

Rebuild TypeScript:
```powershell
npx tsc -b
npm run build:ext:dev
```

## File Structure

```
SublyExtension/
├── .env.example          ← Template (commit this)
├── .env.local            ← Your credentials (git-ignored, don't commit)
├── public/
│   └── manifest.json     ← Updated automatically during build
├── dist-ext/             ← Generated (dev build output)
├── dist/                 ← Generated (web app output)
├── src/
│   ├── lib/
│   │   ├── googleAuth.ts ← OAuth auth logic
│   │   └── logger.ts     ← Error logging
│   └── ...
└── vite.extension.config.ts  ← Build config (injects Client ID)
```

## Publishing to Chrome Web Store

1. Build production version:
   ```powershell
   npm run build:ext:prod
   ```
2. Package:
   ```powershell
   npm run package:ext
   ```
3. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devcenter)
4. Upload the ZIP file
5. Fill in screenshots, description, etc.
6. Submit for review
7. Users auto-update when approved

See [PUBLISHING.md](PUBLISHING.md) for detailed submission guidelines.
