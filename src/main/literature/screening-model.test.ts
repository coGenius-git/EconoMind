import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type {
  RestrictedInferenceRunInput,
  RestrictedInferenceResult
} from '../acp/restricted-inference-runner'
import { createScreeningModel, generateScreeningJson } from './screening-model'

const target = {
  frameworkId: 'claude-code',
  providerId: 'test-provider',
  reasoningEffort: 'high',
  model: { kind: 'required', id: 'test-model' }
} as const
const result = (
  stopReason: RestrictedInferenceResult['stopReason'] = 'end_turn'
): RestrictedInferenceResult => ({
  text: '{"decision":"included"}',
  frameworkId: 'claude-code',
  model: 'test-model',
  stopReason
})
const schema = z.object({ decision: z.enum(['included', 'excluded', 'uncertain']) })
afterEach(() => vi.restoreAllMocks())

describe('screening model recovery', () => {
  it('distinguishes a deadline from cancellation and retries with a fresh deadline', async () => {
    const expired = new AbortController()
    const timeout = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValueOnce(expired.signal)
      .mockReturnValueOnce(new AbortController().signal)
    const run = vi
      .fn<(input: RestrictedInferenceRunInput) => Promise<RestrictedInferenceResult>>(async () =>
        result()
      )
      .mockImplementationOnce(async () => {
        expired.abort(new DOMException('timeout', 'TimeoutError'))
        throw new Error('Restricted inference was cancelled.')
      })
    await expect(
      generateScreeningJson(
        createScreeningModel({ run }, target),
        schema,
        'screen',
        '{}',
        new AbortController().signal
      )
    ).resolves.toEqual({ decision: 'included' })
    expect(run).toHaveBeenCalledTimes(2)
    expect(timeout).toHaveBeenNthCalledWith(1, 300000)
    expect(run.mock.calls[1][0].signal?.aborted).toBe(false)
  })
  it('reports a persistent timeout accurately after the bounded retry', async () => {
    const expired = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(expired.signal)
    const run = vi.fn(async () => {
      expired.abort(new DOMException('timeout', 'TimeoutError'))
      throw new Error('Restricted inference was cancelled.')
    })
    await expect(
      generateScreeningJson(
        createScreeningModel({ run }, target),
        schema,
        'screen',
        '{}',
        new AbortController().signal
      )
    ).rejects.toThrow('The model request timed out.')
    expect(run).toHaveBeenCalledTimes(2)
  })
  it('never retries a user pause, even when the deadline also expires', async () => {
    const paused = new AbortController(),
      expired = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(expired.signal)
    const run = vi.fn(async () => {
      expired.abort(new DOMException('timeout', 'TimeoutError'))
      paused.abort(new Error('user paused'))
      throw new Error('Restricted inference was cancelled.')
    })
    await expect(
      generateScreeningJson(
        createScreeningModel({ run }, target),
        schema,
        'screen',
        '{}',
        paused.signal
      )
    ).rejects.toThrow('user paused')
    expect(run).toHaveBeenCalledOnce()
  })
  it.each(['cancelled', 'max_tokens'] as const)(
    'rejects partial data with stop reason %s and retries',
    async (stopReason) => {
      const run = vi.fn().mockResolvedValueOnce(result(stopReason)).mockResolvedValueOnce(result())
      await expect(
        generateScreeningJson(
          createScreeningModel({ run }, target),
          schema,
          'screen',
          '{}',
          new AbortController().signal
        )
      ).resolves.toEqual({ decision: 'included' })
      expect(run).toHaveBeenCalledTimes(2)
    }
  )
  it('does not retry model refusals', async () => {
    const run = vi.fn().mockResolvedValue(result('refusal'))
    await expect(
      generateScreeningJson(
        createScreeningModel({ run }, target),
        schema,
        'screen',
        '{}',
        new AbortController().signal
      )
    ).rejects.toThrow('The model declined this request.')
    expect(run).toHaveBeenCalledOnce()
  })
  it('validates fenced JSON without altering embedded evidence', async () => {
    const quote = '研究"人工智能"的影响\\路径\n下一行'
    const generate = vi.fn(async () => '```JSON\n' + JSON.stringify({ quote }) + '\n```')
    await expect(
      generateScreeningJson(
        { name: 'test', generate },
        z.object({ quote: z.string() }),
        '',
        '',
        new AbortController().signal
      )
    ).resolves.toEqual({ quote })
    expect(generate).toHaveBeenCalledOnce()
  })
})
