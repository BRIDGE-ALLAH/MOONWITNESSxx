---
name: automation-plugin
description: Codex plugin for running automated repository maintenance tasks
---

# Automation Plugin for Codex

## Overview
This plugin provides clickable automation commands for common repository maintenance tasks in the RIOTWORKS project. When executed through the Codex UI, it runs predefined scripts to perform checks and maintenance operations.

## Available Commands

### 1. Audit Repository
- **Name:** audit-repo
- **Description:** Run full repository audit to check for issues, lockfile drift, and compliance
- **Command:** pnpm run audit:repo
- **Category:** Maintenance

### 2. Validate Commit Message
- **Name:** validate-commit
- **Description:** Validate commit message subjects against conventional commit standards
- **Command:** pnpm run check:commit -- {filepath}
- **Category:** Validation

### 3. Check Lockfile
- **Name:** check-lockfile
- **Description:** Check for lockfile drift and discrepancies
- **Command:** pnpm run lockfile:check
- **Category:** Maintenance

### 4. Check Staged Changes
- **Name:** check-staged
- **Description:** Validate staged changes follow project conventions
- **Command:** pnpm run check:staged
- **Category:** Validation

## How to Use

1. **Open Codex UI** and navigate to the Plugins section
2. **Select "Automation"** from the available plugins
3. **Click a command** to execute it automatically
4. **Review results** in the console/output panel

## Integration

This plugin integrates with:
- Codex CLI for direct execution
- Custom UI buttons in the Codex sidebar
- The project's existing scripts in scripts/
- The skill system at .agents\skills\automation\

The plugin is designed to be minimal and focused, providing ready-to-use automation without requiring users to remember complex commands.
