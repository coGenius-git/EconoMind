import { useId, type ComponentPropsWithoutRef } from 'react'

import darkLogoUrl from '@/assets/logo-dark.png'
import lightLogoUrl from '@/assets/logo.png'
import { useThemeStore } from '@/stores/theme-store'

type AppLogoProps = Omit<ComponentPropsWithoutRef<'img'>, 'src'> & { transparent?: boolean }

// The single renderer-facing EconoMind logo. Consumers only describe presentation (size, class,
// accessible name); the effective General > Theme decides the asset here. Reading resolvedTheme is
// important: it covers both an explicit Light/Dark choice and live OS changes while following System.
const AppLogo = ({ alt = '', transparent = false, ...props }: AppLogoProps): React.JSX.Element => {
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme)
  const filterId = useId()
  const src = resolvedTheme === 'dark' ? darkLogoUrl : lightLogoUrl

  if (transparent) {
    return (
      <>
        <svg aria-hidden="true" width="0" height="0" className="pointer-events-none absolute">
          <defs>
            <filter
              id={filterId}
              x="0"
              y="0"
              width="100%"
              height="100%"
              colorInterpolationFilters="sRGB"
            >
              <feColorMatrix
                type="matrix"
                values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -0.2126 -0.7152 -0.0722 0 1"
              />
              <feComposite in2="SourceAlpha" operator="in" />
            </filter>
          </defs>
        </svg>
        <img
          {...props}
          src={lightLogoUrl}
          alt={alt}
          style={{
            ...props.style,
            filter: `url(#${filterId})${resolvedTheme === 'dark' ? ' invert(1)' : ''}`
          }}
        />
      </>
    )
  }

  return <img {...props} src={src} alt={alt} />
}

export { AppLogo }
export type { AppLogoProps }
