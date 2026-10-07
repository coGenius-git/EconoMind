import type { NavigationView } from '@/stores/navigation-store'

export const PRODUCT_TOUR_STEPS = [
  {
    view: 'home',
    target: 'home',
    title: 'Your research home',
    description:
      'This is your starting point. Switch between the literature library and research workspace here, and return home to see your projects and recent work.'
  },
  {
    view: 'home',
    target: 'new-project',
    title: 'Start with a project',
    description:
      'Create a project for each research topic. Choose its working folder to keep your data, code, conversations, and results together.'
  },
  {
    view: 'home',
    target: 'projects',
    title: 'Manage your projects',
    description:
      'Open a project to continue researching. Project menus let you rename, pin, archive, or export your work.'
  },
  {
    view: 'home',
    target: 'recent-sessions',
    title: 'Continue a conversation',
    description:
      'Recent conversations appear here. Reopen one to continue from its saved messages and results without starting over.'
  },
  {
    view: 'library',
    target: 'library-content',
    title: 'Explore your literature library',
    description:
      'Search for papers, import references and PDFs, and organize collections. Read and annotate papers, screen literature, and explore bibliometric analysis here.'
  },
  {
    view: 'library',
    target: 'library-sidebar',
    title: 'Organize your references',
    description:
      'This sidebar groups all references, collections, and project literature. Use Duplicates to review repeated records, and Trash to restore deleted references.'
  },
  {
    view: 'library',
    target: 'library-inbox',
    title: 'Review the literature Inbox',
    description:
      'The Inbox holds references found by Agents. Review them before accepting them into your library; dismissed references can be restored.'
  },
  {
    view: 'library',
    target: 'library-import',
    title: 'Add papers and PDFs',
    description:
      'Use this menu to import PDFs or reference files, or add a reference manually. Imported records can then be organized into collections and linked to projects.'
  },
  {
    view: 'library',
    target: 'library-search',
    title: 'Search your saved references',
    description:
      'Search the current library scope here. This searches your saved references; use external sources in the sidebar to discover new papers.'
  },
  {
    view: 'library',
    target: 'library-discovery',
    title: 'Discover papers from external sources',
    description:
      'Open external search here to retrieve papers by topic and import the references you choose. Searching and importing only happen when you explicitly request them.'
  },
  {
    view: 'library',
    target: 'library-tools',
    title: 'Screen and analyze literature',
    description:
      'Use literature screening to review papers for a research project, and Bibliometrics to analyze publication trends and networks. Screening becomes available when a project is selected.'
  },
  {
    view: 'library',
    target: 'library-content',
    title: 'Read and inspect a paper',
    description:
      'Select a reference in this list to inspect its metadata and attachments. Open its PDF to read and annotate it, or choose Read with agent for an assisted reading conversation.'
  },
  {
    view: 'workspace',
    target: 'workspace-conversation',
    title: 'Work with your research agents',
    description:
      'Inside a project, use the conversation area to describe a task and choose a Specialist from the sidebar. Agents can analyze data and run code in Notebooks; the files and preview area shows your documents, charts, and results.'
  },
  {
    view: 'workspace',
    target: 'workspace-sidebar',
    title: 'Navigate the project workspace',
    description:
      'This sidebar contains project conversations, Specialists, and Files. Start a new conversation for a different task or reopen an existing one. Create a project first to begin your own research.'
  },
  {
    view: 'workspace',
    target: 'workspace-specialist-catalog',
    title: 'Choose a research Specialist',
    description:
      'This is the Specialist directory. Inspect each expert and its example tasks, then summon the expert when you are ready. This guide does not summon an expert or send a message.'
  },
  {
    view: 'workspace',
    target: 'workspace-conversation',
    title: 'Follow the research conversation',
    description:
      'Messages, tool activity, and research results appear in this conversation area. You can return to saved conversations from the sidebar and continue the same task.'
  },
  {
    view: 'workspace',
    target: 'workspace-composer',
    title: 'Describe the task and attach evidence',
    description:
      'Write your question here, attach files with the plus menu, and select the model before sending. Notebook results and task progress are shown near this editor when available.'
  },
  {
    view: 'workspace',
    target: 'workspace-file-preview',
    title: 'Inspect files and generated results',
    description:
      'Files is now open in the preview area. Browse project files and generated documents, charts, and code here; open a file to inspect it while keeping the conversation available.'
  },
  {
    view: 'home',
    target: 'search',
    title: 'Find your research quickly',
    description:
      'Search across projects, conversations, literature, and files. You can also open search with Cmd/Ctrl+K.'
  },
  {
    view: 'home',
    target: 'settings',
    title: 'Make the workspace yours',
    description:
      'Manage models, Specialists, skills, connectors, runtimes, and other preferences in Settings. To see this guide again, open Settings → General → Restart new user guide.'
  }
] as const satisfies ReadonlyArray<{
  view: NavigationView
  target: string
  title: string
  description: string
}>
