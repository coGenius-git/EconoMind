/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs/promises')
const path = require('node:path')

// Generated Prisma files contain build-machine paths. Strip those diagnostic paths only from the
// staged distribution; the developer's generated client and all user data remain untouched.
exports.default = async function cleanShareResources(context) {
  const resources = path.resolve(context.appOutDir, 'resources')
  const prisma = path.join(resources, 'node_modules', '.prisma', 'client')
  const sourceRoot = JSON.stringify(path.resolve(context.packager.projectDir)).slice(1, -1)
  for (const name of ['index.js', 'edge.js', 'wasm.js']) {
    const file = path.join(prisma, name)
    const text = await fs.readFile(file, 'utf8')
    await fs.writeFile(file, text.replaceAll(sourceRoot, '.'), 'utf8')
  }
  async function removeMaps(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isSymbolicLink())
        throw new Error('Unexpected symbolic link in staged Prisma client')
      if (entry.isDirectory()) await removeMaps(file)
      else if (entry.name.endsWith('.map')) await fs.unlink(file)
    }
  }
  await removeMaps(path.join(resources, 'node_modules', '@prisma', 'client'))
  await fs.rm(path.join(resources, 'default_app.asar'), { force: true })
}
