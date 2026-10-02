import type { Register } from 'claude-code'

import { redact, redactToolResults } from './redact.ts'

function plural(n: number): string {
  return `${n} secret${n === 1 ? '' : 's'}`
}

export const register: Register = on => {
  // Bash: mask the tool's own record, so the screen and the model both see the masked text.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError === true || !ran.result) return ran
    const stdout = redact(ran.result.stdout ?? '')
    const stderr = redact(ran.result.stderr ?? '')
    const count = stdout.count + stderr.count
    if (count === 0) return ran
    $.ui.toast(`blackbar: masked ${plural(count)} in Bash output`)
    return {
      result: { ...ran.result, stdout: stdout.text, stderr: stderr.text },
      ...(ran.context ? { context: ran.context } : {}),
    }
  })

  // Every other tool's result (Read, Grep, MCP tools, a Bash error): mask what the model reads
  // and what the transcript stores.
  on('session.append', async ($, e, next) => {
    if (e.door !== 'tool-result') return next(e)
    const masked = redactToolResults(e.message.content)
    if (masked.count === 0) return next(e)
    $.ui.toast(`blackbar: masked ${plural(masked.count)} in a tool result`)
    return next({ ...e, message: { ...e.message, content: masked.content } })
  })
}
