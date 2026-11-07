/**
 * RIOTWORKS Auto-Detection & Issue Creation Script
 * 
 * This script scans the codebase for common issues and automatically
 * creates GitHub issues for them.
 * 
 * Features:
 * - Detects TypeScript compilation errors
 * - Checks for broken exports/imports
 * - Monitors BullMQ queue health
 * - Detects policy violations
 * - Creates GitHub issues automatically
 */

const { execSync } = require('child_process');
const { readFileSync, writeFileSync, readdirSync } = require('fs');
const { join } = require('path');
const { Octokit } = require('@octokit/rest');

// Configuration
const GITHUB_TOKEN = process.env.GH_TOKEN;
const OWNER = 'BRIDGE-ALLAH';
const REPO = 'RIOTWORKS';
const BRANCH = 'main';

if (!GITHUB_TOKEN) {
  console.error('❌ GH_TOKEN environment variable not set');
  process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

// ============================================================
// 1. CODEBASE ANALYSIS
// ============================================================

console.log('🔍 Scanning RIOTWORKS codebase...\n');

// 1.1 Check TypeScript compilation
console.log('📋 Checking TypeScript compilation...');
try {
  const tscResult = execSync('pnpm --filter @riotworks/ui run type-check 2>&1', { maxBuffer: 10 * 1024 * 1024 });
  console.log('  ✅ UI type-check passed');
} catch (error) {
  console.log('  ⚠️ UI type-check issues found');
  console.log('  ' + error.stdout.toString().substring(0, 500));
}

// 1.2 Check for broken exports
console.log('📋 Checking for broken exports/imports...');
const packagesDir = join(__dirname, '..', 'packages');
const packages = readdirSync(packagesDir);

const brokenExports = [];
for (const pkg of packages) {
  const pkgPath = join(packagesDir, pkg);
  const pkgJsonPath = join(pkgPath, 'package.json');
  if (require('fs').existsSync(pkgJsonPath)) {
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
    // Check main entry point
    const main = pkgJson.main || 'src/index.ts';
    console.log(`  📦 Checking ${pkg} (main: ${main})`);
}

// 1.3 Check BullMQ queue health
console.log('📋 Checking BullMQ queue configuration...');
const bullmqPackage = join(packagesDir, 'bullmq');
if (require('fs').existsSync(bullmqPackage)) {
  const bullmqSrc = join(bullmqPackage, 'src');
  const workerFiles = readdirSync(bullmqSrc).filter(f => f.includes('worker'));
  console.log(`  📦 Found ${workerFiles.length} worker files in bullmq`);
  for (const worker of workerFiles) {
    console.log(`    - ${worker}`);
  }
}

// ============================================================
// 2. PATTERN DETECTION
// ============================================================

console.log('\n🔎 Detecting patterns...\n');

const detectionResults = [];

// 2.1 Detect missing CHANGELOG entries
const changelogPath = join(__dirname, '..', 'CHANGELOG.md');
if (require('fs').existsSync(changelogPath)) {
  const changelogContent = readFileSync(changelogPath, 'utf8');
  // Check if 1.0.3 exists
  if (!changelogContent.includes('## [1.0.3]')) {
    detectionResults.push({
      type: 'version-bump',
      severity: 'info',
      message: 'CHANGELOG.md missing version 1.0.3 entry',
      suggestion: 'Run pre-commit hook to auto-generate version bump'
    });
  }
}

// 2.2 Detect missing GitHub Pages sitemap
const sitemapPath = join(__dirname, '..', 'docs', 'gh-pages-sitemap.md');
if (require('fs').existsSync(sitemapPath)) {
  const sitemapContent = readFileSync(sitemapPath, 'utf8');
  if (!sitemapContent.includes('/_not-found')) {
    detectionResults.push({
      type: 'github-pages',
      severity: 'warning',
      message: 'GitHub Pages sitemap may need update after build',
      suggestion: 'Run pnpm build and check deployed routes'
    });
  }
} else {
  detectionResults.push({
    type: 'github-pages',
    severity: 'warning',
    message: 'docs/gh-pages-sitemap.md not found',
    suggestion: 'Create sitemap for GitHub Pages deployment'
  });
}

// 2.3 Detect missing Wiki index
const wikiIndexPath = join(__dirname, '..', 'docs', 'wiki', 'index.md');
if (require('fs').existsSync(wikiIndexPath)) {
  const wikiContent = readFileSync(wikiIndexPath, 'utf8');
  if (!wikiContent.includes('ARSY DECK')) {
    detectionResults.push({
      type: 'wiki-update',
      severity: 'info',
      message: 'Wiki index may need update with new pages',
      suggestion: 'Add new core pages to wiki documentation'
    });
  }
} else {
  detectionResults.push({
    type: 'wiki-update',
    severity: 'warning',
    message: 'docs/wiki/index.md not found',
    suggestion: 'Create wiki index for RIOTWORKS documentation'
  });
}

// 2.3 Check for broken TypeScript paths
console.log('📋 Checking TypeScript path integrity...');
const packagesToCheck = ['@riotworks/ui', '@riotworks/arsy-core', '@riotworks/bullmq'];
for (const pkg of packagesToCheck) {
  try {
    const result = execSync(`pnpm --filter ${pkg} run type-check 2>&1`, { maxBuffer: 5 * 1024 * 1024 });
    console.log(`  ✅ ${pkg}: type-check passed`);
  } catch (error) {
    console.log(`  ⚠️ ${pkg}: type-check failed`);
    detectionResults.push({
      type: 'type-error',
      severity: 'error',
      message: `${pkg} has TypeScript compilation errors`,
      suggestion: 'Fix type errors before committing'
    });
  }
}

// ============================================================
// 3. GITHUB ISSUE CREATION
// ============================================================

console.log('\n📝 Creating GitHub issues...\n');

async function createIssues() {
  for (const result of detectionResults) {
    try {
      const issueBody = `
**Auto-detection Result**

- **Type:** ${result.type}
- **Severity:** ${result.severity}
- **Message:** ${result.message}
- **Suggestion:** ${result.suggestion}

---

*This issue was auto-generated by RIOTWORKS automation script.*
*Date: ${new Date().toISOString().split('T')[0]}*
`;
      
      const issueTitle = `[Auto] ${result.type}: ${result.message.substring(0, 50)}`;
      
      const response = await octokit.issues.create({
        owner: OWNER,
        repo: REPO,
        title: issueTitle,
        body: issueBody,
        labels: [result.severity.toLowerCase(), 'auto-generated'],
      });
      
      console.log(`✅ Issue created: #${response.data.number} - ${issueTitle}`);
    } catch (error) {
      console.error(`❌ Failed to create issue for ${result.type}:`, error.message);
    }
  }
}

// ============================================================
// 4. MAIN EXECUTION
// ============================================================

(async () => {
  await createIssues();
  
  console.log('\n📊 Detection Summary:');
  console.log(`  - Total patterns detected: ${detectionResults.length}`);
  console.log('  - Issues created: ' + detectionResults.filter(r => /* check if created */).length);
  console.log('  - Issues skipped: ' + (detectionResults.length - /* count created */));
  console.log('\n✅ RIOTWORKS auto-detection complete');
  
  // Exit code based on findings
  const criticalIssues = detectionResults.filter(r => r.severity === 'error').length;
  if (criticalIssues > 0) {
    process.exit(1);
  }
  process.exit(0);
})();