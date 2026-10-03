import { useEffect, useRef, useState } from 'react'
import type { TFunction } from 'i18next'
import type { SpecialistListItem } from '../../../../shared/specialist'
import { builtinSpecialistExample } from './builtin-specialist-examples'
import { docToText, type ComposerDoc, type ComposerCaretPosition } from './composer/composer-doc'

type Options = {
  scopeKey: string
  selectedId: string | undefined
  items: SpecialistListItem[]
  doc: ComposerDoc
  canEdit: boolean
  pending: boolean
  failed: boolean
  select: (id: string | undefined) => void
  changeDoc: (doc: ComposerDoc, caret?: ComposerCaretPosition) => void
  t: TFunction
}

// An explicit menu selection owns one prefill request. Hydration, runtime handoffs and session
// navigation must never create examples. Recheck the draft after asynchronous reconfiguration.
export const useSpecialistExample = ({
  scopeKey,
  selectedId,
  items,
  doc,
  canEdit,
  pending,
  failed,
  select,
  changeDoc,
  t
}: Options): ((id: string | undefined) => void) => {
  const [request, setRequest] = useState<{
    scopeKey: string
    id: string | undefined
    baseline: string
    replaceable: boolean
  } | null>(null)
  const handledRequest = useRef<typeof request>(null)
  const lastExample = useRef<{ scopeKey: string; text: string } | null>(null)

  useEffect(() => {
    if (!request || handledRequest.current === request) return
    if (request.scopeKey !== scopeKey || failed) {
      handledRequest.current = request
      return
    }
    if (pending || selectedId !== request.id) return
    handledRequest.current = request
    if (!canEdit || !request.replaceable || JSON.stringify(doc) !== request.baseline) return
    const item = items.find(
      (candidate) => candidate.kind !== 'reviewer' && candidate.id === request.id
    )
    const text = builtinSpecialistExample(item, t)
    if (text === undefined && lastExample.current?.scopeKey !== scopeKey) return
    const nextText = text ?? ''
    lastExample.current = text ? { scopeKey, text } : null
    changeDoc(nextText ? { nodes: [{ type: 'text', text: nextText }] } : { nodes: [] }, {
      nodeIndex: 0,
      offset: nextText.length
    })
  }, [request, scopeKey, selectedId, pending, failed, canEdit, doc, items, changeDoc, t])

  return (id) => {
    const plainTextOnly = doc.nodes.every((node) => node.type === 'text')
    const text = docToText(doc)
    setRequest({
      scopeKey,
      id,
      baseline: JSON.stringify(doc),
      replaceable:
        canEdit &&
        plainTextOnly &&
        (text.trim() === '' ||
          (lastExample.current?.scopeKey === scopeKey && text === lastExample.current.text))
    })
    select(id)
  }
}
