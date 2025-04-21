// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use once_cell::sync::Lazy;
use std::sync::Mutex;
use arboard::Clipboard;
use tauri::Emitter;
use serde::{Serialize, Deserialize};
use std::process::Command;
use base64::{Engine as _, engine::general_purpose};
use std::path::Path;

// Cache for the last clipboard value to avoid emitting duplicate events
static CLIPBOARD_CACHE: Lazy<Mutex<String>> = Lazy::new(|| Mutex::new(String::new()));

// Structure for clipboard data with source app info
#[derive(Clone, Serialize, Deserialize)]
struct ClipboardData {
    text: String,
    source_app: SourceApp,
}

#[derive(Clone, Serialize, Deserialize)]
struct SourceApp {
    name: String,
    base64_icon: Option<String>,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// Get the frontmost application info (name and icon)
#[cfg(target_os = "macos")]
fn get_frontmost_app() -> SourceApp {
    let app_name = get_frontmost_app_name_macos().unwrap_or_else(|| "App".to_string());
    let base64_icon = get_app_icon_macos(&app_name);
    
    SourceApp { 
        name: app_name,
        base64_icon 
    }
}

// Get just the name using osascript (was reliable)
#[cfg(target_os = "macos")]
fn get_frontmost_app_name_macos() -> Option<String> {
    match Command::new("osascript")
        .arg("-e")
        .arg("tell application \"System Events\" to name of first application process whose frontmost is true")
        .output() 
    {
        Ok(output) if output.status.success() => {
            let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !name.is_empty() { Some(name) } else { None }
        },
        _ => None
    }
}

// Get icon using mdfind + sips (more stable than objc)
#[cfg(target_os = "macos")]
fn get_app_icon_macos(app_name: &str) -> Option<String> {
    // 1. Find the application path using mdfind
    let app_path_output = Command::new("mdfind")
        .arg(format!("kMDItemKind == 'Application' && kMDItemFSName == '{}.app'", app_name))
        .output();

    // Make app_path mutable
    let mut app_path = match app_path_output {
        Ok(output) if output.status.success() => {
            let path_str = String::from_utf8_lossy(&output.stdout);
            // Take the first line if multiple results exist
            path_str.lines().next().map(|s| s.trim().to_string())
        },
        _ => None,
    };

    if app_path.is_none() {
        // Fallback: try finding in /Applications or /System/Applications
        let common_paths = [
            format!("/Applications/{}.app", app_name),
            format!("/System/Applications/{}.app", app_name),
            format!("/System/Applications/Utilities/{}.app", app_name),
            format!("/Applications/Utilities/{}.app", app_name),
        ];
        // Now this assignment is valid because app_path is mutable
        app_path = common_paths.iter().find(|p| Path::new(p).exists()).cloned();
    }
    
    if let Some(path) = app_path {
        // 2. Try multiple icon sources in order of preference
        let temp_dir = std::env::temp_dir();
        let temp_icon_path = temp_dir.join(format!("{}.png", app_name.replace('/', "_").replace(' ', "_")));
        
        // List of potential icon locations to try
        let icon_paths = [
            format!("{}/Contents/Resources/{}.icns", path, app_name),
            format!("{}/Contents/Resources/AppIcon.icns", path),
            format!("{}/Contents/Resources/icon.icns", path),
            format!("{}/Contents/Resources/app.icns", path),
        ];
        
        for icon_path in &icon_paths {
            if Path::new(icon_path).exists() {
                let sips_output = Command::new("sips")
                    .arg("-s")
                    .arg("format")
                    .arg("png")
                    .arg(icon_path)
                    .arg("--out")
                    .arg(&temp_icon_path)
                    .output();
                
                if sips_output.is_ok() && sips_output.as_ref().unwrap().status.success() {
                    if let Ok(icon_data) = std::fs::read(&temp_icon_path) {
                        let base64_icon = general_purpose::STANDARD.encode(&icon_data);
                        let data_url = format!("data:image/png;base64,{}", base64_icon);
                        // Clean up temp file
                        let _ = std::fs::remove_file(&temp_icon_path);
                        return Some(data_url);
                    }
                }
            }
        }
        
        // Fallback: Use macOS utility to get generic app icon if we couldn't find a specific one
        let script = format!(
            "tell application \"Finder\"
                try
                    set appFile to POSIX file \"{}\" as alias
                    set appIcon to the icon of appFile
                    set tmpFolder to path to temporary items as string
                    set tmpFile to tmpFolder & \"{}.png\"
                    set fileRef to (open for access POSIX path of tmpFile with write permission)
                    set iconData to data of (appIcon as picture)
                    write iconData to fileRef
                    close access fileRef
                    return POSIX path of tmpFile
                on error
                    return \"\"
                end try
            end tell", path, app_name.replace('/', "_").replace(' ', "_")
        );
        
        let output = Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .output();
            
        if let Ok(output) = output {
            if output.status.success() {
                let tmp_path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !tmp_path.is_empty() && Path::new(&tmp_path).exists() {
                    if let Ok(icon_data) = std::fs::read(&tmp_path) {
                        let base64_icon = general_purpose::STANDARD.encode(&icon_data);
                        let data_url = format!("data:image/png;base64,{}", base64_icon);
                        // Clean up temp file
                        let _ = std::fs::remove_file(&tmp_path);
                        return Some(data_url);
                    }
                    // Clean up even on error
                    let _ = std::fs::remove_file(&tmp_path);
                }
            }
        }
        
        // Clean up temp file even on failure
        let _ = std::fs::remove_file(&temp_icon_path);
    }
    
    None // Return None if icon extraction fails
}

// Windows implementation for getting frontmost app info (name and icon)
#[cfg(target_os = "windows")]
fn get_frontmost_app() -> SourceApp {
    let app_info = get_frontmost_app_win32();
    
    match app_info {
        Some((name, exe_path)) => {
            let base64_icon = get_app_icon_windows(&exe_path);
            SourceApp { 
                name,
                base64_icon 
            }
        },
        None => SourceApp { 
            name: "App".to_string(),
            base64_icon: None 
        }
    }
}

#[cfg(target_os = "windows")]
fn get_frontmost_app_win32() -> Option<(String, String)> {
    use std::ffi::{OsString, c_void};
    use std::os::windows::ffi::OsStringExt;
    use windows_sys::Win32::Foundation::{HWND, CloseHandle, MAX_PATH};
    use windows_sys::Win32::UI::WindowsAndMessaging::GetForegroundWindow;
    use windows_sys::Win32::System::Threading::{OpenProcess, GetWindowThreadProcessId, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ};
    use windows_sys::Win32::System::ProcessStatus::K32GetModuleFileNameExW;
    
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd == 0 { return None; }
        
        let mut process_id: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut process_id);
        if process_id == 0 { return None; }
        
        let process_handle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 0, process_id);
        if process_handle == 0 { return None; }
        
        let mut buffer = [0u16; MAX_PATH as usize];
        let length = K32GetModuleFileNameExW(process_handle, 0 as *mut c_void, buffer.as_mut_ptr(), buffer.len() as u32);
        
        CloseHandle(process_handle);
        if length == 0 { return None; }
        
        let exe_path_os = OsString::from_wide(&buffer[0..length as usize]);
        let exe_path = exe_path_os.to_string_lossy().into_owned();
        
        let exe_name = std::path::Path::new(&exe_path)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("App")
            .to_string();
        
        let friendly_name = match exe_name.to_lowercase().as_str() {
            "chrome" => "Google Chrome", "msedge" => "Microsoft Edge", "firefox" => "Mozilla Firefox",
            "safari" => "Safari", "notepad" => "Notepad", "code" => "Visual Studio Code",
            "explorer" => "File Explorer", "cmd" => "Command Prompt", "powershell" => "PowerShell",
            "winword" => "Microsoft Word", "excel" => "Microsoft Excel", "outlook" => "Microsoft Outlook",
            "teams" => "Microsoft Teams", "slack" => "Slack", "discord" => "Discord",
            "iexplore" => "Internet Explorer", "mspaint" => "Paint", "photoshop" => "Adobe Photoshop",
            "illustrator" => "Adobe Illustrator", "acrobat" => "Adobe Acrobat",
            "rider64" => "JetBrains Rider", "idea64" => "IntelliJ IDEA", "pycharm64" => "PyCharm",
            "webstorm64" => "WebStorm", "notepad++" => "Notepad++", "spotify" => "Spotify",
            "vlc" => "VLC Media Player",
            _ => &exe_name,
        };
        
        Some((friendly_name.to_string(), exe_path))
    }
}

#[cfg(target_os = "windows")]
fn get_app_icon_windows(exe_path: &str) -> Option<String> {
    use windows_sys::Win32::UI::Shell::{SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON, ExtractIconExW};
    use windows_sys::Win32::UI::WindowsAndMessaging::{DestroyIcon, GetIconInfo, ICONINFO};
    use windows_sys::Win32::Graphics::Gdi::{GetBitmapBits, GetObjectW, DeleteObject, BITMAP};
    use std::{mem, ptr, slice};
    use image::{ImageBuffer, Rgba, ImageOutputFormat};
    use std::io::Cursor;
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    unsafe {
        let mut path_utf16: Vec<u16> = OsStr::new(exe_path).encode_wide().collect();
        path_utf16.push(0); // Null terminate

        // Method 1: Try SHGetFileInfoW first (most reliable for .exe files)
        let mut sfi: SHFILEINFOW = mem::zeroed();
        let flags = SHGFI_ICON | SHGFI_LARGEICON;
        
        let file_info_res = SHGetFileInfoW(
            path_utf16.as_ptr(),
            0,
            &mut sfi,
            mem::size_of::<SHFILEINFOW>() as u32,
            flags,
        );

        let mut hicon = 0;
        if file_info_res != 0 && sfi.hIcon != 0 { 
            hicon = sfi.hIcon;
        } else {
            // Method 2: Fallback to ExtractIconExW
            let mut large_icon = 0;
            let mut small_icon = 0;
            let icon_count = ExtractIconExW(path_utf16.as_ptr(), 0, &mut large_icon, &mut small_icon, 1);
            
            if icon_count > 0 && large_icon != 0 {
                hicon = large_icon;
                if small_icon != 0 {
                    DestroyIcon(small_icon); // Clean up the small icon we don't need
                }
            }
        }

        // If we didn't get an icon through either method, return None
        if hicon == 0 {
            return None;
        }

        // Extract bitmap from the icon
        let mut icon_info: ICONINFO = mem::zeroed();
        if GetIconInfo(hicon, &mut icon_info) == 0 {
            DestroyIcon(hicon);
            return None;
        }
        
        // The bitmap handles we MUST release
        let hbm_color = icon_info.hbmColor;
        let hbm_mask = icon_info.hbmMask;

        // We'll try to use color bitmap first, mask as fallback
        let mut use_color = hbm_color != 0;
        let hbm = if use_color { hbm_color } else { hbm_mask };
        
        if hbm == 0 {
            DestroyIcon(hicon); 
            return None;
        }
        
        let mut bmp: BITMAP = mem::zeroed();
        let res = GetObjectW(
            hbm,
            mem::size_of::<BITMAP>() as i32,
            &mut bmp as *mut BITMAP as *mut _,
        );

        if res == 0 {
            DestroyIcon(hicon);
            if hbm_color != 0 { DeleteObject(hbm_color); }
            if hbm_mask != 0 { DeleteObject(hbm_mask); }
            return None;
        }
        
        let width = bmp.bmWidth as u32;
        let height = bmp.bmHeight as u32;
        let bits_per_pixel = bmp.bmBitsPixel as u32;

        // Ensure width and height are reasonable
        if width == 0 || height == 0 || width > 2048 || height > 2048 { 
             DestroyIcon(hicon);
             if hbm_color != 0 { DeleteObject(hbm_color); }
             if hbm_mask != 0 { DeleteObject(hbm_mask); }
             return None;
        }

        // If we're using monochrome mask, we need special handling
        if !use_color && bits_per_pixel == 1 {
            // For mask bitmap, we need different handling as it's monochrome
            // In a real app, we'd render this properly or use a fallback
            // For simplicity, we'll just return None when this happens and let the app 
            // display a default icon instead
            DestroyIcon(hicon);
            if hbm_color != 0 { DeleteObject(hbm_color); }
            if hbm_mask != 0 { DeleteObject(hbm_mask); }
            return None;
        }

        let buffer_size = (width * height * bits_per_pixel / 8) as usize;
        // Additional sanity check for buffer size to prevent large allocations
        if buffer_size == 0 || buffer_size > 16 * 1024 * 1024 { 
             DestroyIcon(hicon);
             if hbm_color != 0 { DeleteObject(hbm_color); }
             if hbm_mask != 0 { DeleteObject(hbm_mask); }
             return None;
        }
        let mut buffer: Vec<u8> = vec![0; buffer_size];
        
        let res = GetBitmapBits(hbm, buffer_size as i32, buffer.as_mut_ptr() as *mut _);
        
        // Clean up GDI objects *after* copying bits, but before returning on error
        DestroyIcon(hicon); 
        if hbm_color != 0 { DeleteObject(hbm_color); }
        if hbm_mask != 0 { DeleteObject(hbm_mask); }
        
        if res == 0 {
            return None;
        }

        // Convert pixel data (likely BGRA or BGR) to RGBA
        let img_buffer = match bits_per_pixel {
            32 => { // Assuming BGRA
                 buffer.chunks_exact_mut(4).for_each(|chunk| chunk.swap(0, 2)); // BGRA -> RGBA
                 ImageBuffer::<Rgba<u8>, _>::from_raw(width, height, buffer)
            }
            24 => { // Assuming BGR
                let mut rgba_buffer = Vec::with_capacity((width * height * 4) as usize);
                for chunk in buffer.chunks_exact(3) {
                    rgba_buffer.push(chunk[2]); // R
                    rgba_buffer.push(chunk[1]); // G
                    rgba_buffer.push(chunk[0]); // B
                    rgba_buffer.push(255);      // A (opaque)
                }
                ImageBuffer::<Rgba<u8>, _>::from_raw(width, height, rgba_buffer)
            }
            _ => return None // Don't support other formats for simplicity
        }; 

        // Check if image buffer creation succeeded
        let img_buffer = match img_buffer {
            Some(buf) => buf,
            None => return None, // from_raw can fail
        };

        // Encode as PNG into memory
        let mut png_buffer = Cursor::new(Vec::new());
        match img_buffer.write_to(&mut png_buffer, ImageOutputFormat::Png) {
            Ok(_) => {
                let base64_icon = general_purpose::STANDARD.encode(png_buffer.get_ref());
                let data_url = format!("data:image/png;base64,{}", base64_icon);
                Some(data_url)
            },
            Err(_) => None,
        }
    }
}

// Linux implementation for getting frontmost app info (name and icon)
#[cfg(target_os = "linux")]
fn get_frontmost_app() -> SourceApp {
    let app_name = get_frontmost_app_name_linux().unwrap_or_else(|| "App".to_string());
    let base64_icon = get_app_icon_linux(&app_name);
    
    SourceApp {
        name: app_name,
        base64_icon
    }
}

#[cfg(target_os = "linux")]
fn get_frontmost_app_name_linux() -> Option<String> {
    // Method 1: Try to get from xdotool
    if let Ok(output) = Command::new("xdotool")
        .args(["getwindowfocus", "getwindowname"])
        .output()
    {
        if output.status.success() {
            let window_name = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !window_name.is_empty() {
                // Often window name will include the app name at the end or beginning
                // For example: "Document - Firefox" or "Terminal: ~"
                return Some(window_name);
            }
        }
    }
    
    // Method 2: Try to get active window class using xprop
    if let Ok(output) = Command::new("xprop")
        .args(["-id", "$(xdotool getwindowfocus)", "WM_CLASS"])
        .output()
    {
        if output.status.success() {
            let output_str = String::from_utf8_lossy(&output.stdout);
            // The output format is typically: WM_CLASS(STRING) = "instance", "class"
            if let Some(class_part) = output_str.split('=').nth(1) {
                let parts: Vec<&str> = class_part.split(',').collect();
                if parts.len() > 1 {
                    // The second part is usually the application class name
                    let class = parts[1].trim().trim_matches('"');
                    if !class.is_empty() {
                        return Some(class.to_string());
                    }
                }
            }
        }
    }
    
    None
}

#[cfg(target_os = "linux")]
fn get_app_icon_linux(app_name: &str) -> Option<String> {
    // Try to find the application's desktop file
    let icon_name = find_icon_name_for_app(app_name)?;
    
    // Try to locate the icon file using the icon theme
    let icon_path = find_icon_file_path(&icon_name)?;
    
    // Read the icon file and convert to base64
    if let Ok(icon_data) = std::fs::read(&icon_path) {
        let base64_icon = general_purpose::STANDARD.encode(&icon_data);
        let extension = icon_path.extension().and_then(|ext| ext.to_str()).unwrap_or("png");
        let data_url = format!("data:image/{};base64,{}", extension, base64_icon);
        return Some(data_url);
    }
    
    None
}

#[cfg(target_os = "linux")]
fn find_icon_name_for_app(app_name: &str) -> Option<String> {
    // First, try to find a .desktop file matching the app name
    let desktop_dirs = [
        "/usr/share/applications/",
        "/usr/local/share/applications/",
        "~/.local/share/applications/",
    ];
    
    for dir in &desktop_dirs {
        let dir_path = if dir.starts_with("~/") {
            if let Ok(home) = std::env::var("HOME") {
                format!("{}{}", home, &dir[1..])
            } else {
                continue;
            }
        } else {
            dir.to_string()
        };
        
        if let Ok(entries) = std::fs::read_dir(dir_path) {
            for entry in entries.filter_map(Result::ok) {
                let path = entry.path();
                if path.extension().and_then(|ext| ext.to_str()) == Some("desktop") {
                    // Read the desktop file to check if it's for our app
                    if let Ok(content) = std::fs::read_to_string(&path) {
                        // Simple check for app name in the desktop file
                        if content.contains(&format!("Name={}", app_name)) || 
                           content.to_lowercase().contains(&app_name.to_lowercase()) {
                            // Find the icon name in the desktop file
                            for line in content.lines() {
                                if line.starts_with("Icon=") {
                                    return Some(line[5..].trim().to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Fallback: use the app name itself as the icon name
    // This often works as icon names are frequently the same as app names
    Some(app_name.to_lowercase())
}

#[cfg(target_os = "linux")]
fn find_icon_file_path(icon_name: &str) -> Option<String> {
    // Common icon sizes to try
    let sizes = ["256x256", "128x128", "64x64", "48x48", "32x32"];
    // Common icon theme paths
    let theme_paths = [
        // Hicolor theme (default)
        "/usr/share/icons/hicolor/",
        "/usr/local/share/icons/hicolor/",
        "~/.local/share/icons/hicolor/",
        // Adwaita theme (GNOME)
        "/usr/share/icons/Adwaita/",
        // Breeze theme (KDE)
        "/usr/share/icons/breeze/",
    ];
    
    // First, check if the icon_name is already a full path
    if icon_name.starts_with("/") && std::path::Path::new(icon_name).exists() {
        return Some(icon_name.to_string());
    }
    
    // Try different theme paths
    for theme_path in &theme_paths {
        let base_path = if theme_path.starts_with("~/") {
            if let Ok(home) = std::env::var("HOME") {
                format!("{}{}", home, &theme_path[1..])
            } else {
                continue;
            }
        } else {
            theme_path.to_string()
        };
        
        // Try different sizes
        for size in &sizes {
            // Try both PNG and SVG formats
            for ext in &["png", "svg"] {
                let icon_path = format!("{}{}/apps/{}.{}", base_path, size, icon_name, ext);
                if std::path::Path::new(&icon_path).exists() {
                    return Some(icon_path);
                }
            }
        }
        
        // Also check the scalable directory (for SVG icons)
        let scalable_path = format!("{}scalable/apps/{}.svg", base_path, icon_name);
        if std::path::Path::new(&scalable_path).exists() {
            return Some(scalable_path);
        }
    }
    
    // If we couldn't find the icon in any theme, try some common system locations
    let fallback_paths = [
        format!("/usr/share/pixmaps/{}.png", icon_name),
        format!("/usr/share/pixmaps/{}.xpm", icon_name),
        format!("/usr/share/pixmaps/{}", icon_name), // Some icons don't have extensions
    ];
    
    for path in &fallback_paths {
        if std::path::Path::new(path).exists() {
            return Some(path.to_string());
        }
    }
    
    None
}

// Default implementation for other platforms
#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
fn get_frontmost_app() -> SourceApp {
    SourceApp { 
        name: "App".to_string(),
        base64_icon: None
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let mut clipboard = match Clipboard::new() {
                    Ok(clipboard) => clipboard,
                    Err(e) => {
                        eprintln!("Failed to initialize clipboard: {}", e);
                        return;
                    }
                };
                
                loop {
                    if let Ok(text) = clipboard.get_text() {
                        if text.is_empty() {
                            tokio::time::sleep(std::time::Duration::from_millis(750)).await;
                            continue;
                        }
                        
                        let mut last_text = CLIPBOARD_CACHE.lock().unwrap();
                        if *last_text != text {
                            *last_text = text.clone();
                            
                            let source_app = get_frontmost_app(); // This now gets name and icon
                            
                            // Debug logging for icon extraction
                            println!("Source app: {}", source_app.name);
                            println!("Icon available: {}", source_app.base64_icon.is_some());
                            if let Some(icon) = &source_app.base64_icon {
                                println!("Icon data length: {} bytes", icon.len());
                            }
                            
                            let clipboard_data = ClipboardData {
                                text: text.clone(),
                                source_app,
                            };
                            
                            println!(r#"Copied: "{}" from {}"#, 
                                if text.len() > 30 { format!("{}...", &text[..30]) } else { text.clone() },
                                clipboard_data.source_app.name
                            );
                            
                            if let Err(e) = app_handle.emit("clipboard-new-text", clipboard_data) {
                                eprintln!("Failed to emit clipboard event: {}", e);
                            }
                        }
                    }
                    tokio::time::sleep(std::time::Duration::from_millis(750)).await;
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
