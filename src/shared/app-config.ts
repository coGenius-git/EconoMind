// Single source of truth for project identity and external links. Shared by the main process and
// the renderer (every entry-point link). Keep this UI-free — no icons, no JSX — so both processes
// can import it and any screen reuses the same values.

const GITHUB_OWNER = 'aipoch'
const GITHUB_REPO = 'open-science'
const GITHUB_REPO_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`

export const APP = {
  name: 'EconoMind',
  fullNameZh: '经管智研工作台',
  tagline: 'AI-powered Economics & Management Research Assistant',
  githubOwner: GITHUB_OWNER,
  links: {
    website: 'http://www.genius666.xyz/',
    docs: 'https://www.aipoch.com/docs/',
    githubReleases: `${GITHUB_REPO_URL}/releases`,
    githubIssues: `${GITHUB_REPO_URL}/issues`,
    githubFeedback: `${GITHUB_REPO_URL}/issues/new?template=feature_request.yml`,
    discord: 'https://discord.gg/85dKfuGM9',
    x: 'https://x.com/aipoch_ai'
  },
  copyright: '© 2026 AIPOCH. All rights reserved.',
  update: {
    manifestUrl: 'https://statics.aipoch.com/open-science/app/stable/version.json',
    downloadPage: 'https://www.aipoch.com/open-science'
  }
} as const
