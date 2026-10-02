import { expect, test } from 'claude-code/testing'

// Every value below is fake.
const LEAKY = 'DATABASE_URL=postgresql://app:hunter2hunter2@db.example.com/app\nok'
const MASKED = 'DATABASE_URL=postgresql://app:[redacted]@db.example.com/app\nok'

test('Bash output is masked in the result the screen and Claude get', async ($, on) => {
  const toasts: string[] = []
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('tool.call', () => ({ result: { stdout: LEAKY, stderr: '', interrupted: false } }))

  const out = await $.tool.call({ tool: 'Bash', command: 'cat .env' })

  expect(out).toMatchObject({ result: { stdout: MASKED, stderr: '' } })
  expect(toasts).toEqual(['blackbar: masked 1 secret in Bash output'])
})

test('Bash output with nothing secret passes through untouched, without a toast', async ($, on) => {
  const toasts: string[] = []
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('tool.call', () => ({ result: { stdout: 'hello\n', stderr: '', interrupted: false } }))

  const out = await $.tool.call({ tool: 'Bash', command: 'echo hello' })

  expect(out).toMatchObject({ result: { stdout: 'hello\n' } })
  expect(toasts).toEqual([])
})
