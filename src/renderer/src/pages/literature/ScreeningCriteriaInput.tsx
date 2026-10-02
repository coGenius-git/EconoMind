import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { normalizeCriteria, type ScreeningCriteria } from '../../../../shared/literature-screening'

export function ScreeningCriteriaInput({
  kind,
  value,
  disabled,
  onChange
}: {
  kind: 'inclusion' | 'exclusion'
  value: ScreeningCriteria
  disabled: boolean
  onChange: (value: ScreeningCriteria, text: string) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const id = useId()
  const label = kind === 'inclusion' ? t('Inclusion criteria') : t('Exclusion criteria')
  const descriptions = {
    all:
      kind === 'inclusion'
        ? t('Include only when every condition is met.')
        : t('Exclude only when every condition is met.'),
    any:
      kind === 'inclusion'
        ? t('Include when at least one condition is met.')
        : t('Exclude when at least one condition is met.'),
    custom: t(
      'Existing criteria are preserved as written. Organize them into separate conditions before choosing all or any.'
    )
  }
  const modes = {
    all: t('All conditions'),
    any: t('Any condition'),
    custom: t('Follow written rules')
  }
  const items = value.items.length ? value.items : ['']
  const update = (next: ScreeningCriteria): void => {
    const normalized = normalizeCriteria(next)
    // Keep a readable text version for existing reports, alongside structured rules for screening.
    const text = normalized.items.length
      ? [
          ...(next.mode === 'custom' ? [] : [descriptions[next.mode]]),
          normalized.items
            .map((item, index) => (next.mode === 'custom' ? item : `${index + 1}. ${item}`))
            .join('\n\n'),
          ...(normalized.notes
            ? [`${t('Notes and exceptions (optional)')}\n${normalized.notes}`]
            : [])
        ].join('\n\n')
      : ''
    onChange(next, text)
  }
  return (
    <fieldset disabled={disabled} className="min-w-0 rounded-xl border border-border bg-card p-5">
      <legend className="px-1 text-lg font-bold">{label}</legend>
      <div
        role="radiogroup"
        aria-label={t('{{group}} matching mode', { group: label })}
        className="flex flex-wrap gap-2"
      >
        {(Object.keys(modes) as ScreeningCriteria['mode'][]).map((mode) => (
          <label
            key={mode}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm',
              value.mode === mode
                ? 'border-primary bg-primary/10 font-medium text-primary'
                : 'border-border',
              disabled && 'cursor-not-allowed opacity-50'
            )}
          >
            <input
              type="radio"
              name={`${id}-mode`}
              value={mode}
              checked={value.mode === mode}
              onChange={() => update({ ...value, mode })}
              className="accent-primary"
            />
            {modes[mode]}
          </label>
        ))}
      </div>
      <p className="mb-4 mt-2 text-xs leading-relaxed text-muted-foreground">
        {descriptions[value.mode]}
      </p>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <label
                htmlFor={`${id}-${index}`}
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                {t('{{group}} item {{index}}', { group: label, index: index + 1 })}
              </label>
              <Textarea
                id={`${id}-${index}`}
                rows={3}
                maxLength={10000}
                value={item}
                placeholder={t('Write one complete condition')}
                onChange={(event) =>
                  update({
                    ...value,
                    items: items.map((text, i) => (i === index ? event.target.value : text))
                  })
                }
              />
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="mt-5"
              aria-label={t('Remove {{group}} item {{index}}', { group: label, index: index + 1 })}
              onClick={() => update({ ...value, items: items.filter((_, i) => i !== index) })}
            >
              <X className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          disabled={disabled || items.length >= 50}
          onClick={() => update({ ...value, items: [...items, ''] })}
        >
          <Plus className="mr-2 size-4" />
          {t('Add {{group}} item', { group: label })}
        </Button>
      </div>
      <div className="mt-4 border-t border-border pt-4">
        <label htmlFor={`${id}-notes`} className="mb-2 block text-sm font-medium">
          {t('Notes and exceptions (optional)')}
        </label>
        <Textarea
          id={`${id}-notes`}
          aria-label={t('{{group}} notes and exceptions', { group: label })}
          rows={2}
          maxLength={10000}
          value={value.notes}
          placeholder={t('For example: Keep references pending when full text is missing.')}
          onChange={(event) => update({ ...value, notes: event.target.value })}
        />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {t(
          'Up to 50 conditions per group; conditions and notes together must fit within 10,000 characters.'
        )}
      </p>
    </fieldset>
  )
}
