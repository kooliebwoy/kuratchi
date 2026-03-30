use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct HostOptions {
    pub manifest_path: PathBuf,
    pub app_url: String,
    pub desktop_api_origin: String,
}

#[derive(Debug)]
pub struct RunCommandOptions {
    pub command: String,
    pub working_directory: Option<String>,
    pub timeout_ms: u64,
}

pub fn parse_host_args(args: &[String]) -> Result<HostOptions, String> {
    let mut manifest_path: Option<PathBuf> = None;
    let mut app_url = String::from("http://127.0.0.1:8787/");
    let mut desktop_api_origin = String::new();

    let mut index = 1usize;
    while index < args.len() {
        match args[index].as_str() {
            "--manifest" => {
                index += 1;
                manifest_path = args.get(index).map(PathBuf::from);
            }
            "--app-url" => {
                index += 1;
                app_url = args
                    .get(index)
                    .cloned()
                    .ok_or_else(|| "Missing value for --app-url".to_string())?;
            }
            "--desktop-api-origin" => {
                index += 1;
                desktop_api_origin = args
                    .get(index)
                    .cloned()
                    .ok_or_else(|| "Missing value for --desktop-api-origin".to_string())?;
            }
            "--run-command" | "--cwd" | "--timeout-ms" => {
                index += 1;
            }
            _ => {}
        }
        index += 1;
    }

    let manifest_path = manifest_path.ok_or_else(|| {
        "Usage: workerd-desktop-host --manifest <path> [--app-url <url>] [--desktop-api-origin <url>]".to_string()
    })?;

    Ok(HostOptions {
        manifest_path,
        app_url,
        desktop_api_origin,
    })
}

pub fn parse_run_command_args(args: &[String]) -> Result<Option<RunCommandOptions>, String> {
    let mut command: Option<String> = None;
    let mut working_directory: Option<String> = None;
    let mut timeout_ms = 30_000u64;

    let mut index = 1usize;
    while index < args.len() {
        match args[index].as_str() {
            "--run-command" => {
                index += 1;
                command = args.get(index).cloned();
            }
            "--cwd" => {
                index += 1;
                working_directory = args.get(index).cloned();
            }
            "--timeout-ms" => {
                index += 1;
                timeout_ms = args
                    .get(index)
                    .ok_or_else(|| "Missing value for --timeout-ms".to_string())?
                    .parse::<u64>()
                    .map_err(|_| "Invalid timeout supplied to --timeout-ms".to_string())?;
            }
            _ => {}
        }
        index += 1;
    }

    Ok(command.map(|command| RunCommandOptions {
        command,
        working_directory,
        timeout_ms,
    }))
}
