import type { TFunction } from 'i18next'

export function screeningErrorMessage(message: string, t: TFunction): string {
  // Also explain failures saved by older versions, without changing their audit records.
  if (message.includes('in JSON at position') || message.includes('Unexpected end of JSON'))
    return t('The model returned invalid screening data. Retry this reference.')
  switch (message) {
    case 'The model returned invalid screening data. Retry this reference.':
      return t('The model returned invalid screening data. Retry this reference.')
    case 'The model request timed out. Retry this reference or use a faster model.':
      return t('The model request timed out. Retry this reference or use a faster model.')
    case 'Restricted inference was cancelled.':
    case 'Restricted inference was cancelled':
    case 'The model request was interrupted. Retry this reference.':
      return t('The model request was interrupted. Retry this reference.')
    case 'The model response was incomplete. Retry this reference.':
      return t('The model response was incomplete. Retry this reference.')
    case 'The model declined this request. Check the model settings and retry.':
      return t('The model declined this request. Check the model settings and retry.')
    case 'This browser cannot choose a save location. Open this page in Chrome or Edge, or use the desktop app.':
      return t(
        'This browser cannot choose a save location. Open this page in Chrome or Edge, or use the desktop app.'
      )
    default:
      return message
  }
}
