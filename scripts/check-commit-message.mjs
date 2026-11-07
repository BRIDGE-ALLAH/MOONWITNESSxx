import { readFileSync } from 'node:fs'

const conventionalCommitPattern =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9][a-z0-9._/-]*\))?!?: .+$/i

export function isValidCommitSubject(subject) {
  return subject.length <= 72 && conventionalCommitPattern.test(subject)
}

const messagePath = process.argv[2]

if (messagePath) {
  const message = readFileSync(messagePath, 'utf8')
  const subject = message.split(/\r?\n/, 1)[0].trim()

  if (!isValidCommitSubject(subject)) {
    console.error(
      [
        'Invalid commit subject.',
        'Use: type(scope): imperative summary (maximum 72 characters).',
        'Examples: feat(arsy): add readiness endpoint',
        '          fix(headquarter): correct locale redirect',
        '          chore(ci): pin action versions'
      ].join('\n')
    )
    process.exitCode = 1
  }
}
