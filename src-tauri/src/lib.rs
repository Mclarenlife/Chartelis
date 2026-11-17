mod association;
mod language;
mod ai_credentials;

use std::{path::{Path, PathBuf}, sync::Mutex};
use tauri::{Emitter, Manager};
use tauri_plugin_fs::FsExt;

#[derive(Default)]
struct PendingFiles(Mutex<Vec<String>>);

// Async so WebView2 creation runs outside its window event callback on Windows.
#[tauri::command]
async fn open_document_window(app: tauri::AppHandle, id: String) -> Result<(), String> {
    if id.len() != 36 || !id.bytes().enumerate().all(|(i, b)| {
        if matches!(i, 8 | 13 | 18 | 23) { b == b'-' } else { b.is_ascii_hexdigit() }
    }) { return Err("Invalid document window ID".into()); }
    let label = format!("document-{id}");
    if app.get_webview_window(&label).is_some() { return Ok(()); }
    let mut config = app.config().app.windows[0].clone();
    config.label = label;
    let window = tauri::WebviewWindowBuilder::from_config(&app, &config)
        .map_err(|error| error.to_string())?.build().map_err(|error| error.to_string())?;
    let _ = window.set_focus();
    Ok(())
}

fn external_window(app: &tauri::AppHandle) -> Option<tauri::WebviewWindow> {
    app.get_webview_window("main").or_else(|| app.webview_windows().into_iter().min_by(|a, b| a.0.cmp(&b.0)).map(|(_, window)| window))
}

fn markdown_path(path: &Path) -> Option<PathBuf> {
    let extension = path.extension()?.to_str()?.to_ascii_lowercase();
    if !["md", "markdown", "mdown"].contains(&extension.as_str()) || !path.is_file() { return None; }
    path.canonicalize().ok()
}

fn queue_files(app: &tauri::AppHandle, paths: impl IntoIterator<Item = PathBuf>) {
    let pending = app.state::<PendingFiles>();
    let mut queue = pending.0.lock().unwrap_or_else(|error| error.into_inner());
    for path in paths.into_iter().filter_map(|path| markdown_path(&path)) {
        if app.fs_scope().allow_file(&path).is_ok() {
            let path = path.to_string_lossy().to_string();
            let path = path.strip_prefix(r"\\?\").unwrap_or(&path).to_string();
            let _ = app.fs_scope().allow_file(&path);
            if !queue.contains(&path) { queue.push(path); }
        }
    }
    drop(queue);
    if let Some(window) = external_window(app) {
        let _ = app.emit_to(window.label(), "chartelis-open-files", ());
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
fn take_pending_files(window: tauri::WebviewWindow, state: tauri::State<PendingFiles>) -> Vec<String> {
    if external_window(window.app_handle()).is_none_or(|target| target.label() != window.label()) { return vec![]; }
    std::mem::take(&mut *state.0.lock().unwrap_or_else(|error| error.into_inner()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PendingFiles::default())
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            queue_files(app, args.into_iter().skip(1).filter(|arg| !arg.starts_with('-')).map(|arg| {
                let path = PathBuf::from(arg);
                if path.is_absolute() { path } else { Path::new(&cwd).join(path) }
            }));
        }))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![open_document_window, take_pending_files, association::is_default_markdown_app, association::configure_markdown_default, language::installation_language, ai_credentials::ai_get_key, ai_credentials::ai_set_key, ai_credentials::ai_delete_key])
        .setup(|app| {
            queue_files(app.handle(), std::env::args_os().skip(1).map(PathBuf::from));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Chartelis could not start")
        .run(|app, event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = event {
                queue_files(app, urls.into_iter().filter_map(|url| url.to_file_path().ok()));
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (app, event);
        });
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_existing_markdown_files_are_opened() {
        let dir = std::env::temp_dir().join(format!("chartelis-association-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let md = dir.join("example.MD");
        let other = dir.join("example.exe");
        std::fs::write(&md, "# Test").unwrap();
        std::fs::write(&other, "ignored").unwrap();
        assert!(markdown_path(&md).is_some());
        assert!(markdown_path(&other).is_none());
        assert!(markdown_path(&dir.join("missing.md")).is_none());
        std::fs::remove_file(md).unwrap();
        std::fs::remove_file(other).unwrap();
        std::fs::remove_dir(dir).unwrap();
    }
}
