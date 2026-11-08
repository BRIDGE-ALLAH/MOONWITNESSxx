use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    process::{Command, Output},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::Manager;

static STORE_LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseRepository {
    pub path: String,
    pub name: String,
    pub remote_url: Option<String>,
    pub registered_at_ms: u128,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseStatus {
    pub path: String,
    pub name: String,
    pub branch: String,
    pub head_sha: String,
    pub clean: bool,
    pub latest_tag: Option<String>,
    pub remote_url: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseCommit {
    pub sha: String,
    pub short_sha: String,
    pub subject: String,
    pub author: String,
    pub committed_at: String,
    pub category: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleasePreview {
    pub status: ReleaseStatus,
    pub commits: Vec<ReleaseCommit>,
    pub suggested_changelog: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseDraft {
    pub id: String,
    pub repository_path: String,
    pub repository_name: String,
    pub tag: String,
    pub target_sha: String,
    pub notes: String,
    pub created_at_ms: u128,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseHistory {
    pub id: String,
    pub repository_path: String,
    pub repository_name: String,
    pub tag: String,
    pub commit_sha: String,
    pub notes: String,
    pub created_at_ms: u128,
    pub publication: String,
}

pub(super) fn now_ms() -> u128 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis()
}
pub(super) fn store_file(app: &tauri::AppHandle, name: &str) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("riot-release");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(name))
}
pub(super) fn read_store<T: DeserializeOwned + Default>(path: &Path) -> Result<T, String> {
    if !path.exists() { return Ok(T::default()); }
    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| format!("Invalid local release data: {e}"))
}
pub(super) fn write_store<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    let raw = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(path, format!("{raw}\n")).map_err(|e| e.to_string())
}
fn git_output(root: &Path, args: &[String]) -> Result<Output, String> {
    Command::new("git").arg("-C").arg(root).args(args).output()
        .map_err(|e| format!("Git CLI unavailable. Install Git and add it to PATH: {e}"))
}
fn git_args(root: &Path, args: &[String]) -> Result<String, String> {
    let out = git_output(root, args)?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}
fn git(root: &Path, args: &[&str]) -> Result<String, String> {
    git_args(root, &args.iter().map(|s| (*s).to_string()).collect::<Vec<_>>())
}
pub(super) fn resolve_root(input: &str) -> Result<PathBuf, String> {
    if input.trim().is_empty() { return Err("Select a repository folder.".into()); }
    let path = PathBuf::from(input.trim()).canonicalize().map_err(|e| e.to_string())?;
    if !path.is_dir() { return Err("Selected path is not a directory.".into()); }
    let root = git(&path, &["rev-parse", "--show-toplevel"])
        .map_err(|_| "Selected folder is not a Git working tree.".to_string())?;
    PathBuf::from(root).canonicalize().map_err(|e| e.to_string())
}
pub(super) fn repo_name(root: &Path) -> String {
    root.file_name().map(|v| v.to_string_lossy().to_string()).unwrap_or_else(|| "repository".into())
}
fn remote(root: &Path) -> Option<String> {
    git(root, &["remote", "get-url", "origin"]).ok().filter(|v| !v.is_empty())
}
fn latest_tag(root: &Path) -> Option<String> {
    git(root, &["describe", "--tags", "--abbrev=0"]).ok().filter(|v| !v.is_empty())
}
fn status(root: &Path) -> Result<ReleaseStatus, String> {
    let branch = git(root, &["symbolic-ref", "--quiet", "--short", "HEAD"])
        .unwrap_or_else(|_| "(detached HEAD)".into());
    let head_sha = git(root, &["rev-parse", "--verify", "HEAD"])?;
    let changes = git(root, &["status", "--porcelain", "--untracked-files=normal"])?;
    Ok(ReleaseStatus {
        path: root.to_string_lossy().to_string(), name: repo_name(root), branch, head_sha,
        clean: changes.is_empty(), latest_tag: latest_tag(root), remote_url: remote(root),
    })
}
fn valid_ids(value: &str, leading_zero_is_invalid: bool) -> bool {
    !value.is_empty() && value.split('.').all(|part| {
        !part.is_empty()
            && part.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
            && !(leading_zero_is_invalid && part.len() > 1
                && part.chars().all(|c| c.is_ascii_digit()) && part.starts_with('0'))
    })
}
fn normalize_tag(input: &str) -> Result<String, String> {
    let v = input.trim().strip_prefix('v').unwrap_or(input.trim());
    if v.is_empty() || v.len() > 120 { return Err("Enter a valid SemVer version.".into()); }
    let (no_build, build) = match v.split_once('+') {
        Some((left, right)) if !right.contains('+') => (left, Some(right)),
        Some(_) => return Err("Invalid SemVer build metadata.".into()),
        None => (v, None),
    };
    if let Some(b) = build { if !valid_ids(b, false) { return Err("Invalid build metadata.".into()); } }
    let (core, pre) = match no_build.split_once('-') {
        Some((left, right)) => (left, Some(right)),
        None => (no_build, None),
    };
    let parts: Vec<&str> = core.split('.').collect();
    if parts.len() != 3 || parts.iter().any(|p| p.is_empty()
        || !p.chars().all(|c| c.is_ascii_digit())
        || (p.len() > 1 && p.starts_with('0'))) {
        return Err("Version must be MAJOR.MINOR.PATCH.".into());
    }
    if let Some(p) = pre { if !valid_ids(p, true) { return Err("Invalid prerelease identifier.".into()); } }
    Ok(format!("v{v}"))
}
fn category(subject: &str) -> &'static str {
    let prefix = subject.split_once(':').map(|p| p.0).unwrap_or("");
    let kind = prefix.split('(').next().unwrap_or("").trim_end_matches('!').to_ascii_lowercase();
    match kind.as_str() {
        "feat" | "feature" => "Features",
        "fix" | "bugfix" => "Fixes",
        "perf" => "Performance",
        "docs" => "Documentation",
        "refactor" | "test" | "build" | "ci" | "chore" | "style" | "revert" => "Maintenance",
        _ => "Other",
    }
}
fn parse_commits(raw: &str) -> Vec<ReleaseCommit> {
    raw.lines().filter_map(|line| {
        let mut f = line.splitn(4, '\u{1f}');
        let sha = f.next()?.trim();
        let subject = f.next()?.trim();
        let author = f.next()?.trim();
        let committed_at = f.next()?.trim();
        if sha.is_empty() || subject.is_empty() { return None; }
        Some(ReleaseCommit {
            sha: sha.into(), short_sha: sha.chars().take(8).collect(),
            subject: subject.into(), author: author.into(), committed_at: committed_at.into(),
            category: category(subject).into(),
        })
    }).collect()
}
fn changelog(commits: &[ReleaseCommit]) -> String {
    let mut out = String::from("# Release notes\n");
    for section in ["Features", "Fixes", "Performance", "Documentation", "Maintenance", "Other"] {
        let entries: Vec<&ReleaseCommit> = commits.iter().filter(|c| c.category == section).collect();
        if entries.is_empty() { continue; }
        out.push_str(&format!("\n## {section}\n"));
        for c in entries { out.push_str(&format!("- {} ({})\n", c.subject, c.short_sha)); }
    }
    if commits.is_empty() { out.push_str("\nNo commits were found since the latest reachable tag.\n"); }
    out
}
fn preview(root: &Path) -> Result<ReleasePreview, String> {
    let current = status(root)?;
    let range = if let Some(tag) = current.latest_tag.as_ref() {
        let reference = format!("refs/tags/{tag}^{{commit}}");
        let base = git_args(root, &["rev-parse".into(), "--verify".into(), reference])?;
        format!("{base}..HEAD")
    } else { "HEAD".into() };
    let raw = git_args(root, &[
        "log".into(), "--no-merges".into(), "--max-count=100".into(),
        "--format=%H%x1f%s%x1f%an%x1f%aI".into(), range,
    ])?;
    let commits = parse_commits(&raw);
    Ok(ReleasePreview { status: current, suggested_changelog: changelog(&commits), commits })
}

#[tauri::command]
pub fn riot_release_add_repository(app: tauri::AppHandle, path: String) -> Result<ReleaseRepository, String> {
    let root = resolve_root(&path)?;
    let item = ReleaseRepository {
        path: root.to_string_lossy().to_string(), name: repo_name(&root),
        remote_url: remote(&root), registered_at_ms: now_ms(),
    };
    let _guard = STORE_LOCK.lock().map_err(|_| "Release store is busy.".to_string())?;
    let file = store_file(&app, "repositories.json")?;
    let mut items: Vec<ReleaseRepository> = read_store(&file)?;
    if !items.iter().any(|v| v.path == item.path) { items.push(item.clone()); write_store(&file, &items)?; }
    Ok(item)
}
#[tauri::command]
pub fn riot_release_list_repositories(app: tauri::AppHandle) -> Result<Vec<ReleaseRepository>, String> {
    let _guard = STORE_LOCK.lock().map_err(|_| "Release store is busy.".to_string())?;
    read_store(&store_file(&app, "repositories.json")?)
}
#[tauri::command]
pub fn riot_release_remove_repository(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let target = PathBuf::from(&path).canonicalize().map(|p| p.to_string_lossy().to_string()).unwrap_or(path);
    let _guard = STORE_LOCK.lock().map_err(|_| "Release store is busy.".to_string())?;
    let file = store_file(&app, "repositories.json")?;
    let mut items: Vec<ReleaseRepository> = read_store(&file)?;
    items.retain(|v| v.path != target);
    write_store(&file, &items)
}
#[tauri::command]
pub fn riot_release_get_preview(path: String) -> Result<ReleasePreview, String> {
    preview(&resolve_root(&path)?)
}
#[tauri::command]
pub fn riot_release_save_draft(app: tauri::AppHandle, path: String, version: String, notes: String) -> Result<ReleaseDraft, String> {
    let root = resolve_root(&path)?;
    let tag = normalize_tag(&version)?;
    if notes.trim().is_empty() || notes.len() > 131072 { return Err("Release notes must contain text and stay below 128 KiB.".into()); }
    let draft = ReleaseDraft {
        id: format!("{}-{tag}", now_ms()), repository_path: root.to_string_lossy().to_string(),
        repository_name: repo_name(&root), tag, target_sha: git(&root, &["rev-parse", "--verify", "HEAD"])?,
        notes, created_at_ms: now_ms(),
    };
    let _guard = STORE_LOCK.lock().map_err(|_| "Release store is busy.".to_string())?;
    let file = store_file(&app, "drafts.json")?;
    let mut items: Vec<ReleaseDraft> = read_store(&file)?;
    items.push(draft.clone());
    write_store(&file, &items)?;
    Ok(draft)
}
#[tauri::command]
pub fn riot_release_list_drafts(app: tauri::AppHandle, path: Option<String>) -> Result<Vec<ReleaseDraft>, String> {
    let target = path.map(|v| PathBuf::from(&v).canonicalize().map(|p| p.to_string_lossy().to_string()).unwrap_or(v));
    let _guard = STORE_LOCK.lock().map_err(|_| "Release store is busy.".to_string())?;
    let file = store_file(&app, "drafts.json")?;
    let mut items: Vec<ReleaseDraft> = read_store(&file)?;
    if let Some(p) = target { items.retain(|v| v.repository_path == p); }
    items.sort_by(|a, b| b.created_at_ms.cmp(&a.created_at_ms));
    Ok(items)
}
#[tauri::command]
pub fn riot_release_list_history(app: tauri::AppHandle, path: Option<String>) -> Result<Vec<ReleaseHistory>, String> {
    let target = path.map(|v| PathBuf::from(&v).canonicalize().map(|p| p.to_string_lossy().to_string()).unwrap_or(v));
    let _guard = STORE_LOCK.lock().map_err(|_| "Release store is busy.".to_string())?;
    let file = store_file(&app, "history.json")?;
    let mut items: Vec<ReleaseHistory> = read_store(&file)?;
    if let Some(p) = target { items.retain(|v| v.repository_path == p); }
    items.sort_by(|a, b| b.created_at_ms.cmp(&a.created_at_ms));
    Ok(items)
}
#[tauri::command]
pub fn riot_release_create_local_tag(app: tauri::AppHandle, path: String, version: String, notes: String) -> Result<ReleaseHistory, String> {
    let root = resolve_root(&path)?;
    let tag = normalize_tag(&version)?;
    if notes.trim().is_empty() || notes.len() > 131072 { return Err("Release notes must contain text and stay below 128 KiB.".into()); }
    if !status(&root)?.clean { return Err("Working tree is not clean. Commit changes before tagging.".into()); }

    let tag_ref = format!("refs/tags/{tag}");
    let exists = Command::new("git").arg("-C").arg(&root)
        .args(["show-ref", "--verify", "--quiet"]).arg(&tag_ref).output()
        .map_err(|e| format!("Git CLI unavailable: {e}"))?;
    if exists.status.success() { return Err(format!("Tag {tag} already exists and will not be overwritten.")); }

    let commit_sha = git(&root, &["rev-parse", "--verify", "HEAD"])?;
    git_args(&root, &[
        "tag".into(), "--annotate".into(), tag.clone(), "--message".into(), notes.clone(), commit_sha.clone(),
    ])?;
    let record = ReleaseHistory {
        id: format!("{}-{tag}", now_ms()), repository_path: root.to_string_lossy().to_string(),
        repository_name: repo_name(&root), tag, commit_sha, notes, created_at_ms: now_ms(),
        publication: "local-only".into(),
    };
    let _guard = STORE_LOCK.lock().map_err(|_| "Tag created, but release history lock failed.".to_string())?;
    let file = store_file(&app, "history.json").map_err(|e| format!("Tag created, but history storage failed: {e}"))?;
    let mut items: Vec<ReleaseHistory> = read_store(&file).map_err(|e| format!("Tag created, but history read failed: {e}"))?;
    items.push(record.clone());
    write_store(&file, &items).map_err(|e| format!("Tag created, but history save failed: {e}"))?;
    Ok(record)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn semver_validation() {
        assert_eq!(normalize_tag("1.2.3").unwrap(), "v1.2.3");
        assert_eq!(normalize_tag("v2.0.0-rc.1+build.7").unwrap(), "v2.0.0-rc.1+build.7");
        assert!(normalize_tag("1.02.3").is_err());
        assert!(normalize_tag("1.2").is_err());
        assert!(normalize_tag("1.2.3/unsafe").is_err());
    }
    #[test]
    fn commit_categories() {
        assert_eq!(category("feat(core): add preview"), "Features");
        assert_eq!(category("fix: dirty tag check"), "Fixes");
        assert_eq!(category("docs: update guide"), "Documentation");
        assert_eq!(category("chore: cleanup"), "Maintenance");
        assert_eq!(category("random update"), "Other");
    }
    #[test]
    fn changelog_empty_state_is_explicit() {
        assert!(changelog(&[]).contains("No commits were found"));
    }

    #[test]
    fn inspects_a_real_local_git_worktree_without_network() {
        let root = std::env::temp_dir().join(format!(
            "riot-release-git-test-{}-{}",
            std::process::id(),
            now_ms()
        ));
        fs::create_dir_all(&root).unwrap();
        git(&root, &["init", "--quiet"]).unwrap();
        git(&root, &["config", "user.name", "COCKPIT Test"]).unwrap();
        git(&root, &["config", "user.email", "cockpit-test@example.invalid"]).unwrap();
        git(&root, &["config", "commit.gpgsign", "false"]).unwrap();
        fs::write(root.join("README.md"), "local release test\n").unwrap();
        git(&root, &["add", "README.md"]).unwrap();
        git(&root, &["commit", "--quiet", "-m", "feat: seed local repository"]).unwrap();

        let first = preview(&root).unwrap();
        assert!(first.status.clean);
        assert_eq!(first.commits.len(), 1);
        assert_eq!(first.commits[0].category, "Features");
        assert!(first.suggested_changelog.contains("feat: seed local repository"));

        fs::write(root.join("README.md"), "dirty working tree\n").unwrap();
        assert!(!status(&root).unwrap().clean);
        fs::remove_dir_all(&root).unwrap();
    }
}
