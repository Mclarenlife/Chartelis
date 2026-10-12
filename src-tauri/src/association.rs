#[tauri::command]
pub fn is_default_markdown_app() -> bool {
    platform::is_default()
}

#[tauri::command]
pub fn configure_markdown_default() -> Result<String, String> {
    platform::configure().map_err(|error| error.to_string())
}

#[cfg(windows)]
mod platform {
    use std::os::windows::process::CommandExt;
    use winreg::{enums::HKEY_CURRENT_USER, RegKey};
    const PROG_ID: &str = "Chartelis.Markdown";
    pub fn is_default() -> bool {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let value = hkcu.open_subkey(r"Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.md\UserChoice")
            .and_then(|key| key.get_value::<String, _>("ProgId"));
        value.is_ok_and(|id| id == PROG_ID || id == "Chartelis.md" || id == "Applications\\chartelis.exe")
    }
    pub fn configure() -> Result<String, Box<dyn std::error::Error>> {
        let exe = std::env::current_exe()?;
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        // Register an available handler. Windows owns UserChoice and asks the user
        // to select the default; never overwrite its protected hash or ProgId.
        let (class, _) = hkcu.create_subkey(format!(r"Software\Classes\{PROG_ID}"))?;
        class.set_value("", &"Chartelis Markdown")?;
        class.create_subkey(r"shell\open\command")?.0.set_value("", &format!("\"{}\" \"%1\"", exe.display()))?;
        class.create_subkey("DefaultIcon")?.0.set_value("", &format!("\"{}\",0", exe.display()))?;
        let (capabilities, _) = hkcu.create_subkey(r"Software\Chartelis\Capabilities")?;
        capabilities.set_value("ApplicationName", &"Chartelis")?;
        capabilities.set_value("ApplicationDescription", &"Markdown 文稿编辑器")?;
        let (types, _) = capabilities.create_subkey("FileAssociations")?;
        for ext in [".md", ".markdown", ".mdown"] {
            types.set_value(ext, &PROG_ID)?;
            hkcu.create_subkey(format!(r"Software\Classes\{ext}\OpenWithProgids"))?.0.set_value(PROG_ID, &"")?;
        }
        hkcu.create_subkey(r"Software\RegisteredApplications")?.0.set_value("Chartelis", &r"Software\Chartelis\Capabilities")?;
        let system = std::env::var_os("SystemRoot").ok_or("无法定位 Windows 系统目录")?;
        std::process::Command::new(std::path::PathBuf::from(system).join("System32/rundll32.exe"))
            .args(["url.dll,FileProtocolHandler", "ms-settings:defaultapps?registeredAppUser=Chartelis"])
            .creation_flags(0x08000000).spawn()?;
        Ok("已打开系统设置。请选择 .md，并将默认应用改为 Chartelis。".into())
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use core_foundation::{base::TCFType, string::{CFString, CFStringRef}};
    #[link(name = "CoreServices", kind = "framework")]
    extern "C" {
        fn LSSetDefaultRoleHandlerForContentType(content_type: CFStringRef, roles: u32, handler: CFStringRef) -> i32;
        fn LSCopyDefaultRoleHandlerForContentType(content_type: CFStringRef, roles: u32) -> CFStringRef;
    }
    const ROLES: u32 = 0xffffffff;
    pub fn is_default() -> bool {
        let uti = CFString::new("net.daringfireball.markdown");
        unsafe {
            let result = LSCopyDefaultRoleHandlerForContentType(uti.as_concrete_TypeRef(), ROLES);
            !result.is_null() && CFString::wrap_under_create_rule(result).to_string() == "com.chartelis.editor"
        }
    }
    pub fn configure() -> Result<String, Box<dyn std::error::Error>> {
        let uti = CFString::new("net.daringfireball.markdown");
        let bundle = CFString::new("com.chartelis.editor");
        let status = unsafe { LSSetDefaultRoleHandlerForContentType(uti.as_concrete_TypeRef(), ROLES, bundle.as_concrete_TypeRef()) };
        if status != 0 { return Err(format!("macOS 未能修改默认应用（{status}）。请确认已安装到“应用程序”，也可以在 Finder 的“显示简介 → 打开方式 → 全部更改”中设置。").into()); }
        Ok("已请求将 Chartelis 设为 Markdown 默认应用；若系统弹出确认，请完成确认。".into())
    }
}

#[cfg(not(any(windows, target_os = "macos")))]
mod platform {
    pub fn is_default() -> bool { false }
    pub fn configure() -> Result<String, Box<dyn std::error::Error>> { Err("请在系统的默认应用设置中选择 Chartelis。".into()) }
}
