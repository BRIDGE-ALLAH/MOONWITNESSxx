use crate::riot_release::{now_ms, read_store, repo_name, resolve_root, store_file, write_store};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs::{self, File},
    io::Read,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::Duration,
};
use tauri::Manager;
use tokio::{
    io::{AsyncRead, AsyncReadExt},
    process::{Command as TokioCommand, Stdio},
    time::timeout,
};

const BUILD_TIMEOUT_SECS: u64 = 15 * 60;
const MAX_BUILD_LOG_BYTES: usize = 48 * 1024;
const MAX_ARTIFACT_FILES: usize = 250;
const MAX_ARTIFACT_DEPTH: usize = 5;
const MAX_ARTIFACT_BYTES: u64 = 2 * 1024 * 1024 * 1024;
static BUILD_SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseBuildProfile {
    pub id: String,
    pub label: String,
    pub description: String,
    pub executable: String,
    pub args: Vec<String>,
    pub output_directories: Vec<String>,
    pub trust_notice: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseBuildRecord {
    pub id: String,
    pub repository_path: String,
    pub repository_name: String,
    pub profile_id: String,
    pub command_preview: String,
    pub success: bool,
    pub exit_code: Option<i32>,
    pub timed_out: bool,
    pub elapsed_ms: u128,
    pub stdout: String,
    pub stderr: String,
    pub logs_truncated: bool,
    pub created_at_ms: u128,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactCandidate {
    pub repository_path: String,
    pub profile_id: String,
    pub source_path: String,
    pub file_name: String,
    pub size_bytes: u64,
    pub sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultArtifact {
    pub id: String,
    pub repository_path: String,
    pub repository_name: String,
    pub source_path: String,
    pub stored_path: String,
    pub file_name: String,
    pub size_bytes: u64,
    pub sha256: String,
    pub created_at_ms: u128,
}

fn package_has_build_script(root: &Path) -> bool {
    let package = root.join("package.json");
    let Ok(raw) = fs::read_to_string(package) else { return false };
    let Ok(value) = serde_json::from_str::<serde_json::Value>(&raw) else { return false };
    value
        .get("scripts")
        .and_then(|scripts| scripts.get("build"))
        .and_then(serde_json::Value::as_str)
        .is_some_and(|value| !value.trim().is_empty())
}

fn detect_profiles(root: &Path) -> Vec<ReleaseBuildProfile> {
    let mut profiles = Vec::new();

    if root.join("Cargo.toml").is_file() {
        profiles.push(ReleaseBuildProfile {
            id: "cargo-release".into(),
            label: "Cargo / Release".into(),
            description: "Compile the current Rust workspace in release mode.".into(),
            executable: "cargo".into(),
            args: vec!["build".into(), "--release".into()],
            output_directories: vec!["target/release".into()],
            trust_notice: "Cargo build scripts and native dependencies in this repository will execute.".into(),
        });
    }

    if package_has_build_script(root) {
        let (executable, args) = if root.join("pnpm-lock.yaml").is_file() {
            ("pnpm", vec!["run".into(), "build".into()])
        } else if root.join("yarn.lock").is_file() {
            ("yarn", vec!["build".into()])
        } else if root.join("bun.lock").is_file() || root.join("bun.lockb").is_file() {
            ("bun", vec!["run".into(), "build".into()])
        } else {
            ("npm", vec!["run".into(), "build".into()])
        };
        profiles.push(ReleaseBuildProfile {
            id: "node-build".into(),
            label: format!("Node.js / {}", executable),
            description: "Run the repository's declared package.json build script.".into(),
            executable: executable.into(),
            args,
            output_directories: vec!["dist".into(), "build".into(), "out".into(), ".next".into()],
            trust_notice: "The package.json build script and any child tools it invokes are repository-controlled code.".into(),
        });
    }

    if root.join("*.sln").exists()
        || fs::read_dir(root)
            .ok()
            .into_iter()
            .flatten()
            .filter_map(Result::ok)
            .any(|entry| entry.path().extension().is_some_and(|extension| extension == "sln" || extension == "csproj"))
    {
        profiles.push(ReleaseBuildProfile {
            id: "dotnet-publish".into(),
            label: ".NET / Publish".into(),
            description: "Publish the current solution or project using the Release configuration.".into(),
            executable: "dotnet".into(),
            args: vec!["publish".into(), "--configuration".into(), "Release".into()],
            output_directories: vec!["bin/Release".into()],
            trust_notice: "MSBuild targets and project build hooks from this repository may execute.".into(),
        });
    }

    profiles
}

async fn read_capped<R: AsyncRead + Unpin>(mut reader: R, limit: usize) -> (String, bool) {
    let mut captured = Vec::with_capacity(limit.min(8192));
    let mut buffer = [0_u8; 8192];
    let mut truncated = false;
    loop {
        match reader.read(&mut buffer).await {
            Ok(0) | Err(_) => break,
            Ok(count) => {
                let remaining = limit.saturating_sub(captured.len());
                let take = remaining.min(count);
                captured.extend_from_slice(&buffer[..take]);
                if take < count {
                    truncated = true;
                }
            }
        }
    }
    (String::from_utf8_lossy(&captured).to_string(), truncated)
}

fn sha256_file(path: &Path) -> Result<(u64, String), String> {
    let metadata = fs::symlink_metadata(path).map_err(|error| error.to_string())?;
    if !metadata.file_type().is_file() {
        return Err("Artifact source must be a regular file, not a directory or symbolic link.".into());
    }
    if metadata.len() > MAX_ARTIFACT_BYTES {
        return Err("Artifact exceeds the 2 GiB import limit.".into());
    }
    let mut file = File::open(path).map_err(|error| error.to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 1024 * 1024];
    let mut size = 0_u64;
    loop {
        let count = file.read(&mut buffer).map_err(|error| error.to_string())?;
        if count == 0 {
            break;
        }
        size = size.saturating_add(count as u64);
        if size > MAX_ARTIFACT_BYTES {
            return Err("Artifact exceeds the 2 GiB import limit.".into());
        }
        hasher.update(&buffer[..count]);
    }
    Ok((size, format!("{:x}", hasher.finalize())))
}

fn is_inside(parent: &Path, child: &Path) -> bool {
    child.starts_with(parent) && child != parent
}

fn allowed_output_roots(root: &Path) -> Vec<PathBuf> {
    detect_profiles(root)
        .into_iter()
        .flat_map(|profile| profile.output_directories)
        .filter_map(|relative| root.join(relative).canonicalize().ok())
        .filter(|path| path.is_dir() && is_inside(root, path))
        .collect()
}

fn safe_file_name(path: &Path) -> String {
    let raw = path.file_name().map(|value| value.to_string_lossy().to_string()).unwrap_or_else(|| "artifact.bin".into());
    let sanitized: String = raw
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_') {
                character
            } else {
                '_'
            }
        })
        .take(120)
        .collect();
    if sanitized.is_empty() || sanitized == "." || sanitized == ".." {
        "artifact.bin".into()
    } else {
        sanitized
    }
}

fn scan_directory(
    root: &Path,
    output_root: &Path,
    current: &Path,
    profile_id: &str,
    candidates: &mut Vec<ArtifactCandidate>,
    depth: usize,
) {
    if depth > MAX_ARTIFACT_DEPTH || candidates.len() >= MAX_ARTIFACT_FILES {
        return;
    }
    let Ok(entries) = fs::read_dir(current) else { return };
    for entry in entries.filter_map(Result::ok) {
        if candidates.len() >= MAX_ARTIFACT_FILES {
            break;
        }
        let path = entry.path();
        let Ok(metadata) = fs::symlink_metadata(&path) else { continue };
        let file_type = metadata.file_type();
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            let name = entry.file_name().to_string_lossy().to_ascii_lowercase();
            if matches!(name.as_str(), ".git" | "node_modules" | "cache" | "incremental" | "deps") {
                continue;
            }
            scan_directory(root, output_root, &path, profile_id, candidates, depth + 1);
            continue;
        }
        if !file_type.is_file() || metadata.len() > MAX_ARTIFACT_BYTES {
            continue;
        }
        let Ok(canonical) = path.canonicalize() else { continue };
        if !is_inside(output_root, &canonical) || !is_inside(root, &canonical) {
            continue;
        }
        let Ok((size_bytes, sha256)) = sha256_file(&canonical) else { continue };
        candidates.push(ArtifactCandidate {
            repository_path: root.to_string_lossy().to_string(),
            profile_id: profile_id.into(),
            source_path: canonical.to_string_lossy().to_string(),
            file_name: safe_file_name(&canonical),
            size_bytes,
            sha256,
        });
    }
}

fn artifact_candidates(root: &Path, profile_id: &str) -> Result<Vec<ArtifactCandidate>, String> {
    let profile = detect_profiles(root)
        .into_iter()
        .find(|profile| profile.id == profile_id)
        .ok_or_else(|| "The requested build profile is not available for this repository.".to_string())?;
    let mut candidates = Vec::new();
    for output in profile.output_directories {
        let path = root.join(output);
        let Ok(output_root) = path.canonicalize() else { continue };
        if !output_root.is_dir() || !is_inside(root, &output_root) {
            continue;
        }
        scan_directory(root, &output_root, &output_root, profile_id, &mut candidates, 0);
        if candidates.len() >= MAX_ARTIFACT_FILES {
            break;
        }
    }
    candidates.sort_by(|left, right| left.file_name.to_lowercase().cmp(&right.file_name.to_lowercase()));
    Ok(candidates)
}

fn is_allowed_artifact(root: &Path, source: &Path) -> bool {
    allowed_output_roots(root).iter().any(|output| is_inside(output, source))
}

#[tauri::command]
pub fn riot_release_list_build_profiles(path: String) -> Result<Vec<ReleaseBuildProfile>, String> {
    let root = resolve_root(&path)?;
    Ok(detect_profiles(&root))
}

#[tauri::command]
pub async fn riot_release_run_build(
    app: tauri::AppHandle,
    path: String,
    profile_id: String,
    confirmed: bool,
) -> Result<ReleaseBuildRecord, String> {
    if !confirmed {
        return Err("Build execution requires explicit operator confirmation.".into());
    }
    let root = resolve_root(&path)?;
    let profile = detect_profiles(&root)
        .into_iter()
        .find(|profile| profile.id == profile_id)
        .ok_or_else(|| "The requested build profile is not available for this repository.".to_string())?;

    let started = std::time::Instant::now();
    let id = format!("build-{}-{}", now_ms(), BUILD_SEQUENCE.fetch_add(1, Ordering::Relaxed));
    let command_preview = format!("{} {}", profile.executable, profile.args.join(" "));
    let mut command = TokioCommand::new(&profile.executable);
    command
        .args(&profile.args)
        .current_dir(&root)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .env("CI", "1")
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("npm_config_update_notifier", "false");

    let mut child = command.spawn().map_err(|error| {
        format!("Cannot start {}. Install the selected build tool and add it to PATH: {error}", profile.executable)
    })?;
    let stdout = child.stdout.take().ok_or_else(|| "Cannot capture build stdout.".to_string())?;
    let stderr = child.stderr.take().ok_or_else(|| "Cannot capture build stderr.".to_string())?;
    let stdout_task = tokio::spawn(read_capped(stdout, MAX_BUILD_LOG_BYTES));
    let stderr_task = tokio::spawn(read_capped(stderr, MAX_BUILD_LOG_BYTES));

    let (status, timed_out) = match timeout(Duration::from_secs(BUILD_TIMEOUT_SECS), child.wait()).await {
        Ok(result) => (Some(result.map_err(|error| format!("Build process wait failed: {error}"))?), false),
        Err(_) => {
            let _ = child.kill().await;
            let _ = child.wait().await;
            (None, true)
        }
    };

    let (stdout, stdout_truncated) = stdout_task.await.map_err(|error| error.to_string())?;
    let (stderr, stderr_truncated) = stderr_task.await.map_err(|error| error.to_string())?;
    let exit_code = status.and_then(|status| status.code());
    let success = status.is_some_and(|status| status.success());
    let record = ReleaseBuildRecord {
        id,
        repository_path: root.to_string_lossy().to_string(),
        repository_name: repo_name(&root),
        profile_id,
        command_preview,
        success,
        exit_code,
        timed_out,
        elapsed_ms: started.elapsed().as_millis(),
        stdout,
        stderr,
        logs_truncated: stdout_truncated || stderr_truncated,
        created_at_ms: now_ms(),
    };

    let _guard = std::sync::Mutex::new(()).lock().map_err(|_| "Build history lock failed.".to_string())?;
    let file = store_file(&app, "builds.json")?;
    let mut history: Vec<ReleaseBuildRecord> = read_store(&file)?;
    history.push(record.clone());
    write_store(&file, &history)?;
    Ok(record)
}

#[tauri::command]
pub fn riot_release_list_build_history(
    app: tauri::AppHandle,
    path: Option<String>,
) -> Result<Vec<ReleaseBuildRecord>, String> {
    let target = path.map(|value| {
        PathBuf::from(&value)
            .canonicalize()
            .map(|canonical| canonical.to_string_lossy().to_string())
            .unwrap_or(value)
    });
    let _guard = std::sync::Mutex::new(()).lock().map_err(|_| "Build history lock failed.".to_string())?;
    let file = store_file(&app, "builds.json")?;
    let mut history: Vec<ReleaseBuildRecord> = read_store(&file)?;
    if let Some(path) = target {
        history.retain(|record| record.repository_path == path);
    }
    history.sort_by(|left, right| right.created_at_ms.cmp(&left.created_at_ms));
    Ok(history)
}

#[tauri::command]
pub fn riot_release_list_artifact_candidates(path: String, profile_id: String) -> Result<Vec<ArtifactCandidate>, String> {
    let root = resolve_root(&path)?;
    artifact_candidates(&root, &profile_id)
}

#[tauri::command]
pub fn riot_release_import_artifact(
    app: tauri::AppHandle,
    path: String,
    artifact_path: String,
) -> Result<VaultArtifact, String> {
    let root = resolve_root(&path)?;
    let requested = PathBuf::from(&artifact_path);
    let metadata = fs::symlink_metadata(&requested).map_err(|error| error.to_string())?;
    if metadata.file_type().is_symlink() || !metadata.file_type().is_file() {
        return Err("Only regular files can be imported into the artifact vault.".into());
    }
    let source = requested.canonicalize().map_err(|error| error.to_string())?;
    if !is_allowed_artifact(&root, &source) {
        return Err("Artifact must be inside a known build output directory for this repository.".into());
    }
    let (size_bytes, sha256) = sha256_file(&source)?;
    let id = format!("artifact-{}-{}", now_ms(), BUILD_SEQUENCE.fetch_add(1, Ordering::Relaxed));
    let file_name = safe_file_name(&source);
    let vault = store_file(&app, "vault")?;
    fs::create_dir_all(&vault).map_err(|error| error.to_string())?;
    let stored = vault.join(format!("{id}-{file_name}"));
    let temporary = vault.join(format!("{id}-{file_name}.tmp"));
    fs::copy(&source, &temporary).map_err(|error| error.to_string())?;
    let (copied_size, copied_sha256) = sha256_file(&temporary)?;
    if copied_size != size_bytes || copied_sha256 != sha256 {
        let _ = fs::remove_file(&temporary);
        return Err("Artifact changed while it was being copied; nothing was added to the vault.".into());
    }
    fs::rename(&temporary, &stored).map_err(|error| {
        let _ = fs::remove_file(&temporary);
        error.to_string()
    })?;

    let record = VaultArtifact {
        id,
        repository_path: root.to_string_lossy().to_string(),
        repository_name: repo_name(&root),
        source_path: source.to_string_lossy().to_string(),
        stored_path: stored.to_string_lossy().to_string(),
        file_name,
        size_bytes,
        sha256,
        created_at_ms: now_ms(),
    };
    let _guard = std::sync::Mutex::new(()).lock().map_err(|_| "Artifact vault lock failed.".to_string())?;
    let file = store_file(&app, "artifacts.json")?;
    let mut records: Vec<VaultArtifact> = read_store(&file)?;
    records.push(record.clone());
    write_store(&file, &records)?;
    Ok(record)
}

#[tauri::command]
pub fn riot_release_list_vault(
    app: tauri::AppHandle,
    path: Option<String>,
) -> Result<Vec<VaultArtifact>, String> {
    let target = path.map(|value| {
        PathBuf::from(&value)
            .canonicalize()
            .map(|canonical| canonical.to_string_lossy().to_string())
            .unwrap_or(value)
    });
    let _guard = std::sync::Mutex::new(()).lock().map_err(|_| "Artifact vault lock failed.".to_string())?;
    let file = store_file(&app, "artifacts.json")?;
    let mut records: Vec<VaultArtifact> = read_store(&file)?;
    if let Some(path) = target {
        records.retain(|record| record.repository_path == path);
    }
    records.sort_by(|left, right| right.created_at_ms.cmp(&left.created_at_ms));
    Ok(records)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(label: &str) -> PathBuf {
        let id = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let path = std::env::temp_dir().join(format!("riot-release-{label}-{id}"));
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn detects_only_declared_project_profiles() {
        let root = temp_dir("profiles");
        fs::write(root.join("Cargo.toml"), "[package]\nname='demo'\nversion='0.1.0'\n").unwrap();
        fs::write(root.join("package.json"), r#"{"scripts":{"build":"next build"}}"#).unwrap();
        fs::write(root.join("pnpm-lock.yaml"), "lockfileVersion: '9.0'\n").unwrap();
        let profiles = detect_profiles(&root);
        assert_eq!(profiles.len(), 2);
        assert_eq!(profiles[0].id, "cargo-release");
        assert_eq!(profiles[1].executable, "pnpm");
        assert_eq!(profiles[1].args, vec!["run", "build"]);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn ignores_package_without_build_script() {
        let root = temp_dir("no-build");
        fs::write(root.join("package.json"), r#"{"scripts":{"test":"node test.js"}}"#).unwrap();
        assert!(detect_profiles(&root).is_empty());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn hashes_artifacts_with_sha256() {
        let root = temp_dir("hash");
        let path = root.join("artifact.bin");
        fs::write(&path, b"abc").unwrap();
        let (size, hash) = sha256_file(&path).unwrap();
        assert_eq!(size, 3);
        assert_eq!(hash, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn only_known_build_output_paths_are_allowed() {
        let root = temp_dir("allowlist");
        fs::write(root.join("Cargo.toml"), "[package]\nname='demo'\nversion='0.1.0'\n").unwrap();
        let release = root.join("target/release");
        fs::create_dir_all(&release).unwrap();
        let artifact = release.join("demo.exe");
        fs::write(&artifact, b"binary").unwrap();
        let outside = root.join("README.md");
        fs::write(&outside, b"text").unwrap();
        let canonical_root = root.canonicalize().unwrap();
        assert!(is_allowed_artifact(&canonical_root, &artifact.canonicalize().unwrap()));
        assert!(!is_allowed_artifact(&canonical_root, &outside.canonicalize().unwrap()));
        fs::remove_dir_all(root).unwrap();
    }
}
