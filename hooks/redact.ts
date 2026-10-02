// Credentials masked in tool output. Each rule keeps enough context to read the line
// (the variable name, the URL's user and host) and replaces only the secret itself.

type Rule = { pattern: RegExp; replace: (match: string, ...groups: string[]) => string }

const MASK = '[redacted]'

const RULES: readonly Rule[] = [
  // PEM private keys (service-account JSON embeds these too).
  {
    pattern: /-----BEGIN ([A-Z ]*)PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replace: (_m, kind) => `-----BEGIN ${kind}PRIVATE KEY----- ${MASK} -----END ${kind}PRIVATE KEY-----`,
  },
  // Passwords in URLs: scheme://user:password@host keeps the scheme, user and host
  {
    pattern: /\b([a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:)[^\s@/]+@/gi,
    replace: (_m, head) => `${head}${MASK}@`,
  },
  // Environment-style assignments: DB_PASSWORD=..., GITHUB_TOKEN: ..., FOO_API_KEY="..."
  // A purely numeric value (TOKEN_BUDGET=4000) is a setting, not a secret.
  {
    pattern: /\b([A-Z0-9_]*(?:PASSWORD|PASSWD|SECRET|TOKEN|API_KEY|APIKEY|PRIVATE_KEY|ACCESS_KEY)[A-Z0-9_]*\s*[=:]\s*)(["']?)([^\s"']{4,})/g,
    replace: (m, head, quote, value) => (/^\d+$/.test(value) ? m : `${head}${quote}${MASK}`),
  },
  // JSON fields: "password": "...", "client_secret": "...", "refresh_token": "..."
  {
    pattern: /("(?:password|passwd|secret|client_secret|token|access_token|refresh_token|api_key|apikey|private_key)"\s*:\s*")([^"]{4,})"/gi,
    replace: (_m, head) => `${head}${MASK}"`,
  },
  { pattern: /\b(Bearer\s+)[A-Za-z0-9._~+/-]{16,}=*/g, replace: (_m, head) => `${head}${MASK}` },
  { pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}/g, replace: () => `sk-ant-${MASK}` },
  { pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}/g, replace: () => `gh_${MASK}` },
  { pattern: /\bgithub_pat_[A-Za-z0-9_]{30,}/g, replace: () => `github_pat_${MASK}` },
  { pattern: /\bAKIA[0-9A-Z]{16}\b/g, replace: () => `AKIA${MASK}` },
  { pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g, replace: () => `AIza${MASK}` },
  { pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g, replace: () => `xox-${MASK}` },
]

/** The text with every credential masked, and how many were. */
export function redact(text: string): { text: string; count: number } {
  let count = 0
  let out = text
  for (const { pattern, replace } of RULES) {
    out = out.replace(pattern, (match: string, ...rest: unknown[]) => {
      const groups = rest.slice(0, -2).map(g => (typeof g === 'string' ? g : ''))
      const replaced = replace(match, ...groups)
      if (replaced !== match) count += 1
      return replaced
    })
  }
  return { text: out, count }
}

type Block = { type: string; [field: string]: unknown }

/** A conversation row's content blocks with every tool_result's text masked, and how many were. */
export function redactToolResults<B extends { type: string }>(content: readonly B[]): { content: B[]; count: number } {
  let count = 0
  const out = content.map(block => {
    if (block.type !== 'tool_result') return block
    const b = block as unknown as Block
    if (typeof b.content === 'string') {
      const masked = redact(b.content)
      count += masked.count
      return (masked.count ? { ...b, content: masked.text } : block) as B
    }
    if (!Array.isArray(b.content)) return block
    let changed = false
    const parts = b.content.map((part: unknown) => {
      const p = part as Block
      if (p?.type !== 'text' || typeof p.text !== 'string') return part
      const masked = redact(p.text)
      if (!masked.count) return part
      count += masked.count
      changed = true
      return { ...p, text: masked.text }
    })
    return (changed ? { ...b, content: parts } : block) as B
  })
  return { content: out, count }
}
