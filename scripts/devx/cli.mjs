#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { compileRepoContext, createChangePlan, runDoctor } from './lib.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const [command = 'help', ...args] = process.argv.slice(2)
const option = (name, fallback) => args.find((arg) => arg.startsWith('--' + name + '='))?.slice(name.length + 3) ?? fallback
const has = (name) => args.includes('--' + name)

function run(commandName, parameters) {
  return spawnSync(commandName, parameters, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' })
}

async function doctor() {
  const version = run(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['--version'])
  const report = await runDoctor({ root, pnpmVersion: version.status === 0 ? version.stdout.trim() : null })
  if (has('json')) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log([
      'MOONWITNESS Developer Environment Doctor',
      'Node: ' + report.nodeVersion + ' | pnpm: ' + (report.pnpmVersion ?? 'not found') + ' | packages: ' + report.packageCount,
      '',
      ...report.findings.map((item) => item.status.toUpperCase().padEnd(5) + ' ' + item.id + ': ' + item.message + (item.status === 'fail' || item.status === 'warn' ? '\n      Fix: ' + item.fix : '')),
      '',
      'Summary: ' + report.counts.pass + ' pass, ' + report.counts.warn + ' warn, ' + report.counts.fail + ' fail',
    ].join('\n'))
  }
  if (!report.ok) process.exitCode = 1
}

async function plan() {
  const base = option('base', 'main')
  const commands = [
    ['diff', '--name-only', '--diff-filter=ACMR', base + '...HEAD'],
    ['diff', '--name-only'],
    ['diff', '--cached', '--name-only'],
    ['ls-files', '--others', '--exclude-standard'],
  ]
  const changedFiles = []
  for (const parameters of commands) {
    const result = run('git', parameters)
    if (result.status === 0) changedFiles.push(...result.stdout.split(/\r?\n/).filter(Boolean))
    else if (parameters[0] === 'diff' && parameters[3]?.includes('...')) {
      console.error("Unable to compare against '" + base + "'. Check that the ref exists or pass --base=<ref>.")
      process.exitCode = 2
      return
    }
  }
  const result = await createChangePlan({ root, changedFiles })
  if (has('json')) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log([
      'Change-aware plan (base: ' + base + ')',
      'Changed files: ' + result.changedFiles.length,
      'Direct packages: ' + (result.directPackages.join(', ') || 'none'),
      'Impacted packages: ' + (result.impactedPackages.join(', ') || 'none'),
      '',
      ...result.tasks.map((task) => '- ' + task.command + '\n  because: ' + task.reason.join('; ')),
      ...result.notes,
      '',
      'Review this plan before running commands. It is advisory and does not execute tasks.',
    ].join('\n'))
  }
}

async function context() {
  const maxChars = Math.max(1000, Number(option('max-chars', '12000')) || 12000)
  const format = has('json') ? 'json' : 'markdown'
  const result = await compileRepoContext({ root, maxChars, format })
  console.log(result.content)
  if (result.truncated) console.error('Context truncated; fingerprint ' + result.fingerprint)
}

function help() {
  console.log([
    'MOONWITNESS DX',
    '',
    'Commands:',
    '  pnpm devx doctor [--json]              Diagnose local toolchain and workspace readiness',
    '  pnpm devx plan [--base=main] [--json]   Plan checks for changed and dependent packages',
    '  pnpm devx context [--json] [--max-chars=12000]',
    '                                         Compile safe, bounded repository context for coding agents',
    '',
    'Planning commands never install packages, modify files, or execute suggested checks.',
  ].join('\n'))
}

if (command === 'doctor') await doctor()
else if (command === 'plan') await plan()
else if (command === 'context') await context()
else help()
