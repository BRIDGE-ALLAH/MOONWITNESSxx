/**
 * RIOTWORKS Kilo Gateway AI Integration
 * 
 * This script uses Kilo Gateway AI (free tier) to generate:
 * 1. Commit messages based on staged changes
 * 2. Changelog entries based on version bump
 * 
 * Kilo Gateway AI Endpoint: https://api.kilo.ai/v1/chat/completions
 * Model: kilo-free (free tier)
 */

const { execSync } = require('child_process');
const { readFileSync, writeFileSync, existsSync } = require('fs');
const { join } = require('path');

// Configuration
const KILO_API_URL = process.env.KILO_API_URL || 'https://api.kilo.ai/v1/chat/completions';
const KILO_API_KEY = process.env.KILO_API_KEY || '';
const KILO_MODEL = process.env.KILO_MODEL || 'kilo-free';
const MAX_TOKENS = parseInt(process.env.KILO_MAX_TOKENS || '500');
const TEMPERATURE = parseFloat(process.env.KILO_TEMPERATURE || '0.3');

if (!KILO_API_KEY) {
  console.warn('⚠️ KILO_API_KEY not set - using fallback templates');
}

// ============================================================
// 1. GET STAGED CHANGES
// ============================================================

function getStagedChanges() {
  try {
    const diff = execSync('git diff --cached --stat', { encoding: 'utf8' });
    const files = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    return { diff, files };
  } catch (error) {
    console.error('❌ Failed to get staged changes:', error.message);
    return { diff: '', files: [] };
  }
}

// ============================================================
// 2. CALL KILO GATEWAY AI
// ============================================================

async function callKiloAI(systemPrompt, userPrompt) {
  if (!KILO_API_KEY) {
    return null; // Fallback to templates
  }

  try {
    const response = await fetch(KILO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KILO_API_KEY}`,
      },
      body: JSON.stringify({
        model: KILO_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
      }),
    });

    if (!response.ok) {
      console.warn(`⚠️ Kilo AI API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.warn(`⚠️ Kilo AI request failed: ${error.message}`);
    return null;
  }
}

// ============================================================
// 3. GENERATE COMMIT MESSAGE WITH AI
// ============================================================

async function generateCommitMessage(stagedFiles, diffStat) {
  const systemPrompt = `You are a RIOTWORKS monorepo commit message generator.
Generate conventional commit messages following this format:
<type>: <description>

Types: feat, fix, docs, style, refactor, test, chore, perf, ci, build, revert

Rules:
- Max 72 characters for subject line
- Use imperative mood ("add" not "adds")
- No period at end
- Be specific about what changed
- Reference RIOTWORKS packages when relevant (ui, arsy-core, bullmq, headquarter, arsy, etc.)`;

  const userPrompt = `Generate a commit message for these staged changes:

Files changed:
${stagedFiles.join('\n')}

Diff stat:
${diffStat}

Output ONLY the commit message, no explanations.`;

  const aiMessage = await callKiloAI(systemPrompt, userPrompt);
  
  if (aiMessage) {
    console.log('🤖 AI-generated commit message:', aiMessage);
    return aiMessage;
  }

  // Fallback template
  const hasFeat = stagedFiles.some(f => f.includes('feat') || f.includes('feature'));
  const hasFix = stagedFiles.some(f => f.includes('fix') || f.includes('bug'));
  const hasDocs = stagedFiles.some(f => f.includes('doc') || f.includes('readme'));
  const hasChore = stagedFiles.some(f => f.includes('chore') || f.includes('config') || f.includes('husky') || f.includes('workflow'));
  
  let type = 'chore';
  if (hasFeat) type = 'feat';
  else if (hasFix) type = 'fix';
  else if (hasDocs) type = 'docs';
  
  const fileSummary = stagedFiles.length > 3 
    ? `${stagedFiles.length} files across packages`
    : stagedFiles.join(', ');
  
  return `${type}: update ${fileSummary}`;
}

// ============================================================
// 4. GENERATE CHANGELOG ENTRY WITH AI
// ============================================================

async function generateChangelogEntry(version, date, stagedFiles, diffStat) {
  const systemPrompt = `You are a RIOTWORKS changelog generator.
Generate changelog entries following Keep a Changelog format.

Categories:
### Added - new features
### Changed - changes to existing functionality
### Deprecated - soon-to-be removed features
### Removed - removed features
### Fixed - bug fixes
### Security - security vulnerabilities

Rules:
- Be concise but descriptive
- Reference package names when relevant
- Use bullet points
- No markdown headers other than the category headers`;

  const userPrompt = `Generate a changelog entry for version ${version} (${date}):

Files changed:
${stagedFiles.join('\n')}

Diff stat:
${diffStat}

Output ONLY the changelog entry content, no explanations.`;

  const aiEntry = await callKiloAI(systemPrompt, userPrompt);
  
  if (aiEntry) {
    console.log('🤖 AI-generated changelog entry:', aiEntry.substring(0, 100) + '...');
    return aiEntry;
  }

  // Fallback template
  const type = stagedFiles.some(f => f.includes('feat') || f.includes('feature')) ? 'Added' : 'Changed';
  const fileCount = stagedFiles.length;
  
  return `### ${type}\n- Updated ${fileCount} file(s) across RIOTWORKS packages\n\n### Changed\n- Version bumped to ${version}\n`;
}

// ============================================================
// 5. MAIN EXECUTION
// ============================================================

(async () => {
  const { diff, files } = getStagedChanges();
  
  if (files.length === 0) {
    console.log('ℹ️ No staged changes detected');
    process.exit(0);
  }

  console.log(`📋 Detected ${files.length} staged file(s)`);
  console.log('🤖 Generating AI commit message and changelog...\n');

  // Generate commit message
  const commitMessage = await generateCommitMessage(files, diff);
  
  // Generate changelog entry
  const version = readFileSync(join(process.cwd(), 'package.json'), 'utf8')
    ? JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')).version
    : '1.0.0';
  const date = new Date().toISOString().split('T')[0];
  const changelogEntry = await generateChangelogEntry(version, date, files, diff);

  // Output results for husky to use
  console.log('\n=== AI GENERATED OUTPUT ===');
  console.log(`COMMIT_MESSAGE: ${commitMessage}`);
  console.log(`CHANGELOG_ENTRY: ${changelogEntry}`);
  console.log('=== END AI OUTPUT ===\n');

  // Write to temp files for husky to read
  writeFileSync(join(__dirname, '.ai-commit-message.txt'), commitMessage);
  writeFileSync(join(__dirname, '.ai-changelog-entry.txt'), changelogEntry);
  
  console.log('✅ AI generation complete');
})();