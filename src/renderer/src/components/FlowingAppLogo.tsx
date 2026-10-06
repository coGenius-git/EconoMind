import { useId } from 'react'

import lightLogoUrl from '@/assets/logo.png'
import { AppLogo } from './AppLogo'

// The mark stays still; only the light rotates through a mask of the original artwork.
export function FlowingAppLogo({ className }: { className?: string }): React.JSX.Element {
  const id = useId()
  const inkId = `${id}-ink`
  const maskId = `${id}-lines`

  return (
    <span
      aria-hidden="true"
      className={className}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <AppLogo transparent className="size-full object-contain" />
      <svg
        aria-hidden="true"
        className="research-logo-flow pointer-events-none absolute inset-0 size-full"
        viewBox="0 0 1024 1024"
      >
        <defs>
          <filter
            id={inkId}
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
          <mask
            id={maskId}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="1024"
            height="1024"
            style={{ maskType: 'alpha' }}
          >
            <image href={lightLogoUrl} width="1024" height="1024" filter={`url(#${inkId})`} />
          </mask>
        </defs>
        <g mask={`url(#${maskId})`}>
          <foreignObject x="0" y="0" width="1024" height="1024">
            <div className="research-logo-orbit" />
          </foreignObject>
        </g>
      </svg>
    </span>
  )
}
