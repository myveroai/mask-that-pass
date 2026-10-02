import { expect, test } from 'claude-code/testing'

import { redact, redactToolResults } from '../hooks/redact.ts'

// Every value below is fake.
const SECRETS: [string, string][] = [
  ['postgresql://app:hunter2hunter2@db.example.com:5432/app', 'postgresql://app:[redacted]@db.example.com:5432/app'],
  ['GITHUB_TOKEN=ghp_FAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE1234', 'GITHUB_TOKEN=[redacted]'],
  ['export ANTHROPIC_API_KEY="sk-ant-api03-FAKEFAKEFAKEFAKEFAKEFAKE"', 'export ANTHROPIC_API_KEY="[redacted]"'],
  ['DB_PASSWORD: correct-horse-battery', 'DB_PASSWORD: [redacted]'],
  ['{"client_secret": "fake-client-secret-123"}', '{"client_secret": "[redacted]"}'],
  ['Authorization: Bearer fake.jwt.payloadpayloadpayload', 'Authorization: Bearer [redacted]'],
  ['token ghp_FAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE1234 used', 'token gh_[redacted] used'],
  ['key AKIAFAKEFAKEFAKE1234 here', 'key AKIA[redacted] here'],
  ['slack xoxb-0000000000-fakefakefake', 'slack xox-[redacted]'],
]

const LOOKALIKES = [
  'TOKEN_BUDGET=4000',
  'input_tokens: 1234, statement_timeout=10s',
  'https://github.com/example/repo/pull/541',
  'ssh deploy-host "cat /srv/app/REVISION.json"',
  'set the API key in the GITHUB_TOKEN variable',
  'MAX_TOKENS=8192',
]

test('masks each kind of credential and keeps the text around it', () => {
  for (const [input, masked] of SECRETS) {
    const out = redact(input)
    expect(out.text).toBe(masked)
    expect(out.count).toBe(1)
  }
})

test('masks a PEM private key block whole', () => {
  const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIEfakefakefake\nfakefake==\n-----END RSA PRIVATE KEY-----'
  const out = redact(`key:\n${pem}\ndone`)
  expect(out.text).toBe('key:\n-----BEGIN RSA PRIVATE KEY----- [redacted] -----END RSA PRIVATE KEY-----\ndone')
  expect(out.count).toBe(1)
})

test('leaves settings, counts, URLs and prose alone', () => {
  for (const text of LOOKALIKES) {
    const out = redact(text)
    expect(out.text).toBe(text)
    expect(out.count).toBe(0)
  }
})

test('counts every secret in a multi-line output', () => {
  const out = redact('A_TOKEN=abcd1234\nB_SECRET=efgh5678\nplain line')
  expect(out.count).toBe(2)
  expect(out.text).toBe('A_TOKEN=[redacted]\nB_SECRET=[redacted]\nplain line')
})

test("masks text inside tool_result blocks, as string or text parts, and nothing else", () => {
  const leaky = 'url postgresql://app:hunter2hunter2@db.example.com/app'
  const masked = 'url postgresql://app:[redacted]@db.example.com/app'
  const out = redactToolResults([
    { type: 'text', text: leaky },
    { type: 'tool_result', tool_use_id: 'a', content: leaky },
    { type: 'tool_result', tool_use_id: 'b', content: [{ type: 'text', text: leaky }, { type: 'image', source: {} }] },
    { type: 'tool_result', tool_use_id: 'c', content: 'nothing secret' },
    { type: 'search_result', source: 'x', title: 't', content: [{ type: 'text', text: leaky }] },
  ])
  expect(out.count).toBe(2)
  expect(out.content).toEqual([
    { type: 'text', text: leaky },
    { type: 'tool_result', tool_use_id: 'a', content: masked },
    { type: 'tool_result', tool_use_id: 'b', content: [{ type: 'text', text: masked }, { type: 'image', source: {} }] },
    { type: 'tool_result', tool_use_id: 'c', content: 'nothing secret' },
    // Only tool_result content may be rewritten in a stored row; every other block is pinned.
    { type: 'search_result', source: 'x', title: 't', content: [{ type: 'text', text: leaky }] },
  ])
})
