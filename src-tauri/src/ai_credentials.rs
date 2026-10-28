// API keys never enter the workspace, settings JSON or application logs.
fn entry(id: &str) -> Result<keyring::Entry, String> {
    if id.len() != 36 || !id.chars().all(|c| c.is_ascii_hexdigit() || c == '-') {
        return Err("Invalid credential identifier".into());
    }
    keyring::Entry::new("com.chartelis.editor.ai", id).map_err(|_| "Credential store unavailable".into())
}

#[tauri::command]
pub fn ai_get_key(id: String) -> Result<Option<String>, String> {
    match entry(&id)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err("Could not read credential store".into()),
    }
}

#[tauri::command]
pub fn ai_set_key(id: String, key: String) -> Result<(), String> {
    if key.len() > 4096 { return Err("API key too long".into()); }
    if key.is_empty() { return ai_delete_key(id); }
    entry(&id)?.set_password(&key).map_err(|_| "Could not save credential".into())
}

#[tauri::command]
pub fn ai_delete_key(id: String) -> Result<(), String> {
    match entry(&id)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err("Could not delete credential".into()),
    }
}
