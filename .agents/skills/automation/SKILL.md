---
name: automation
description: Skill for running automated tasks and scripts when clicked
---

# Automation Skill

## Overview
This skill provides clickable automation commands for common repository maintenance tasks. When executed, it runs predefined scripts to perform repository checks, audits, and maintenance operations.

## Available Commands

### 1. Repository Audit
Runs the full repository audit to check for issues, lockfile drift, and compliance.

**Usage:** Click to execute pnpm run audit:repo

**Implementation:** Executes scripts/auto-detect.js which runs the repository audit.

### 2. Commit Message Validation
Validates commit message subjects against conventional commit standards.

**Usage:** Pass a commit message file path to validate

**Implementation:** Uses scripts/check-commit-message.mjs to validate commit subjects.

### 3. Lockfile Check
Checks for lockfile drift and discrepancies.

**Usage:** Click to execute pnpm run lockfile:check

**Implementation:** Runs the lockfile checking script.

### 4. Staged Changes Check
Validates staged changes follow project conventions.

**Usage:** Integration with git hooks via husky

**Implementation:** Uses existing husky hooks in .husky/ directory.

## How to Use

1. **Select a command** from the available options above
2. **Click to execute** - the skill will run the corresponding script
3. **Review results** - output will be displayed in the console/logs

## Integration

This skill can be invoked through:
- Codex CLI direct execution
- Custom UI buttons triggered via the skill system
- Programmatic calls to the underlying scripts

The skill is designed to be minimal and focused, providing ready-to-use automation without requiring users to remember complex commands.
