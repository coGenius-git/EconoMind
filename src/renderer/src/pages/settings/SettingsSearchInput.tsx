import { Search, X } from 'lucide-react'
import { useRef, useState, type ChangeEvent, type ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import {
  getSettingsSearchKeyShortcuts,
  useSettingsSearchShortcut
} from './settings-search-shortcut'

type SettingsSearchInputProps = Omit<ComponentProps<typeof Input>, 'ref' | 'type'> & {
  containerClassName?: string
}

export const SettingsSearchInput = ({
  className,
  containerClassName,
  value,
  defaultValue,
  onChange,
  ...props
}: SettingsSearchInputProps): React.JSX.Element => {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  useSettingsSearchShortcut(inputRef)
  const [uncontrolledText, setUncontrolledText] = useState(
    typeof defaultValue === 'string' ? defaultValue : ''
  )
  const hasText = value !== undefined ? String(value).length > 0 : uncontrolledText.length > 0

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setUncontrolledText(event.target.value)
    onChange?.(event)
  }

  const clearQuery = (): void => {
    const input = inputRef.current
    if (!input) return
    // Route the clear through a real input event so controlled and uncontrolled parents both see
    // a normal change, then keep focus in the field for continued typing.
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, '')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    setUncontrolledText('')
    input.focus()
  }

  return (
    <div className={cn('group relative min-w-0 flex-1', containerClassName)}>
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        {...props}
        ref={inputRef}
        type="search"
        // Keep :placeholder-shown available even when callers omit placeholder copy.
        placeholder={props.placeholder || ' '}
        value={value}
        defaultValue={defaultValue}
        onChange={handleChange}
        aria-keyshortcuts={getSettingsSearchKeyShortcuts()}
        className={cn(
          'peer pl-8 pr-2.5 [&::-webkit-search-cancel-button]:hidden',
          // The clear button needs more room than the text-only padding once the field has text.
          hasText && 'pr-8!',
          className
        )}
      />
      {hasText ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          data-slot="settings-search-clear"
          aria-label={t('Clear search')}
          title={t('Clear search')}
          className="absolute inset-y-0 right-1.5 my-auto text-muted-foreground hover:text-foreground"
          onMouseDown={(event) => event.preventDefault()}
          onClick={clearQuery}
        >
          <X className="size-3.5" strokeWidth={2} aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  )
}
