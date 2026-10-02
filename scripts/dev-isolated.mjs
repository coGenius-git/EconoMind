import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const profile = join(root, '.dev-isolate')
const env = {
  ...process.env,
  OPEN_SCIENCE_STORAGE_ROOT: join(profile, 'storage'),
  OPEN_SCIENCE_E2E_STORAGE_ROOT: join(profile, 'storage'),
  OPEN_SCIENCE_USER_DATA: join(profile, 'electron-user-data'),
  OPEN_SCIENCE_ALLOW_MULTI_INSTANCE: '1'
}
// Some developer terminals inherit this flag; Electron must start as a desktop application.
delete env.ELECTRON_RUN_AS_NODE
mkdirSync(env.OPEN_SCIENCE_STORAGE_ROOT, { recursive: true })
mkdirSync(env.OPEN_SCIENCE_USER_DATA, { recursive: true })

console.log(`Development data: ${profile}`)
const child = spawn(
  process.execPath,
  [join(root, 'node_modules/electron-vite/bin/electron-vite.js'), 'dev', ...process.argv.slice(2)],
  { cwd: root, env, stdio: 'inherit' }
)
child.on('error', (error) => {
  console.error(error.message)
  process.exitCode = 1
})
child.on('exit', (code) => {
  process.exitCode = code ?? 1
})
