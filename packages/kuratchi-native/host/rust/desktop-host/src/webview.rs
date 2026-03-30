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
    let _webview = WebViewBuilder::new()
        .with_initialization_script(&initialization_script)
        .with_url(app_url)
        .build(&window)
        .map_err(|error| format!("Failed to build embedded webview: {error}"))?;

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
