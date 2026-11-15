// Fake the project-owned Copilot service; tests never call a model endpoint or subscription.
import { afterEach, mockHost } from '#testing'
import type { PlatformOperations } from './host.ts'

export type RewriteInput = PlatformOperations['copilot.rewrite']['input']
type Rewrite = (input: RewriteInput, options: { signal?: AbortSignal }) => string | Promise<string>
let rewrite: Rewrite = () => 'ok'
export function setRewrite(handler: Rewrite): void { rewrite = handler }
afterEach(() => { rewrite = () => 'ok' })

export function mockModelHost(options: Parameters<typeof mockHost>[0] = {}) {
  return mockHost({ ...options, results: {
    'copilot.rewrite': async (input: RewriteInput, requestOptions: { signal?: AbortSignal } = {}) => ({ text: await rewrite(input, requestOptions) }),
    ...options.results
  } })
}
