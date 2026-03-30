mod cli;
mod command;
mod desktop_api;
mod manifest;
mod webview;

use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use cli::{parse_host_args, parse_run_command_args};
use command::run_command;
use desktop_api::{start_desktop_api_server, DesktopApiState};
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

    let state = Arc::new(DesktopApiState {
        manifest: manifest.clone(),
    });
    let shutdown = Arc::new(AtomicBool::new(false));
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
        &options.app_url,
        &options.desktop_api_origin,
        shutdown.clone(),
    )?;

    #[allow(unreachable_code)]
    {
        shutdown.store(true, Ordering::SeqCst);
        Ok(())
    }
}
