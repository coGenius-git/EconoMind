// Adds the EconoMind research-domain category column to Project (economics / management / finance
// / accounting / case_study; existing rows default to "general").
const projectCategoryMigration = {
  id: '0041_project_category',
  statements: [`ALTER TABLE "Project" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'general'`],
  operations: [] as const,
  verifiers: [{ kind: 'column-exists', version: 1, table: 'Project', column: 'category' }] as const
}

export { projectCategoryMigration }
