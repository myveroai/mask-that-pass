import { expect, test } from 'claude-code/testing'

import { redact } from '../hooks/redact.ts'

// The key below is fake: a PEM frame around filler text.
test('masks a PEM private key block whole', () => {
  const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIEfakefakefake\nfakefake==\n-----END RSA PRIVATE KEY-----'
  const out = redact(`key:\n${pem}\ndone`)
  expect(out.text).toBe('key:\n-----BEGIN RSA PRIVATE KEY----- [redacted] -----END RSA PRIVATE KEY-----\ndone')
  expect(out.count).toBe(1)
})
