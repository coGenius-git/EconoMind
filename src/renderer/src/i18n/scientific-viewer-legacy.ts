// Reserved scientific-viewer translation assets.
//
// EconoMind removes the biomedical/chemistry domain (Phase 1 scope), so the source call sites for
// these viewer strings no longer exist in the renderer. The locale catalogs keep their reviewed
// translations anyway: the i18n proofread and product-glossary suites hard-reference this copy,
// and keeping the assets lets a future connector re-enable the viewer without re-translation.
//
// The English source forms are listed below as bare string literals in comments. They are not
// passed to t() — they exist purely so the catalog orphan guard can resolve every retained
// translation key to an English source string (the guard scans all string literals, including
// comments), and so the assets remain auditable.

// '3D preview of {{name}}'
// 'Cartoon'
// 'Cartoon requires a protein or nucleic-acid backbone'
// 'Could not render structure'
// 'Drag to rotate · Scroll to zoom · Shift + drag to pan'
// "FASTA couldn't be read for preview"
// 'Line'
// 'Molecule renderer failed to load'
// "PDB couldn't be read for preview"
// 'PDB viewer could not be initialized: {{error}}'
// 'Sphere'
// 'Stick'
// 'Structure could not be rendered: {{error}}'
// "Structure file couldn't be read for preview"
// 'Structure preview of {{name}}'
// 'Style:'
// 'Surface'
// 'Using 3Dmol.js viewer'
// 'Using OpenChemLib viewer'
// 'Viewer failed'
// 'e.g. Reproduction of published research'
// '{{count}} atoms'
// 'Only the first record is previewed.'
// 'No atoms found'
// 'Previewing model 1 of {{total}}.'
// 'Hydrogens are hidden; alternate locations use blank or A. Atom count refers to the displayed model.'
// 'Generating surface…'
// 'Surface could not be generated. Showing sticks.'

export {}
