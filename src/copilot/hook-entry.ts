import { runPromptHook } from './hook.ts'

// Config-file hooks run outside the SDK extension handshake. Failure always leaves the prompt intact.
const deadline = setTimeout(() => { process.stdout.write('{}'); process.exit(0) }, 4500)
try {
  let text = ''
  for await (const chunk of process.stdin) {
    text += chunk.toString()
    if (text.length > 2_500_000) throw new Error('Hook input too large')
  }
  const result = await runPromptHook(JSON.parse(text))
  clearTimeout(deadline)
  process.stdout.write(JSON.stringify(result))
} catch {
  clearTimeout(deadline)
  process.stdout.write('{}')
}
