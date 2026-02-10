import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import type { Plugin } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Load environment variables from .env.local file.
 * Used when cross-env doesn't propagate variables correctly.
 */
function loadEnvLocal(): Record<string, string> {
  const envPath = resolve(__dirname, '.env.local')
  if (!existsSync(envPath)) return {}

  const env: Record<string, string> = {}
  const content = readFileSync(envPath, 'utf-8')
  const lines = content.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const match = trimmed.match(/^([A-Z_]+)=(.+)$/)
    if (match) {
      // strip surrounding quotes if present
      env[match[1]] = match[2].replace(/^"|"$/g, '').trim()
    }
  }

  return env
}

/**
 * Plugin to inject the correct OAuth Client ID into manifest.json.
 * Uses VITE_OAUTH_CLIENT_ID_DEV for development builds.
 * Uses VITE_OAUTH_CLIENT_ID_PROD for production builds.
 * Reads from environment variables or .env.local file.
 */
function injectOAuthClientId(): Plugin {
  return {
    name: 'inject-oauth-client-id',
    apply: 'build',
    writeBundle() {
      // Try to get from environment, fall back to .env.local
      const envLocal = loadEnvLocal()
      const buildMode = (process.env.VITE_BUILD_MODE || process.env.MODE || process.env.NODE_ENV || '').toLowerCase()
      const isDev = buildMode === 'dev' || buildMode === 'development'

      const clientId = isDev
        ? process.env.VITE_OAUTH_CLIENT_ID_DEV || envLocal.VITE_OAUTH_CLIENT_ID_DEV || ''
        : process.env.VITE_OAUTH_CLIENT_ID_PROD || envLocal.VITE_OAUTH_CLIENT_ID_PROD || ''

      if (!clientId) {
        console.error('✖ OAuth Client ID is not configured for', isDev ? 'development' : 'production', 'build.')
        console.error('  • Ensure .env.local defines VITE_OAUTH_CLIENT_ID_DEV and/or VITE_OAUTH_CLIENT_ID_PROD')
        process.exit(1)
      }

      const manifestPath = resolve(__dirname, 'dist-ext', 'manifest.json')

      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
        manifest.oauth2 = manifest.oauth2 || {}
        manifest.oauth2.client_id = clientId

        writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
        console.log(`✓ Updated manifest.json Client ID for ${isDev ? 'development' : 'production'} build`)
        console.log(`  Client ID: ${clientId}`)
      } catch (err) {
        console.error('Failed to update manifest.json with Client ID:', err)
        process.exit(1)
      }
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), injectOAuthClientId()],
  build: {
    chunkSizeWarningLimit: 650,
    outDir: 'dist-ext',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'sidepanel.html'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name ?? ''
          if (name.endsWith('.css')) return 'assets/[name].css'
          return 'assets/[name]-[hash].[ext]'
        },
      },
    },
  },
})
