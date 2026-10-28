#[tauri::command]
pub fn installation_language() -> Option<String> {
    #[cfg(windows)]
    {
        use winreg::{enums::HKEY_CURRENT_USER, RegKey};
        let value: String = RegKey::predef(HKEY_CURRENT_USER).open_subkey(r"Software\Chartelis").ok()?.get_value("InstallationLanguage").ok()?;
        return match value.as_str() { "2052" => Some("zh-CN".into()), "1033" => Some("en".into()), _ => None };
    }
    #[cfg(not(windows))]
    None
}
