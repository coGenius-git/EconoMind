// Restores the scientific-viewer translation assets that were removed by Phase 1 domain trimming
// but are still hard-referenced by i18n proofread/glossary tests. Values come verbatim from HEAD
// (the pre-trim locale catalogs). Run from repo root: node scripts/restore-scientific-i18n.mjs
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const localesDir = join(root, 'src', 'shared', 'i18n', 'locales')
const LOCALES = ['de', 'es', 'fr', 'ja', 'ko', 'ru', 'zh-Hans', 'zh-Hant']

// Keys the i18n suite hard-references (German/French/Russian proofread, product glossary) whose
// source call sites no longer exist after removing the scientific viewer.
const RESTORE_KEYS = [
  '3D preview of {{name}}',
  'Cartoon',
  'Cartoon requires a protein or nucleic-acid backbone',
  'Could not render structure',
  'Drag to rotate · Scroll to zoom · Shift + drag to pan',
  "FASTA couldn't be read for preview",
  'Line',
  'Molecule renderer failed to load',
  "PDB couldn't be read for preview",
  'PDB viewer could not be initialized: {{error}}',
  'Sphere',
  'Stick',
  'Structure could not be rendered: {{error}}',
  "Structure file couldn't be read for preview",
  'Structure preview of {{name}}',
  'Style:',
  'Surface',
  'Using 3Dmol.js viewer',
  'Using OpenChemLib viewer',
  'Viewer failed',
  'e.g. Reproduction of published research',
  '{{count}} atoms_other',
  'Only the first record is previewed.',
  'No atoms found',
  'Previewing model 1 of {{total}}.',
  'Hydrogens are hidden; alternate locations use blank or A. Atom count refers to the displayed model.',
  'Generating surface…',
  'Surface could not be generated. Showing sticks.'
]

let restored = 0
for (const locale of LOCALES) {
  const path = join(localesDir, `${locale}.json`)
  const current = JSON.parse(readFileSync(path, 'utf8'))
  const head = JSON.parse(
    execFileSync('git', ['show', `HEAD:src/shared/i18n/locales/${locale}.json`], {
      cwd: root,
      encoding: 'utf8'
    })
  )
  for (const namespace of ['common', 'renderer']) {
    const bucket = head[namespace]
    if (!bucket || typeof bucket !== 'object') continue
    for (const key of RESTORE_KEYS) {
      if (typeof bucket[key] !== 'string') continue
      if (typeof current[namespace]?.[key] === 'string') continue
      current[namespace] = current[namespace] ?? {}
      current[namespace][key] = bucket[key]
      restored += 1
    }
  }
  writeFileSync(path, `${JSON.stringify(current, null, 2)}\n`, 'utf8')
}
console.log(`restored ${restored} translation entries`)
