// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use once_cell::sync::Lazy;
use std::sync::Mutex;
use arboard::Clipboard;
use tauri::Emitter;
use serde::{Serialize, Deserialize};
use std::process::Command;
use base64::{Engine as _, engine::general_purpose};
use std::path::Path;
use std::collections::HashMap;
use std::time::{Duration, Instant};

// Cache for the last clipboard value to avoid emitting duplicate events
static CLIPBOARD_CACHE: Lazy<Mutex<String>> = Lazy::new(|| Mutex::new(String::new()));

// Cache for app icons to avoid re-extracting icons for already seen apps
static APP_ICON_CACHE: Lazy<Mutex<HashMap<String, CachedIcon>>> = Lazy::new(|| Mutex::new(HashMap::new()));

// Cache for the last valid source app information
static LAST_VALID_SOURCE_APP: Lazy<Mutex<Option<SourceApp>>> = Lazy::new(|| Mutex::new(None));

struct CachedIcon {
    base64_icon: Option<String>,
    timestamp: Instant,
}

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
    
    // Check if the app is our own app (briefcase)
    if app_name.to_lowercase() == "briefcase" {
        // Use the last valid source app if available
        let last_valid = LAST_VALID_SOURCE_APP.lock().unwrap();
        if let Some(last_app) = last_valid.clone() {
            // Use the last valid source app instead of our own app
            eprintln!("[Source App] Detected own app, using previous source app: {}", last_app.name);
            return last_app;
        }
    }
    
    // Check if we have a cached icon for this app
    {
        let cache = APP_ICON_CACHE.lock().unwrap();
        if let Some(cached) = cache.get(&app_name) {
            // Use cached icon if it's less than 1 hour old
            if cached.timestamp.elapsed() < Duration::from_secs(3600) {
                let source_app = SourceApp { 
                    name: app_name.clone(),
                    base64_icon: cached.base64_icon.clone()
                };
                
                // Store this as a valid source app if it's not our own app
                if app_name.to_lowercase() != "briefcase" {
                    let mut last_valid = LAST_VALID_SOURCE_APP.lock().unwrap();
                    *last_valid = Some(source_app.clone());
                }
                
                return source_app;
            }
        }
    }
    
    let base64_icon = get_app_icon_macos(&app_name);
    
    // Cache the icon result
    {
        let mut cache = APP_ICON_CACHE.lock().unwrap();
        cache.insert(app_name.clone(), CachedIcon {
            base64_icon: base64_icon.clone(),
            timestamp: Instant::now(),
        });
    }
    
    let source_app = SourceApp { 
        name: app_name.clone(),
        base64_icon 
    };
    
    // Store this as a valid source app if it's not our own app
    if app_name.to_lowercase() != "briefcase" {
        let mut last_valid = LAST_VALID_SOURCE_APP.lock().unwrap();
        *last_valid = Some(source_app.clone());
    }
    
    source_app
}

// Get just the name using osascript (was reliable)
#[cfg(target_os = "macos")]
fn get_frontmost_app_name_macos() -> Option<String> {
    eprintln!("[Icon Debug] Trying to get frontmost app name...");
    // First try with System Events
    match Command::new("osascript")
        .arg("-e")
        .arg("tell application \"System Events\" to name of first application process whose frontmost is true")
        .output() 
    {
        Ok(output) => {
            let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
            eprintln!("[Icon Debug] Method 1 (System Events Process Name) Output: {:?}, Status: {:?}, Name: '{}'", output.stdout, output.status, name);
            if output.status.success() && !name.is_empty() { return Some(name); }
        },
        Err(e) => eprintln!("[Icon Debug] Method 1 Error: {}", e)
    }
    
    // Fallback method using AppleScript
    match Command::new("osascript")
        .arg("-e")
        .arg("tell application \"System Events\" to tell (first process whose frontmost is true) to return name")
        .output()
    {
        Ok(output) => {
            let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
            eprintln!("[Icon Debug] Method 2 (System Events Return Name) Output: {:?}, Status: {:?}, Name: '{}'", output.stdout, output.status, name);
            if output.status.success() && !name.is_empty() { return Some(name); }
        },
        Err(e) => eprintln!("[Icon Debug] Method 2 Error: {}", e)
    }
    
    // Another fallback using the frontmost app's title (less reliable for actual app name)
    match Command::new("osascript")
        .arg("-e")
        .arg("tell application \"System Events\" to tell (first process whose frontmost is true) to get name")
        .output()
    {
        Ok(output) => {
            let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
            eprintln!("[Icon Debug] Method 3 (System Events Get Name) Output: {:?}, Status: {:?}, Name: '{}'", output.stdout, output.status, name);
            if output.status.success() && !name.is_empty() { return Some(name); }
        },
        Err(e) => eprintln!("[Icon Debug] Method 3 Error: {}", e)
    }
    eprintln!("[Icon Debug] All methods failed to get frontmost app name.");
    None
}

// Get icon using mdfind + sips (more stable than objc)
#[cfg(target_os = "macos")]
fn get_app_icon_macos(app_name: &str) -> Option<String> {
    // 1. Make sure we have a proper app name first
    eprintln!("[Icon Debug] Getting icon for app name: '{}'", app_name);
    let app_name = app_name.trim();
    if app_name.is_empty() {
        eprintln!("[Icon Debug] App name is empty, returning None.");
        return None;
    }
    
    // 2. Find the application path using mdfind with multiple strategies
    let mut app_path: Option<String> = None;
    
    // Strategy 1: Try exact app name
    if app_path.is_none() {
        let mdfind_cmd = format!("kMDItemKind == 'Application' && kMDItemFSName == '{}.app'", app_name);
        eprintln!("[Icon Debug] Running mdfind with query: {}", mdfind_cmd);
        let path_output = Command::new("mdfind")
            .arg(&mdfind_cmd)
            .output();
            
        if let Ok(output) = path_output {
            if output.status.success() {
                let path_str = String::from_utf8_lossy(&output.stdout);
                app_path = path_str.lines().next().map(|s| s.trim().to_string());
                eprintln!("[Icon Debug] Strategy 1: exact name match result: {:?}", app_path);
            }
        }
    }
    
    // Strategy 2: Try with spaces removed
    if app_path.is_none() && app_name.contains(' ') {
        let alt_app_name = app_name.replace(' ', "");
        let alt_mdfind_cmd = format!("kMDItemKind == 'Application' && kMDItemFSName == '{}.app'", alt_app_name);
        eprintln!("[Icon Debug] Strategy 2: trying with spaces removed: {}", alt_app_name);
        let alt_path_output = Command::new("mdfind")
            .arg(&alt_mdfind_cmd)
            .output();
        
        if let Ok(output) = alt_path_output {
            if output.status.success() {
                let path_str = String::from_utf8_lossy(&output.stdout);
                app_path = path_str.lines().next().map(|s| s.trim().to_string());
                eprintln!("[Icon Debug] Strategy 2 result: {:?}", app_path);
            }
        }
    }
    
    // Strategy 3: Try fuzzy match for the app name
    if app_path.is_none() {
        let fuzzy_mdfind_cmd = format!("kMDItemKind == 'Application' && kMDItemDisplayName == '*{}*'c", app_name);
        eprintln!("[Icon Debug] Strategy 3: trying fuzzy match: {}", fuzzy_mdfind_cmd);
        let fuzzy_path_output = Command::new("mdfind")
            .arg(&fuzzy_mdfind_cmd)
            .output();
            
        if let Ok(output) = fuzzy_path_output {
            if output.status.success() {
                let path_str = String::from_utf8_lossy(&output.stdout);
                app_path = path_str.lines().next().map(|s| s.trim().to_string());
                eprintln!("[Icon Debug] Strategy 3 result: {:?}", app_path);
            }
        }
    }
    
    // Strategy 4: Check common directories
    if app_path.is_none() {
        eprintln!("[Icon Debug] Strategy 4: checking common paths...");
        let common_paths = [
            format!("/Applications/{}.app", app_name),
            format!("/System/Applications/{}.app", app_name),
            format!("/System/Applications/Utilities/{}.app", app_name),
            format!("/Applications/Utilities/{}.app", app_name),
            // Additional common variants
            format!("/Applications/{}.app", app_name.replace(' ', "")),
            format!("/System/Applications/{}.app", app_name.replace(' ', "")),
        ];
        app_path = common_paths.iter().find(|p| Path::new(p).exists()).cloned();
        eprintln!("[Icon Debug] Strategy 4 result: {:?}", app_path);
    }
    
    // Strategy 5: Try to get the app bundle for standard apps
    if app_path.is_none() {
        // Known app name mappings
        let known_app_paths = [
            ("Google Chrome", "/Applications/Google Chrome.app"),
            ("Chrome", "/Applications/Google Chrome.app"),
            ("Safari", "/Applications/Safari.app"),
            ("Firefox", "/Applications/Firefox.app"),
            ("Terminal", "/System/Applications/Utilities/Terminal.app"),
            ("Finder", "/System/Library/CoreServices/Finder.app"),
            ("Mail", "/System/Applications/Mail.app"),
            ("Messages", "/System/Applications/Messages.app"),
            ("Notes", "/System/Applications/Notes.app"),
            ("TextEdit", "/System/Applications/TextEdit.app"),
            ("Xcode", "/Applications/Xcode.app"),
            ("Visual Studio Code", "/Applications/Visual Studio Code.app"),
            ("VS Code", "/Applications/Visual Studio Code.app"),
            ("Code", "/Applications/Visual Studio Code.app"),
            ("Microsoft Edge", "/Applications/Microsoft Edge.app"),
            ("Edge", "/Applications/Microsoft Edge.app"),
            // Add more common apps as needed
        ];
        
        for (known_name, known_path) in known_app_paths {
            if app_name.to_lowercase() == known_name.to_lowercase() && Path::new(known_path).exists() {
                app_path = Some(known_path.to_string());
                eprintln!("[Icon Debug] Strategy 5: Found known app mapping for {}: {}", app_name, known_path);
                break;
            }
        }
    }
    
    // 5. Process the app path to get the icon
    if let Some(path) = app_path {
        eprintln!("[Icon Debug] Processing app path: {}", path);
        let temp_dir = std::env::temp_dir();
        let temp_icon_path = temp_dir.join(format!("{}.png", app_name.replace('/', "_").replace(' ', "_")));
        eprintln!("[Icon Debug] Temp PNG path: {:?}", temp_icon_path);
        
        // List of potential icon locations to try
        let icon_paths = [
            format!("{}/Contents/Resources/{}.icns", path, app_name),
            format!("{}/Contents/Resources/AppIcon.icns", path),
            format!("{}/Contents/Resources/icon.icns", path),
            format!("{}/Contents/Resources/app.icns", path),
            format!("{}/Contents/Resources/{}.icns", path, app_name.replace(' ', "")),
            format!("{}/Contents/Resources/Application.icns", path),
            // Add more icon path patterns
            format!("{}/Contents/Resources/AppIcon.png", path),
            format!("{}/Contents/Resources/Icon.png", path),
        ];
        
        let mut found_icon_via_sips = false;
        for icon_path in &icon_paths {
            if Path::new(icon_path).exists() {
                eprintln!("[Icon Debug] Found icon at path: {}", icon_path);
                let sips_output = Command::new("sips")
                    .arg("-s")
                    .arg("format")
                    .arg("png")
                    .arg(icon_path)
                    .arg("--out")
                    .arg(&temp_icon_path)
                    .output();
                
                match sips_output {
                    Ok(output) if output.status.success() => {
                        match std::fs::read(&temp_icon_path) {
                            Ok(icon_data) => {
                                let base64_icon = general_purpose::STANDARD.encode(&icon_data);
                                let data_url = format!("data:image/png;base64,{}", base64_icon);
                                let _ = std::fs::remove_file(&temp_icon_path); // Clean up
                                found_icon_via_sips = true;
                                return Some(data_url);
                            }
                            Err(e) => {
                                eprintln!("[Icon Debug] sips succeeded, but failed to read temp file: {}", e);
                            }
                        }
                    }
                    _ => { } // Try next icon path on failure
                }
            }
        }

        if !found_icon_via_sips {
            // FINAL FALLBACK: Use macOS Finder to get icon (most reliable but slower)
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
                
            match output {
                Ok(output) if output.status.success() => {
                    let tmp_path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !tmp_path_str.is_empty() && Path::new(&tmp_path_str).exists() {
                        match std::fs::read(&tmp_path_str) {
                            Ok(icon_data) => {
                                let base64_icon = general_purpose::STANDARD.encode(&icon_data);
                                let data_url = format!("data:image/png;base64,{}", base64_icon);
                                let _ = std::fs::remove_file(&tmp_path_str); // Clean up
                                return Some(data_url);
                            }
                            Err(_) => {
                                let _ = std::fs::remove_file(&tmp_path_str);
                            }
                        }
                    }
                }
                _ => { } // Continue to next fallback
            }
        }
        
        // Clean up temp file
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
            // Check if the app is our own app
            if name.to_lowercase() == "briefcase" {
                // Use the last valid source app if available
                let last_valid = LAST_VALID_SOURCE_APP.lock().unwrap();
                if let Some(last_app) = last_valid.clone() {
                    // Use the last valid source app instead of our own app
                    eprintln!("[Source App] Detected own app, using previous source app: {}", last_app.name);
                    return last_app;
                }
            }
            
            let base64_icon = get_app_icon_windows(&exe_path);
            let source_app = SourceApp { name, base64_icon };
            
            // Store this as a valid source app if it's not our own app
            if source_app.name.to_lowercase() != "briefcase" {
                let mut last_valid = LAST_VALID_SOURCE_APP.lock().unwrap();
                *last_valid = Some(source_app.clone());
            }
            
            source_app
        },
        None => SourceApp { 
            name: "App".to_string(),
            base64_icon: None 
        }
    }
}

#[cfg(target_os = "windows")]
fn get_frontmost_app_win32() -> Option<(String, String)> {
    use std::ffi::{OsString, c_void, OsStr};
    use std::os::windows::ffi::{OsStringExt, OsStrExt};
    use windows_sys::Win32::Foundation::{HWND, CloseHandle, MAX_PATH};
    use windows_sys::Win32::UI::WindowsAndMessaging::GetForegroundWindow;
    use windows_sys::Win32::System::Threading::{OpenProcess, GetWindowThreadProcessId, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ};
    use windows_sys::Win32::System::ProcessStatus::K32GetModuleFileNameExW;
    use windows_sys::Win32::UI::Shell::{SHGetFileInfoW, SHFILEINFOW, SHGFI_DISPLAYNAME, SHGFI_USEFILEATTRIBUTES};
    use std::mem;

    eprintln!("[Win Icon Debug] Getting frontmost window...");
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd == 0 { 
            eprintln!("[Win Icon Debug] GetForegroundWindow failed or returned null.");
            return None; 
        }
        eprintln!("[Win Icon Debug] Got HWND: {}", hwnd);
        
        let mut process_id: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut process_id);
        if process_id == 0 { 
            eprintln!("[Win Icon Debug] GetWindowThreadProcessId failed.");
            return None; 
        }
         eprintln!("[Win Icon Debug] Got Process ID: {}", process_id);
        
        let process_handle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 0, process_id);
        if process_handle == 0 { 
            eprintln!("[Win Icon Debug] OpenProcess failed.");
            return None; 
        }
        eprintln!("[Win Icon Debug] Got Process Handle: {}", process_handle);
        
        let mut buffer = [0u16; MAX_PATH as usize];
        let length = K32GetModuleFileNameExW(process_handle, 0 as *mut c_void, buffer.as_mut_ptr(), buffer.len() as u32);
        
        CloseHandle(process_handle);
        if length == 0 { 
            eprintln!("[Win Icon Debug] K32GetModuleFileNameExW failed.");
            return None; 
        }
        
        let exe_path_os = OsString::from_wide(&buffer[0..length as usize]);
        let exe_path = exe_path_os.to_string_lossy().into_owned();
        eprintln!("[Win Icon Debug] Got exe path: {}", exe_path);
        
        // Attempt to get the Shell's display name for the executable
        let mut display_name = String::new();
        let mut path_utf16: Vec<u16> = OsStr::new(&exe_path).encode_wide().collect();
        path_utf16.push(0); // Null terminate

        let mut sfi: SHFILEINFOW = mem::zeroed();
        let flags = SHGFI_DISPLAYNAME | SHGFI_USEFILEATTRIBUTES; // Use SHGFI_USEFILEATTRIBUTES for potentially better results
        let ret = SHGetFileInfoW(
            path_utf16.as_ptr(),
            0,
            &mut sfi,
            mem::size_of::<SHFILEINFOW>() as u32,
            flags,
        );

        if ret != 0 {
            let name_slice = &sfi.szDisplayName[..];
            if let Some(null_pos) = name_slice.iter().position(|&c| c == 0) {
                 display_name = OsString::from_wide(&name_slice[..null_pos]).to_string_lossy().into_owned();
                 eprintln!("[Win Icon Debug] Got display name via SHGetFileInfoW: '{}'", display_name);
            } else {
                eprintln!("[Win Icon Debug] SHGetFileInfoW display name wasn't null terminated? Using fallback.");
            }
        } else {
             eprintln!("[Win Icon Debug] SHGetFileInfoW failed to get display name.");
        }

        // Fallback to deriving name from path if SHGetFileInfoW failed or returned empty
        if display_name.is_empty() {
             eprintln!("[Win Icon Debug] Using fallback name derived from exe path.");
             display_name = std::path::Path::new(&exe_path)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("App") // Default if stem is weird
                .to_string();
        }
        
        Some((display_name, exe_path))
    }
}

#[cfg(target_os = "windows")]
fn get_app_icon_windows(exe_path: &str) -> Option<String> {
    use windows_sys::Win32::UI::Shell::{SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON, SHGFI_SYSICONINDEX, SHGetImageList, ImageList_GetIcon, SHIL_LARGE};
    use windows_sys::Win32::UI::WindowsAndMessaging::{DestroyIcon, GetIconInfo, ICONINFO};
    use windows_sys::Win32::Graphics::Gdi::{GetBitmapBits, GetObjectW, DeleteObject, BITMAP};
    use std::{mem, ptr, slice};
    use image::{ImageBuffer, Rgba, ImageOutputFormat};
    use std::io::Cursor;
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    eprintln!("[Win Icon Debug] Attempting to get icon for path: {}", exe_path);
    unsafe {
        let mut path_utf16: Vec<u16> = OsStr::new(exe_path).encode_wide().collect();
        path_utf16.push(0); // Null terminate

        let mut hicon: windows_sys::Win32::Foundation::HICON = 0;

        // --- Method 1: System Image List (Modern approach) ---
        eprintln!("[Win Icon Debug] Trying Method 1: System Image List via SHGetFileInfoW(SHGFI_SYSICONINDEX)...");
        let mut sfi_sys: SHFILEINFOW = mem::zeroed();
        let flags_sys = SHGFI_SYSICONINDEX; 
        let file_info_res_sys = SHGetFileInfoW(
            path_utf16.as_ptr(),
            0,
            &mut sfi_sys,
            mem::size_of::<SHFILEINFOW>() as u32,
            flags_sys,
        );

        if file_info_res_sys != 0 {
            let icon_index = sfi_sys.iIcon;
            eprintln!("[Win Icon Debug] SHGetFileInfoW(SHGFI_SYSICONINDEX) succeeded. Icon Index: {}", icon_index);
            let mut himagelist: windows_sys::Win32::Foundation::HMODULE = 0; // HMODULE used for HIMAGELIST here
            // Try getting large image list first, fallback to small if needed
            if SHGetImageList(SHIL_LARGE, &windows_sys::Win32::UI::Shell::IID_IImageList, &mut himagelist as *mut _ as *mut *mut std::ffi::c_void) == windows_sys::Win32::Foundation::S_OK {
                 eprintln!("[Win Icon Debug] Got system image list (SHIL_LARGE).");
                 hicon = ImageList_GetIcon(himagelist, icon_index, 0); // uFlags = ILD_NORMAL = 0
                 if hicon != 0 {
                     eprintln!("[Win Icon Debug] Successfully extracted HICON from SHIL_LARGE image list.");
                 } else {
                     eprintln!("[Win Icon Debug] Failed to extract HICON from SHIL_LARGE list (ImageList_GetIcon returned 0).");
                 }
            } else {
                 eprintln!("[Win Icon Debug] Failed to get system image list (SHIL_LARGE).");
            }
        } else {
             eprintln!("[Win Icon Debug] SHGetFileInfoW(SHGFI_SYSICONINDEX) failed.");
        }

        // --- Method 2: Direct Icon via SHGetFileInfoW (Original fallback) ---
        if hicon == 0 { 
            eprintln!("[Win Icon Debug] Method 1 failed. Trying Method 2: Direct HICON via SHGetFileInfoW(SHGFI_ICON)...");
            let mut sfi_direct: SHFILEINFOW = mem::zeroed();
            let flags_direct = SHGFI_ICON | SHGFI_LARGEICON;
            let file_info_res_direct = SHGetFileInfoW(
                path_utf16.as_ptr(),
                0,
                &mut sfi_direct,
                mem::size_of::<SHFILEINFOW>() as u32,
                flags_direct,
            );
            if file_info_res_direct != 0 && sfi_direct.hIcon != 0 { 
                hicon = sfi_direct.hIcon;
                eprintln!("[Win Icon Debug] Method 2 succeeded. Got direct HICON: {}", hicon);
            } else {
                 eprintln!("[Win Icon Debug] Method 2 failed (SHGetFileInfoW(SHGFI_ICON) returned 0 or null HICON).");
            }
        }

        // --- Method 3: ExtractIconExW (Final fallback) ---
        // Note: ExtractIconExW is generally less reliable for modern apps than SHGetFileInfoW
        // We might even consider removing it if Method 1/2 are robust enough.
        // Keeping it for now for maximum compatibility.
        if hicon == 0 {
            eprintln!("[Win Icon Debug] Methods 1 & 2 failed. Trying Method 3: ExtractIconExW...");
            let mut large_icon = 0;
            let mut small_icon = 0; // We don't use the small one
            let icon_count = windows_sys::Win32::UI::Shell::ExtractIconExW(path_utf16.as_ptr(), 0, &mut large_icon, &mut small_icon, 1);
            
            if icon_count > 0 && large_icon != 0 {
                hicon = large_icon;
                eprintln!("[Win Icon Debug] Method 3 succeeded. Got HICON via ExtractIconExW: {}", hicon);
                if small_icon != 0 {
                    DestroyIcon(small_icon); // Clean up the small icon we don't need
                }
            } else {
                 eprintln!("[Win Icon Debug] Method 3 failed (ExtractIconExW returned count {} or null large_icon).", icon_count);
            }
        }

        // --- Process HICON if obtained ---
        if hicon == 0 {
            eprintln!("[Win Icon Debug] All methods failed to obtain an HICON. Returning None.");
            return None;
        }
        eprintln!("[Win Icon Debug] Processing obtained HICON: {}", hicon);

        // Extract bitmap from the icon
        let mut icon_info: ICONINFO = mem::zeroed();
        if GetIconInfo(hicon, &mut icon_info) == 0 {
            eprintln!("[Win Icon Debug] GetIconInfo failed for HICON: {}", hicon);
            DestroyIcon(hicon);
            return None;
        }
        eprintln!("[Win Icon Debug] GetIconInfo succeeded. Color bitmap: {}, Mask bitmap: {}", icon_info.hbmColor, icon_info.hbmMask);
        
        // The bitmap handles we MUST release
        let hbm_color = icon_info.hbmColor;
        let hbm_mask = icon_info.hbmMask;

        // We prefer the color bitmap; mask is usually monochrome
        let hbm_to_use = if hbm_color != 0 { hbm_color } else { hbm_mask };
        let is_monochrome = hbm_color == 0 && hbm_mask != 0;
        
        if hbm_to_use == 0 {
             eprintln!("[Win Icon Debug] Both color and mask bitmaps were null.");
            DestroyIcon(hicon); 
            return None;
        }
        
        let mut bmp: BITMAP = mem::zeroed();
        let res = GetObjectW(
            hbm_to_use,
            mem::size_of::<BITMAP>() as i32,
            &mut bmp as *mut BITMAP as *mut _,
        );

        if res == 0 {
            eprintln!("[Win Icon Debug] GetObjectW failed for bitmap handle: {}", hbm_to_use);
            DestroyIcon(hicon);
            if hbm_color != 0 { DeleteObject(hbm_color); }
            if hbm_mask != 0 { DeleteObject(hbm_mask); }
            return None;
        }
        
        let width = bmp.bmWidth as u32;
        let height = bmp.bmHeight as u32;
        let bits_per_pixel = bmp.bmBitsPixel as u32;
         eprintln!("[Win Icon Debug] Bitmap properties: Width={}, Height={}, BPP={}", width, height, bits_per_pixel);

        // Ensure width and height are reasonable
        if width == 0 || height == 0 || width > 2048 || height > 2048 { 
             eprintln!("[Win Icon Debug] Invalid bitmap dimensions.");
             DestroyIcon(hicon);
             if hbm_color != 0 { DeleteObject(hbm_color); }
             if hbm_mask != 0 { DeleteObject(hbm_mask); }
             return None;
        }

        // If we are forced to use the monochrome mask, it's difficult to render nicely.
        // Return None for simplicity, letting the frontend handle a default.
        if is_monochrome && bits_per_pixel == 1 {
            eprintln!("[Win Icon Debug] Using monochrome mask (1bpp), which is not well-supported for direct PNG conversion. Returning None.");
            DestroyIcon(hicon);
            // No need to DeleteObject hbm_color (it's 0), only hbm_mask
            if hbm_mask != 0 { DeleteObject(hbm_mask); }
            return None;
        }

        let buffer_size = (width * height * bits_per_pixel / 8) as usize;
        // Additional sanity check for buffer size to prevent large allocations
        if buffer_size == 0 || buffer_size > 16 * 1024 * 1024 { 
             eprintln!("[Win Icon Debug] Calculated buffer size is invalid or too large ({} bytes).", buffer_size);
             DestroyIcon(hicon);
             if hbm_color != 0 { DeleteObject(hbm_color); }
             if hbm_mask != 0 { DeleteObject(hbm_mask); }
             return None;
        }
        let mut buffer: Vec<u8> = vec![0; buffer_size];
        
        let res = GetBitmapBits(hbm_to_use, buffer_size as i32, buffer.as_mut_ptr() as *mut _);
        
        // Clean up GDI objects *after* copying bits, but before returning on error below
        // The HICON should be destroyed regardless of whether it came from SHGetFileInfoW or ImageList_GetIcon
        DestroyIcon(hicon); 
        // Only delete the bitmaps obtained from GetIconInfo
        if hbm_color != 0 { DeleteObject(hbm_color); }
        if hbm_mask != 0 { DeleteObject(hbm_mask); }
        
        if res == 0 {
            eprintln!("[Win Icon Debug] GetBitmapBits failed.");
            return None;
        }
        eprintln!("[Win Icon Debug] GetBitmapBits succeeded ({} bytes read). Converting to RGBA...", res);

        // Convert pixel data (likely BGRA or BGR) to RGBA
        let img_buffer_result = match bits_per_pixel {
            32 => { // Assuming BGRA
                 eprintln!("[Win Icon Debug] Processing 32bpp (BGRA -> RGBA)");
                 buffer.chunks_exact_mut(4).for_each(|chunk| chunk.swap(0, 2)); // BGRA -> RGBA
                 ImageBuffer::<Rgba<u8>, _>::from_raw(width, height, buffer)
            }
            24 => { // Assuming BGR
                 eprintln!("[Win Icon Debug] Processing 24bpp (BGR -> RGBA)");
                let mut rgba_buffer = Vec::with_capacity((width * height * 4) as usize);
                for chunk in buffer.chunks_exact(3) {
                    rgba_buffer.push(chunk[2]); // R
                    rgba_buffer.push(chunk[1]); // G
                    rgba_buffer.push(chunk[0]); // B
                    rgba_buffer.push(255);      // A (opaque)
                }
                ImageBuffer::<Rgba<u8>, _>::from_raw(width, height, rgba_buffer)
            }
            _ => {
                eprintln!("[Win Icon Debug] Unsupported bits per pixel: {}", bits_per_pixel);
                None
            } 
        }; 

        // Check if image buffer creation succeeded
        let img_buffer = match img_buffer_result {
            Some(buf) => {
                eprintln!("[Win Icon Debug] Image buffer created successfully.");
                buf
            },
            None => {
                eprintln!("[Win Icon Debug] Failed to create image buffer from raw data.");
                return None;
            }
        };

        // Encode as PNG into memory
        eprintln!("[Win Icon Debug] Encoding image buffer to PNG...");
        let mut png_buffer = Cursor::new(Vec::new());
        match img_buffer.write_to(&mut png_buffer, ImageOutputFormat::Png) {
            Ok(_) => {
                let base64_icon = general_purpose::STANDARD.encode(png_buffer.get_ref());
                let data_url = format!("data:image/png;base64,{}", base64_icon);
                eprintln!("[Win Icon Debug] PNG encoding successful. Returning data URL ({} bytes).", data_url.len());
                Some(data_url)
            },
            Err(e) => {
                 eprintln!("[Win Icon Debug] Failed to encode image buffer to PNG: {}", e);
                 None
            }
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
    // Try to use the last valid source app
    {
        let last_valid = LAST_VALID_SOURCE_APP.lock().unwrap();
        if let Some(last_app) = last_valid.clone() {
            return last_app;
        }
    }
    
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
                            tokio::time::sleep(std::time::Duration::from_millis(300)).await;
                            continue;
                        }
                        
                        let needs_update;
                        {
                            // Scope for the mutex lock
                            let mut last_text = CLIPBOARD_CACHE.lock().unwrap();
                            if *last_text != text {
                                *last_text = text.clone();
                                needs_update = true;
                            } else {
                                needs_update = false;
                            }
                        }

                        if needs_update {
                            // Get source app before any delay to improve accuracy
                            let source_app = get_frontmost_app();
                            
                            // Add a small delay to ensure the app focus has stabilized
                            // This helps when the user copies and immediately switches apps
                            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
                            
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
                    tokio::time::sleep(std::time::Duration::from_millis(300)).await;
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
