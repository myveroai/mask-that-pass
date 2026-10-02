# Mask That Pass

Mask That Pass is a Claude Code mod that masks credentials in tool output before Claude or your transcript sees them. When a command prints a database URL, a token or a private key, Claude reads `[redacted]` in its place and you get a short toast saying how many values were masked.

```text
$ cat .env
DATABASE_URL=postgresql://app:[redacted]@db.example.com:5432/app
GITHUB_TOKEN=[redacted]
TOKEN_BUDGET=4000
```

## What it masks

| Kind | Example (fake) | Becomes |
| --- | --- | --- |
| Password in a URL | `postgresql://app:hunter2@db/app` | `postgresql://app:[redacted]@db/app` |
| `*PASSWORD*`, `*SECRET*`, `*TOKEN*`, `*API_KEY*`, `*PRIVATE_KEY*`, `*ACCESS_KEY*` assignments (`=` or `:`) | `DB_PASSWORD=correct-horse` | `DB_PASSWORD=[redacted]` |
| JSON fields named `password`, `secret`, `client_secret`, `token`, `access_token`, `refresh_token`, `api_key`, `private_key` | `"client_secret": "abc123"` | `"client_secret": "[redacted]"` |
| Bearer tokens | `Bearer eyJhbGciOi...` | `Bearer [redacted]` |
| Well-known key shapes: Anthropic (`sk-ant-`), GitHub (`ghp_`, `gho_`, `github_pat_`), AWS (`AKIA`), Google (`AIza`), Slack (`xox?-`) | `ghp_...` | `gh_[redacted]` |
| PEM private key blocks | `-----BEGIN PRIVATE KEY----- ...` | the block collapsed to `[redacted]` |

A purely numeric value is left alone (`TOKEN_BUDGET=4000`, `MAX_TOKENS=8192`), as are names mentioned in prose.

## Where it masks

- **Bash**: the command's output is rewritten in the tool's own result, so both your screen and Claude see the masked text.
- **Every other tool** (Read, Grep, MCP tools, a Bash command that errored): the result is masked in what Claude reads and what the conversation transcript stores.

## How it works

Mask That Pass is two hooks in `hooks/register.ts`:

- **`tool.call`, Bash only**: it lets the command run as usual (it calls `next`), then returns that same result with `stdout` and `stderr` masked. It never skips a command or answers in its place; when nothing needs masking it returns the tool's result untouched.
- **`session.append`, tool-result rows only**: before a row holding tool results is stored, it masks the text inside each `tool_result` block, then passes the row on. It never appends a row of its own, and every other row (your prompts, Claude's replies) passes through unchanged.

## What it does not do

- It does not mask what you type, what Claude writes in its replies, or the files Claude writes.
- It does not change anything already in a conversation before you installed it.
- It matches patterns. A secret in an unusual format, such as a bare password with no label, can get through. Treat Mask That Pass as a safety net, not as a reason to keep secrets where Claude can read them.
- When Claude needs a real value to finish a task (for example, copying a key into a config file), it sees `[redacted]` and cannot do it. The toast tells you when that happened.

## What it can reach

Mask That Pass makes no network requests, reads and writes no files, starts no processes and calls no model. Its only call outside its own code is the toast. You can confirm that without running it:

```bash
claude plugin validate ./mask-that-pass
```

The `calls:` line lists `$.ui.toast` and nothing else.

## Install

Mask That Pass needs Claude Code 2.1.287 or later, the first version with mods.

```bash
claude plugin marketplace add myveroai/mask-that-pass
claude plugin install mask-that-pass@mask-that-pass
```

Run `/reload-plugins` in an open session, or start a new one. To try it for one session without installing, clone https://github.com/myveroai/mask-that-pass and run `claude --plugin-dir ./mask-that-pass`.

To turn it off, disable or uninstall it from the **Installed** tab in `/plugin`.

## Develop

```bash
claude plugin validate --strict .
claude plugin test
```

The rules are in `hooks/redact.ts` and the hooks in `hooks/register.ts`. Every value in the tests is fake.

## License

MIT
