import { z } from 'zod'
import type { RestrictedInferenceRunner } from '../acp/restricted-inference-runner'
import type { ExplicitAgentBackendTarget } from '../settings/backend-resolver'

export type ScreeningModel = {
  name: string
  generate(system: string, prompt: string, signal: AbortSignal): Promise<string>
}

class ScreeningModelError extends Error {
  constructor(
    message: string,
    readonly retryable = true
  ) {
    super(message)
  }
}

// Includes isolated agent startup as well as inference. A fresh deadline belongs to each attempt.
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000

export class ScreeningOutputError extends Error {
  constructor(details: string) {
    super('The model returned invalid screening data. Retry this reference.', {
      cause: new Error(`Screening output validation: ${details}`)
    })
    this.name = 'ScreeningOutputError'
  }
}

function parseScreeningJson(text: string): unknown {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    // Agents may wrap their answer in prose or a Markdown fence. Extract only a single,
    // complete top-level value; never recover a nested fragment from truncated output.
    const values: string[] = []
    const stack: string[] = []
    let start = -1
    let quoted = false
    let escaped = false
    for (let index = 0; index < trimmed.length; index++) {
      const char = trimmed[index]
      if (start < 0) {
        if (char !== '{' && char !== '[') continue
        start = index
      }
      if (quoted) {
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === '"') quoted = false
      } else if (char === '"') quoted = true
      else if (char === '{' || char === '[') stack.push(char)
      else if (char === '}' || char === ']') {
        if (stack.pop() !== (char === '}' ? '{' : '['))
          throw new SyntaxError('Mismatched JSON brackets.')
        if (!stack.length) {
          values.push(trimmed.slice(start, index + 1))
          start = -1
        }
      }
    }
    if (start >= 0 || values.length !== 1)
      throw new SyntaxError('Expected one complete JSON object.')
    return JSON.parse(values[0])
  }
}

function validationFeedback(error: SyntaxError | z.ZodError): string {
  if (error instanceof SyntaxError)
    return 'Return exactly one complete JSON object, with no prose or Markdown. Fix JSON quoting, escaping and brackets; do not return a partial object.'
  // Deliberately exclude received values and raw model output from prompts and diagnostics.
  return JSON.stringify(
    error.issues.slice(0, 8).map((issue) => ({
      path: issue.path.map(String).join('.'),
      code: issue.code
    }))
  )
}

export function createScreeningModel(
  runner: Pick<RestrictedInferenceRunner, 'run'>,
  target: ExplicitAgentBackendTarget
): ScreeningModel {
  return {
    name: `${target.providerId ?? ''}/${target.model.kind === 'required' ? target.model.id : 'default'}`,
    async generate(systemPrompt, prompt, signal) {
      signal.throwIfAborted()
      const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      try {
        const result = await runner.run({
          target,
          systemPrompt,
          prompt,
          agentName: 'Literature screening',
          description: 'Screen literature and extract grounded research evidence',
          signal: AbortSignal.any([signal, timeout]),
          outputLimitBytes: 256 * 1024
        })
        signal.throwIfAborted()
        timeout.throwIfAborted()
        if (result.stopReason === 'refusal')
          throw new ScreeningModelError(
            'The model declined this request. Check the model settings and retry.',
            false
          )
        if (result.stopReason === 'cancelled')
          throw new ScreeningModelError('The model request was interrupted. Retry this reference.')
        if (result.stopReason !== 'end_turn')
          throw new ScreeningModelError('The model response was incomplete. Retry this reference.')
        return result.text
      } catch (error) {
        // A user pause must remain a pause, even if it races with a deadline or provider failure.
        signal.throwIfAborted()
        if (timeout.aborted)
          throw new ScreeningModelError(
            'The model request timed out. Retry this reference or use a faster model.'
          )
        throw error
      }
    }
  }
}

export async function generateScreeningJson<T>(
  model: ScreeningModel,
  schema: z.ZodType<T>,
  system: string,
  prompt: string,
  signal: AbortSignal
): Promise<T> {
  const jsonInstructions =
    ' Return only one complete valid JSON object. Escape double quotes, backslashes and line breaks inside JSON strings. Keep explanations concise and quotes short; never change quoted source text.'
  const contract = '\nRequired JSON Schema:\n' + JSON.stringify(z.toJSONSchema(schema))
  let feedback = ''
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted()
    try {
      const text = await model.generate(
        system +
          jsonInstructions +
          contract +
          (attempt
            ? '\nThe previous attempt failed. Generate the complete result again from the supplied source and follow the required schema exactly. Validation feedback: ' +
              feedback
            : ''),
        prompt,
        signal
      )
      signal.throwIfAborted()
      return schema.parse(parseScreeningJson(text))
    } catch (error) {
      signal.throwIfAborted()
      const invalidOutput = error instanceof SyntaxError || error instanceof z.ZodError
      if (!invalidOutput && !(error instanceof ScreeningModelError && error.retryable)) throw error
      feedback = invalidOutput
        ? validationFeedback(error)
        : 'The previous response did not complete. Keep the result concise and complete all required fields.'
      // Retry only the failed chunk, once. Never guess a decision or silently alter broken JSON.
      if (attempt >= 1) {
        if (invalidOutput) throw new ScreeningOutputError(feedback)
        throw error
      }
    }
  }
}
