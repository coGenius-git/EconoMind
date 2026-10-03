// Modified by EconoMind contributors: independent identity, attribution and update source.
// Based on AIPOCH Open Science; see LICENSE and NOTICE.
// Single source of truth for project identity and external links. Shared by the main process and
// the renderer (every entry-point link). Keep this UI-free — no icons, no JSX — so both processes
// can import it and any screen reuses the same values.

const GITHUB_OWNER = 'coGenius-git'
const GITHUB_REPO = 'EconoMind'
const GITHUB_REPO_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`
const CDN_BASE_URL = 'https://statics.aipoch.com/open-science'

export const APP = {
  name: 'EconoMind',
  fullNameZh: '经管智研工作台',
  tagline: 'AI-powered Economics & Management Research Assistant',
  githubOwner: GITHUB_OWNER,
  githubRepo: GITHUB_REPO,
  cdnBaseUrl: CDN_BASE_URL,
  links: {
    docs: `${GITHUB_REPO_URL}/blob/main/docs/README.md`,
    githubRepo: GITHUB_REPO_URL,
    githubApi: `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`,
    license: `${GITHUB_REPO_URL}/blob/main/LICENSE`,
    githubReleases: `${GITHUB_REPO_URL}/releases`,
    githubIssues: `${GITHUB_REPO_URL}/issues`,
    githubFeedback: `${GITHUB_REPO_URL}/issues/new?template=feature_request.yml`
  },
  copyright: '© 2026 EconoMind contributors; upstream © 2026 AIPOCH.',
  update: {
    // EconoMind has no published update manifest yet. Never fall back to the upstream app feed.
    manifestUrl: '',
    downloadPage: `${GITHUB_REPO_URL}/releases`
  }
} as const
