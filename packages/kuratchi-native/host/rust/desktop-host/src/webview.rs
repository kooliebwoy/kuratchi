use std::net::TcpStream;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use tao::dpi::LogicalSize;
use tao::event::{Event, WindowEvent};
use tao::event_loop::{ControlFlow, EventLoop};
use tao::window::WindowBuilder;
use wry::WebViewBuilder;

use crate::desktop_api::{build_initialization_script, parse_port_from_origin};
use crate::manifest::DesktopManifest;

#[cfg(target_os = "macos")]
fn setup_macos_menu() {
    use muda::{Menu, PredefinedMenuItem, Submenu};
    
    let menu = Menu::new();
    
    // App menu (required on macOS)
    let app_menu = Submenu::new("App", true);
    let _ = app_menu.append(&PredefinedMenuItem::quit(None));
    let _ = menu.append(&app_menu);
    
    // Edit menu with clipboard operations - REQUIRED for WKWebView clipboard to work
    let edit_menu = Submenu::new("Edit", true);
    let _ = edit_menu.append(&PredefinedMenuItem::undo(None));
    let _ = edit_menu.append(&PredefinedMenuItem::redo(None));
    let _ = edit_menu.append(&PredefinedMenuItem::separator());
    let _ = edit_menu.append(&PredefinedMenuItem::cut(None));
    let _ = edit_menu.append(&PredefinedMenuItem::copy(None));
    let _ = edit_menu.append(&PredefinedMenuItem::paste(None));
    let _ = edit_menu.append(&PredefinedMenuItem::select_all(None));
    let _ = menu.append(&edit_menu);
    
    // Initialize the menu bar for the application
    let _ = menu.init_for_nsapp();
}

pub fn run_webview(
    manifest: &DesktopManifest,
    app_url: &str,
    desktop_api_origin: &str,
    shutdown: Arc<AtomicBool>,
) -> Result<(), String> {
    let title = if manifest.app.window.title.is_empty() {
        manifest.app.name.clone()
    } else {
        manifest.app.window.title.clone()
    };

    // Set up macOS menu bar with Edit menu (required for clipboard in WKWebView)
    #[cfg(target_os = "macos")]
    setup_macos_menu();

    let event_loop = EventLoop::new();
    let window = WindowBuilder::new()
        .with_title(if title.is_empty() { "workerd-desktop-host" } else { &title })
        .with_inner_size(LogicalSize::new(
            manifest.app.window.width.max(1),
            manifest.app.window.height.max(1),
        ))
        .build(&event_loop)
        .map_err(|error| format!("Failed to create native window: {error}"))?;

    let initialization_script = build_initialization_script(desktop_api_origin);
    
    // Add cache-busting timestamp to URL to force fresh load
    let cache_bust_url = format!("{}?_cb={}", app_url, std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0));
    
    let webview = WebViewBuilder::new()
        .with_initialization_script(&initialization_script)
        .with_url(&cache_bust_url)
        .with_clipboard(true)
        .with_devtools(true)
        .build(&window)
        .map_err(|error| format!("Failed to build embedded webview: {error}"))?;

    // Open devtools automatically for development
    // TODO: Make this configurable via manifest or env var
    webview.open_devtools();

    let desktop_api_origin = desktop_api_origin.to_string();
    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;
        if let Event::WindowEvent {
            event: WindowEvent::CloseRequested,
            ..
        } = event
        {
            shutdown.store(true, Ordering::SeqCst);
            if let Some(port) = parse_port_from_origin(&desktop_api_origin) {
                let _ = TcpStream::connect(("127.0.0.1", port));
            }
            *control_flow = ControlFlow::Exit;
        }
    });

    #[allow(unreachable_code)]
    Ok(())
}
