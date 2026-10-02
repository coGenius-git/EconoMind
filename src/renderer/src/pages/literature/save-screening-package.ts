import type { SaveBlobFileResult } from '../../../../shared/file-save'
import type { ScreeningResponse } from '../../../../shared/literature-screening'
import { screeningEvidenceFilename } from '../../../../shared/literature-screening'
import { WEB_CALLER_LOCATION_ATTRIBUTE } from '../../../../shared/web-caller-location'

type SaveHandle = {
  name: string
  createWritable(): Promise<{
    write(data: Uint8Array): Promise<void>
    close(): Promise<void>
    abort(): Promise<void>
  }>
}

export async function saveScreeningPackage(
  name: string,
  prepare: () => Promise<ScreeningResponse['export']>
): Promise<SaveBlobFileResult> {
  const filename = screeningEvidenceFilename(name)
  let handle: SaveHandle | undefined
  if (document.documentElement.hasAttribute(WEB_CALLER_LOCATION_ATTRIBUTE)) {
    const picker = (
      window as unknown as {
        showSaveFilePicker?: (options: {
          suggestedName: string
          startIn: 'desktop'
          types: { description: string; accept: Record<string, string[]> }[]
        }) => Promise<SaveHandle>
      }
    ).showSaveFilePicker
    if (!picker)
      throw new Error(
        'This browser cannot choose a save location. Open this page in Chrome or Edge, or use the desktop app.'
      )
    try {
      // Must run directly from the click, before any server request consumes user activation.
      handle = await picker.call(window, {
        suggestedName: filename,
        startIn: 'desktop',
        types: [{ description: 'ZIP', accept: { 'application/zip': ['.zip'] } }]
      })
    } catch (error) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError')
        return { saved: false }
      throw error
    }
  }
  const data = await prepare()
  if (!data) return { saved: false }
  const bytes = Uint8Array.from(atob(data.base64), (char) => char.charCodeAt(0))
  if (!handle)
    return window.api.saveBlobFile({
      suggestedName: filename,
      mimeType: 'application/zip',
      defaultDirectory: 'desktop',
      data: bytes.buffer
    })
  const writable = await handle.createWritable()
  try {
    await writable.write(bytes)
    await writable.close()
    return { saved: true, filePath: handle.name }
  } catch (error) {
    await writable.abort().catch(() => undefined)
    throw error
  }
}
