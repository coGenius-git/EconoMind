import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import {
  checkWindowsAppContainer,
  isWindowsProtectionConfigured
} from '../runtime/src/platform/windows-appcontainer.js'

it('turns an actual missing-host spawn into repair guidance and keeps execution unavailable', async () => {
  const hostPath = join(tmpdir(), randomUUID(), 'notebook-appcontainer-host.exe')
  await expect(
    isWindowsProtectionConfigured(hostPath, 'missing-host-test', tmpdir())
  ).rejects.toMatchObject({
    message: expect.stringContaining('npm run build:notebook-host'),
    cause: { code: 'ENOENT' }
  })
  const check = await checkWindowsAppContainer(hostPath, 'missing-host-test', tmpdir())
  expect(check.errors).toEqual([expect.stringContaining('npm run build:notebook-host')])
})
