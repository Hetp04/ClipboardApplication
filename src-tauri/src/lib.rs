// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use once_cell::sync::Lazy;
use std::sync::Mutex;
use arboard::Clipboard;
use tauri::Emitter;

// Cache for the last clipboard value to avoid emitting duplicate events
static CLIPBOARD_CACHE: Lazy<Mutex<String>> = Lazy::new(|| Mutex::new(String::new()));

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .setup(|app| {
            // Get the app handle for the background task
            let app_handle = app.handle().clone();
            
            // Spawn a background task to poll the clipboard
            tauri::async_runtime::spawn(async move {
                // Note: On macOS, clipboard access might require "Screen Recording" or 
                // "Accessibility" permissions. The user may need to grant these in System Preferences.
                
                // Create a clipboard instance
                let mut clipboard = match Clipboard::new() {
                    Ok(clipboard) => clipboard,
                    Err(e) => {
                        eprintln!("Failed to initialize clipboard: {}", e);
                        return;
                    }
                };
                
                loop {
                    // Poll the clipboard for text
                    if let Ok(text) = clipboard.get_text() {
                        // Skip empty text
                        if text.is_empty() {
                            tokio::time::sleep(std::time::Duration::from_millis(750)).await;
                            continue;
                        }
                        
                        // Check if the text is different from the last value
                        let mut last_text = CLIPBOARD_CACHE.lock().unwrap();
                        if *last_text != text {
                            // Update the cache
                            *last_text = text.clone();
                            
                            // Log to the console
                            println!(r#"Copied: "{text}""#);
                            
                            // Emit an event to the frontend
                            if let Err(e) = app_handle.emit("clipboard-new-text", text) {
                                eprintln!("Failed to emit clipboard event: {}", e);
                            }
                        }
                    }
                    
                    // Wait before polling again
                    tokio::time::sleep(std::time::Duration::from_millis(750)).await;
                }
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
