/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */

// Development branding: Windows embeds build/icon.ico into its development executable.
// On macOS, rename the dev Electron.app bundle so `npm run dev` shows
// "EconoMind (DEV)" in the dock and menu bar. `app.setName()` changes app.name and the per-app
// paths but NOT the macOS dock tooltip in development — that comes from the running bundle's
// Info.plist (which ships as "Electron"). Patching CFBundleName/CFBundleDisplayName fixes it.
//
// The bundle is ad-hoc/linker-signed, so a modified Info.plist invalidates the seal and the kernel
// refuses to launch it on Apple Silicon ("killed: 9"); we re-apply a deep ad-hoc signature.
//
// Idempotent and a no-op on other platforms. Reset by an electron reinstall,
// which just re-runs this on the next `npm run dev`.

const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { tmpdir } = require('node:os')

// Windows uses the executable's icon for taskbar grouping, even when BrowserWindow.setIcon works.
// Preserve an unmodified backup. Keep the electron.exe name: Electron uses that name
// to distinguish development mode from an installed app.
if (process.platform === 'win32') {
  const electronRoot = path.dirname(require.resolve('electron/package.json'))
  const dist = path.join(electronRoot, 'dist')
  const version = require('electron/package.json').version
  const stock = path.join(dist, `electron-unbranded-${version}.exe`)
  const brandedName = 'electron.exe'
  const branded = path.join(dist, brandedName)
  if (!fs.existsSync(stock)) fs.copyFileSync(branded, stock)
  const icon = path.join(__dirname, '..', 'build', 'icon.ico')
  const stampPath = path.join(dist, '.economind-electron-branding.json')
  const fingerprint = createHash('sha256')
    .update(fs.readFileSync(stock))
    .update(fs.readFileSync(icon))
    .digest('hex')
  let previous
  try {
    previous = JSON.parse(fs.readFileSync(stampPath, 'utf8'))
  } catch {
    // A fresh runtime has no branding record.
  }
  const brandedHash = fs.existsSync(branded)
    ? createHash('sha256').update(fs.readFileSync(branded)).digest('hex')
    : undefined
  if (
    previous?.fingerprint !== fingerprint ||
    previous?.brandedHash !== brandedHash ||
    !brandedHash
  ) {
    const resourceEditor = path.join(
      path.dirname(require.resolve('electron-winstaller/package.json')),
      'vendor',
      'rcedit.exe'
    )
    // The bundled editor cannot read non-ASCII argument paths. Use relative temporary names
    // so checkouts under Chinese Windows desktop paths work too.
    const staging = fs.mkdtempSync(path.join(tmpdir(), 'economind-dev-icon-'))
    try {
      fs.copyFileSync(stock, path.join(staging, 'app.exe'))
      fs.copyFileSync(icon, path.join(staging, 'icon.ico'))
      execFileSync(
        resourceEditor,
        [
          'app.exe',
          '--set-icon',
          'icon.ico',
          '--set-version-string',
          'ProductName',
          'EconoMind (DEV)',
          '--set-version-string',
          'FileDescription',
          'EconoMind (DEV)'
        ],
        { cwd: staging, windowsHide: true }
      )
      fs.copyFileSync(path.join(staging, 'app.exe'), branded)
    } finally {
      for (const file of ['app.exe', 'icon.ico']) {
        if (fs.existsSync(path.join(staging, file))) fs.unlinkSync(path.join(staging, file))
      }
      fs.rmdirSync(staging)
    }
    fs.writeFileSync(
      stampPath,
      JSON.stringify({
        fingerprint,
        brandedHash: createHash('sha256').update(fs.readFileSync(branded)).digest('hex')
      }) + '\n'
    )
  }
  fs.writeFileSync(path.join(electronRoot, 'path.txt'), brandedName)
  console.log('[dev-app-branding] Windows development icon matches build/icon.ico')
  process.exit(0)
}

if (process.platform !== 'darwin') process.exit(0)

const appPath = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'Electron.app')
const plistPath = path.join(appPath, 'Contents', 'Info.plist')

if (!fs.existsSync(plistPath)) process.exit(0)

const DEV_NAME = 'EconoMind (DEV)'
const PLIST_BUDDY = '/usr/libexec/PlistBuddy'

const readKey = (key) => {
  try {
    return execFileSync(PLIST_BUDDY, ['-c', `Print :${key}`, plistPath], {
      encoding: 'utf8'
    }).trim()
  } catch {
    return ''
  }
}

// Already renamed — nothing to do (avoids a needless re-sign on every dev start).
if (readKey('CFBundleName') === DEV_NAME && readKey('CFBundleDisplayName') === DEV_NAME)
  process.exit(0)

const setKey = (key) => {
  try {
    execFileSync(PLIST_BUDDY, ['-c', `Set :${key} ${DEV_NAME}`, plistPath])
  } catch {
    try {
      execFileSync(PLIST_BUDDY, ['-c', `Add :${key} string ${DEV_NAME}`, plistPath])
    } catch {
      // Leave the key as-is if it can neither be set nor added.
    }
  }
}

setKey('CFBundleName')
setKey('CFBundleDisplayName')

// Re-seal so the modified bundle still launches (a broken ad-hoc signature is fatal on arm64).
try {
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'ignore' })
} catch {
  // If signing is unavailable the patched bundle may fail to launch; surface a hint but don't block.
  console.warn('[dev-app-branding] could not re-sign Electron.app; dev launch may fail on arm64')
}

console.log(`[dev-app-branding] dev Electron.app renamed to "${DEV_NAME}"`)
