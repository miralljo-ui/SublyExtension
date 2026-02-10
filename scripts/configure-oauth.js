#!/usr/bin/env node

/**
 * Helper script to configure OAuth Client IDs for development and production builds.
 * Usage: npx node scripts/configure-oauth.js
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline'

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
})

function question(query) {
  return new Promise(r => rl.question(query, r))
}

async function main() {
  console.log('\n🔐 Subly Extension - OAuth Configuration Helper\n')
  console.log('This script will help you configure your OAuth Client IDs.')
  console.log('See OAUTH_SETUP.md for detailed setup instructions.\n')

  const envLocalPath = resolve('.', '.env.local')
  const envExamplePath = resolve('.', '.env.example')

  // Check if .env.local exists
  if (!existsSync(envLocalPath)) {
    console.log('📝 Creating .env.local from .env.example...\n')
    const exampleContent = readFileSync(envExamplePath, 'utf-8')
    writeFileSync(envLocalPath, exampleContent)
    console.log('✓ Created .env.local\n')
  }

  // Read current values
  const envContent = readFileSync(envLocalPath, 'utf-8')
  const devMatch = envContent.match(/VITE_OAUTH_CLIENT_ID_DEV=(.+?)(?:\n|$)/)
  const prodMatch = envContent.match(/VITE_OAUTH_CLIENT_ID_PROD=(.+?)(?:\n|$)/)

  const currentDev = devMatch ? devMatch[1].trim() : 'NOT_SET'
  const currentProd = prodMatch ? prodMatch[1].trim() : 'NOT_SET'

  console.log('Current configuration:')
  console.log(`  DEV:  ${currentDev === 'YOUR_DEV_CLIENT_ID_HERE' ? '❌ NOT CONFIGURED' : currentDev}`)
  console.log(`  PROD: ${currentProd === 'YOUR_PROD_CLIENT_ID_HERE' ? '❌ NOT CONFIGURED' : currentProd}\n`)

  const updateDev = await question('Update DEV Client ID? (y/n): ')
  if (updateDev.toLowerCase() === 'y') {
    const newDevId = await question('Enter your DEV Client ID (from Chrome extension during load unpacked): ')
    if (newDevId.trim()) {
      updateEnvFile('VITE_OAUTH_CLIENT_ID_DEV', newDevId.trim())
      console.log('✓ DEV Client ID updated\n')
    }
  }

  const updateProd = await question('Update PROD Client ID? (y/n): ')
  if (updateProd.toLowerCase() === 'y') {
    const newProdId = await question('Enter your PROD Client ID (from Chrome Web Store Extension ID): ')
    if (newProdId.trim()) {
      updateEnvFile('VITE_OAUTH_CLIENT_ID_PROD', newProdId.trim())
      console.log('✓ PROD Client ID updated\n')
    }
  }

  console.log('✅ Configuration complete!\n')
  console.log('Next steps:')
  console.log('  • For development:  npm run build:ext:dev')
  console.log('  • For production:  npm run build:ext:prod\n')
  console.log('See DEVELOPMENT.md for more workflows.\n')

  rl.close()
}

function updateEnvFile(key, value) {
  const envLocalPath = resolve('.', '.env.local')
  let content = readFileSync(envLocalPath, 'utf-8')

  const regex = new RegExp(`${key}=.*?(?=\\n|$)`)
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`)
  } else {
    content = content + `\n${key}=${value}\n`
  }

  writeFileSync(envLocalPath, content)
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
