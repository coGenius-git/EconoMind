import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { EmptyConversationBanner } from './EmptyConversationBanner'

describe('EmptyConversationBanner', () => {
  it('renders the centered research heading with a decorative application logo', () => {
    const html = renderToStaticMarkup(<EmptyConversationBanner />)

    expect(html).toContain('data-testid="empty-conversation-banner"')
    expect(html).toContain('What will you research in EconoMind?')
    expect(html).toContain('Discover, share, and collaborate on research that matters')
    // The icon is decorative; the heading and description carry meaning.
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('<h2')
    expect(html).toContain('<img')
    expect(html).toContain('logo.png')
    expect(html).not.toContain('lucide-book-open-text')
    expect(html).toContain('text-2xl font-semibold')
    expect(html).toContain('text-sm leading-6 text-muted-foreground')
  })
})
