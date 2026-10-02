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
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted()
    try {
      const text = await model.generate(
        system +
          jsonInstructions +
          (attempt
            ? ' The previous attempt failed. Generate the complete result again from the supplied source and follow the required schema exactly.'
            : ''),
        prompt,
        signal
      )
      signal.throwIfAborted()
      return schema.parse(
        JSON.parse(
          text
            .trim()
            .replace(/^```(?:json)?\s*/iu, '')
            .replace(/\s*```$/u, '')
        )
      )
    } catch (error) {
      signal.throwIfAborted()
      const invalidOutput = error instanceof SyntaxError || error instanceof z.ZodError
      if (!invalidOutput && !(error instanceof ScreeningModelError && error.retryable)) throw error
      // Retry only the failed chunk, once. Never guess a decision or silently alter broken JSON.
      if (attempt >= 1) {
        if (invalidOutput)
          throw new Error('The model returned invalid screening data. Retry this reference.')
        throw error
      }
    }
  }
}
