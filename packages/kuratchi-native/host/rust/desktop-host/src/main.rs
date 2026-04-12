mod cli;
mod command;
mod desktop_api;
mod embedded_server;
mod interactive;
mod manifest;
mod webview;

use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use cli::{parse_host_args, parse_run_command_args};
use command::run_command;
use desktop_api::{start_desktop_api_server, DesktopApiState};
use embedded_server::EmbeddedServer;
use manifest::load_manifest;
use webview::run_webview;

fn main() {
    if let Err(error) = run_main() {
        eprintln!("[workerd-desktop-host] {error}");
        std::process::exit(1);
    }
}

fn run_main() -> Result<(), String> {
    let args: Vec<String> = std::env::args().collect();

    if let Some(command_options) = parse_run_command_args(&args)? {
        let result = run_command(command_options);
        println!("launched=true");
        println!("exitCode={}", result.exit_code);
        println!("durationMs={}", result.duration_ms);
        if !result.stdout.is_empty() {
            println!("stdout:\n{}", result.stdout);
        }
        if !result.stderr.is_empty() {
            println!("stderr:\n{}", result.stderr);
        }
        if let Some(error) = result.error {
            eprintln!("error={error}");
            return Err("Command failed.".into());
        }
        if result.exit_code != 0 {
            return Err(format!("Command exited with code {}.", result.exit_code));
        }
        return Ok(());
    }

    let options = parse_host_args(&args)?;
    let manifest = load_manifest(&options.manifest_path)?;
    let title = if manifest.app.window.title.is_empty() {
        manifest.app.name.clone()
    } else {
        manifest.app.window.title.clone()
    };

    println!("[workerd-desktop-host] manifest loaded from {}", options.manifest_path.display());
    if !manifest.app.name.is_empty() {
        println!("[workerd-desktop-host] app name: {}", manifest.app.name);
    }
    if !title.is_empty() {
        println!("[workerd-desktop-host] window title: {title}");
    }

    let shutdown = Arc::new(AtomicBool::new(false));

    // Start embedded server if in embedded mode (production build)
    let _embedded_handle = if options.embedded {
        let worker_bundle = options.worker_bundle
            .as_ref()
            .ok_or_else(|| "--embedded requires --worker-bundle".to_string())?
            .to_string_lossy()
            .to_string();

        // Get assets root from manifest
        let assets_root = if let Some(ref root) = manifest.runtime.assets_root {
            if !root.is_empty() {
                // Resolve relative to manifest directory
                let manifest_dir = options.manifest_path.parent().unwrap_or(std::path::Path::new("."));
                Some(manifest_dir.join(root).to_string_lossy().to_string())
            } else {
                None
            }
        } else {
            None
        };

        println!("[workerd-desktop-host] Starting embedded server on port {}", options.port);
        let server = EmbeddedServer::new(
            options.port,
            worker_bundle,
            assets_root,
            shutdown.clone(),
        );
        Some(server.start()?)
    } else {
        None
    };

    // Determine app URL
    let app_url = if options.embedded {
        format!("http://127.0.0.1:{}{}", options.port, manifest.app.initial_path)
    } else {
        options.app_url.clone()
    };

    // Start desktop API server if origin provided
    let state = Arc::new(DesktopApiState {
        manifest: manifest.clone(),
    });
    let _server_handle = if options.desktop_api_origin.is_empty() {
        None
    } else {
        Some(start_desktop_api_server(
            options.desktop_api_origin.clone(),
            state,
            shutdown.clone(),
        )?)
    };

    run_webview(
        &manifest,
        &app_url,
        &options.desktop_api_origin,
        shutdown.clone(),
    )?;

    #[allow(unreachable_code)]
    {
        shutdown.store(true, Ordering::SeqCst);
        Ok(())
    }
}
