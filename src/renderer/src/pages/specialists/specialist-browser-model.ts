import type { SpecialistListItem } from '../../../../shared/specialist'

export type BrowsableSpecialist = Exclude<SpecialistListItem, { kind: 'reviewer' }>

// Read the first numbered workflow from the actual profile. There is no separate
// browser catalog to drift from the Specialist that will run in the conversation.
export const specialistTasks = (systemPrompt: string): string[] => {
  const tasks: string[] = []
  for (const line of systemPrompt.split(/\r?\n/)) {
    const task = line.match(/^\s*\d+[.)、．]\s*(.+)$/)
    if (task) tasks.push(task[1])
    else if (tasks.length > 0 && line.trim()) break
  }
  return tasks
}
