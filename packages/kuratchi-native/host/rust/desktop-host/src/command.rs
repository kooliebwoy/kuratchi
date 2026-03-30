use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use crate::cli::RunCommandOptions;

#[derive(Debug, Clone)]
pub struct CommandResult {
    pub ok: bool,
    pub error: Option<String>,
    pub exit_code: i32,
    pub duration_ms: u128,
    pub stdout: String,
    pub stderr: String,
}

pub fn run_command(options: RunCommandOptions) -> CommandResult {
    let started = Instant::now();
    if options.command.trim().is_empty() {
        return CommandResult {
            ok: false,
            error: Some(String::from("Command text is required.")),
            exit_code: -1,
            duration_ms: 0,
            stdout: String::new(),
            stderr: String::new(),
        };
    }

    let mut command = Command::new("cmd.exe");
    command
        .arg("/d")
        .arg("/s")
        .arg("/c")
        .arg(&options.command)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(working_directory) = options.working_directory.as_deref() {
        command.current_dir(working_directory);
    }

    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(error) => {
            return CommandResult {
                ok: false,
                error: Some(format!("Failed to launch desktop command: {error}")),
                exit_code: -1,
                duration_ms: started.elapsed().as_millis(),
                stdout: String::new(),
                stderr: String::new(),
            };
        }
    };

    let deadline = Instant::now() + Duration::from_millis(options.timeout_ms);
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    let output = child.wait_with_output().ok();
                    return CommandResult {
                        ok: false,
                        error: Some(String::from("Command timed out.")),
                        exit_code: 124,
                        duration_ms: started.elapsed().as_millis(),
                        stdout: output
                            .as_ref()
                            .map(|value| String::from_utf8_lossy(&value.stdout).to_string())
                            .unwrap_or_default(),
                        stderr: output
                            .as_ref()
                            .map(|value| String::from_utf8_lossy(&value.stderr).to_string())
                            .unwrap_or_default(),
                    };
                }
                thread::sleep(Duration::from_millis(25));
            }
            Err(error) => {
                return CommandResult {
                    ok: false,
                    error: Some(format!("Failed to wait for command: {error}")),
                    exit_code: -1,
                    duration_ms: started.elapsed().as_millis(),
                    stdout: String::new(),
                    stderr: String::new(),
                };
            }
        }
    }

    match child.wait_with_output() {
        Ok(output) => {
            let exit_code = output.status.code().unwrap_or(-1);
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            CommandResult {
                ok: output.status.success(),
                error: if output.status.success() {
                    None
                } else {
                    Some(format!("Command exited with code {exit_code}."))
                },
                exit_code,
                duration_ms: started.elapsed().as_millis(),
                stdout,
                stderr,
            }
        }
        Err(error) => CommandResult {
            ok: false,
            error: Some(format!("Failed to capture command output: {error}")),
            exit_code: -1,
            duration_ms: started.elapsed().as_millis(),
            stdout: String::new(),
            stderr: String::new(),
        },
    }
}
