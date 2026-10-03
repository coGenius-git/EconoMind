import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { createProjectDbClient } from '../projects/prisma-client'
import { migrateApplicationDatabase } from './migration-service'

let root: string | undefined
let client: ReturnType<typeof createProjectDbClient> | undefined
afterEach(async () => {
  await client?.$disconnect()
  if (root) await rm(root, { recursive: true, force: true })
})
it('backfills collection revisions without changing existing values or hierarchy', async () => {
  root = await mkdtemp(join(tmpdir(), 'collection-revision-'))
  client = createProjectDbClient(root)
  await migrateApplicationDatabase(client)
  await client.literatureCollection.create({
    data: { id: 'parent', name: 'Parent', nameKey: 'parent', description: 'Saved description' }
  })
  await client.literatureCollection.create({
    data: { id: 'child', name: 'Child', nameKey: 'child', parentId: 'parent' }
  })
  const sql =
    'SELECT "id", "name", "description", "parentId", "createdAt", "updatedAt" FROM "LiteratureCollection" ORDER BY "id"'
  const before = await client.$queryRawUnsafe(sql)
  await client.$executeRawUnsafe('ALTER TABLE "LiteratureCollection" DROP COLUMN "revision"')
  await client.$executeRawUnsafe(
    "DELETE FROM \"_open_science_migrations\" WHERE id IN ('0040_literature_collection_revision', '0041_project_category', '0042_bookmarks', '0043_classification_usage', '0044_pdf_annotations', '0045_literature_smart_collections', '0046_literature_smart_pause_run', '0047_journal_attributes', '0048_session_replay')"
  )
  await expect(
    migrateApplicationDatabase(client, { databasePath: join(root, 'open-science.db') })
  ).resolves.toMatchObject({
    applied: [
      '0040_literature_collection_revision',
      '0041_project_category',
      '0042_bookmarks',
      '0043_classification_usage',
      '0044_pdf_annotations',
      '0045_literature_smart_collections',
      '0046_literature_smart_pause_run',
      '0047_journal_attributes',
      '0048_session_replay'
    ]
  })
  expect(await client.$queryRawUnsafe(sql)).toEqual(before)
  expect(await client.literatureCollection.findMany({ select: { revision: true } })).toEqual([
    { revision: 1 },
    { revision: 1 }
  ])
  await expect(migrateApplicationDatabase(client)).resolves.toMatchObject({ applied: [] })
  expect(await client.$queryRawUnsafe('PRAGMA foreign_key_check')).toEqual([])
})
