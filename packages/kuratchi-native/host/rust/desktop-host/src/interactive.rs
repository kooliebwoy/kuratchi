use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufReader, Read, Write};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use uuid::Uuid;

/// An interactive PTY session for commands that require user input.
pub struct InteractiveSession {
    writer: Box<dyn Write + Send>,
    output_buffer: Arc<Mutex<String>>,
    is_complete: Arc<Mutex<bool>>,
    exit_code: Arc<Mutex<Option<i32>>>,
}

/// Global session storage
lazy_static::lazy_static! {
    static ref SESSIONS: Mutex<HashMap<String, InteractiveSession>> = Mutex::new(HashMap::new());
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InteractiveStartRequest {
    pub command: String,
    pub working_directory: Option<String>,
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InteractiveStartResult {
    pub ok: bool,
    pub session_id: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InteractiveWriteRequest {
    pub session_id: String,
    pub input: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InteractiveWriteResult {
    pub ok: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InteractiveStatusRequest {
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InteractiveStatusResult {
    pub ok: bool,
    pub output: String,
    pub is_complete: bool,
    pub exit_code: Option<i32>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InteractiveCloseRequest {
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InteractiveCloseResult {
    pub ok: bool,
    pub error: Option<String>,
}

/// Start an interactive command session.
/// Returns a session ID that can be used to write input and read output.
pub fn start_interactive(request: InteractiveStartRequest) -> InteractiveStartResult {
    let command = request.command.trim();
    if command.is_empty() {
        return InteractiveStartResult {
            ok: false,
            session_id: None,
            error: Some("Command cannot be empty".to_string()),
        };
    }

    let session_id = Uuid::new_v4().to_string();
    let pty_system = native_pty_system();

    let pair = match pty_system.openpty(PtySize {
        rows: 24,
        cols: 80,
        pixel_width: 0,
        pixel_height: 0,
    }) {
        Ok(pair) => pair,
        Err(e) => {
            return InteractiveStartResult {
                ok: false,
                session_id: None,
                error: Some(format!("Failed to open PTY: {}", e)),
            };
        }
    };

    #[cfg(windows)]
    let mut cmd = {
        let mut c = CommandBuilder::new("cmd.exe");
        c.args(["/d", "/s", "/c", command]);
        c
    };

    #[cfg(not(windows))]
    let mut cmd = {
        let mut c = CommandBuilder::new("sh");
        c.args(["-c", command]);
        c
    };

    cmd.env("TERM", "xterm-256color");
    cmd.env("LANG", "en_US.UTF-8");

    if let Some(ref cwd) = request.working_directory {
        if !cwd.is_empty() {
            cmd.cwd(cwd);
        }
    }

    let mut child = match pair.slave.spawn_command(cmd) {
        Ok(child) => child,
        Err(e) => {
            return InteractiveStartResult {
                ok: false,
                session_id: None,
                error: Some(format!("Failed to spawn command: {}", e)),
            };
        }
    };

    drop(pair.slave);

    let reader = match pair.master.try_clone_reader() {
        Ok(r) => r,
        Err(e) => {
            return InteractiveStartResult {
                ok: false,
                session_id: None,
                error: Some(format!("Failed to get reader: {}", e)),
            };
        }
    };

    let writer = match pair.master.take_writer() {
        Ok(w) => w,
        Err(e) => {
            return InteractiveStartResult {
                ok: false,
                session_id: None,
                error: Some(format!("Failed to get writer: {}", e)),
            };
        }
    };

    let output_buffer = Arc::new(Mutex::new(String::new()));
    let is_complete = Arc::new(Mutex::new(false));
    let exit_code = Arc::new(Mutex::new(None));

    // Reader thread: accumulate output
    let output_clone = Arc::clone(&output_buffer);
    let complete_clone = Arc::clone(&is_complete);
    std::thread::spawn(move || {
        let mut buf_reader = BufReader::new(reader);
        let mut buf = vec![0u8; 4096];
        loop {
            match buf_reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    if let Ok(mut output) = output_clone.lock() {
                        output.push_str(&data);
                    }
                }
                Err(_) => break,
            }
        }
        if let Ok(mut complete) = complete_clone.lock() {
            *complete = true;
        }
    });

    // Wait thread: track exit code
    let exit_clone = Arc::clone(&exit_code);
    let complete_clone2 = Arc::clone(&is_complete);
    let timeout_ms = request.timeout_ms.unwrap_or(60_000);
    std::thread::spawn(move || {
        let deadline = Instant::now() + Duration::from_millis(timeout_ms);
        loop {
            match child.try_wait() {
                Ok(Some(status)) => {
                    if let Ok(mut code) = exit_clone.lock() {
                        *code = Some(status.exit_code() as i32);
                    }
                    if let Ok(mut complete) = complete_clone2.lock() {
                        *complete = true;
                    }
                    break;
                }
                Ok(None) => {
                    if Instant::now() >= deadline {
                        let _ = child.kill();
                        if let Ok(mut code) = exit_clone.lock() {
                            *code = Some(124); // timeout
                        }
                        if let Ok(mut complete) = complete_clone2.lock() {
                            *complete = true;
                        }
                        break;
                    }
                    std::thread::sleep(Duration::from_millis(50));
                }
                Err(_) => {
                    if let Ok(mut complete) = complete_clone2.lock() {
                        *complete = true;
                    }
                    break;
                }
            }
        }
    });

    let session = InteractiveSession {
        writer,
        output_buffer,
        is_complete,
        exit_code,
    };

    if let Ok(mut sessions) = SESSIONS.lock() {
        sessions.insert(session_id.clone(), session);
    }

    InteractiveStartResult {
        ok: true,
        session_id: Some(session_id),
        error: None,
    }
}

/// Write input to an interactive session (e.g., "y\n" for yes).
pub fn write_interactive(request: InteractiveWriteRequest) -> InteractiveWriteResult {
    let mut sessions = match SESSIONS.lock() {
        Ok(s) => s,
        Err(_) => {
            return InteractiveWriteResult {
                ok: false,
                error: Some("Failed to lock sessions".to_string()),
            };
        }
    };

    let session = match sessions.get_mut(&request.session_id) {
        Some(s) => s,
        None => {
            return InteractiveWriteResult {
                ok: false,
                error: Some("Session not found".to_string()),
            };
        }
    };

    if let Err(e) = session.writer.write_all(request.input.as_bytes()) {
        return InteractiveWriteResult {
            ok: false,
            error: Some(format!("Failed to write: {}", e)),
        };
    }

    if let Err(e) = session.writer.flush() {
        return InteractiveWriteResult {
            ok: false,
            error: Some(format!("Failed to flush: {}", e)),
        };
    }

    InteractiveWriteResult {
        ok: true,
        error: None,
    }
}

/// Get the current status and output of an interactive session.
pub fn status_interactive(request: InteractiveStatusRequest) -> InteractiveStatusResult {
    let sessions = match SESSIONS.lock() {
        Ok(s) => s,
        Err(_) => {
            return InteractiveStatusResult {
                ok: false,
                output: String::new(),
                is_complete: false,
                exit_code: None,
                error: Some("Failed to lock sessions".to_string()),
            };
        }
    };

    let session = match sessions.get(&request.session_id) {
        Some(s) => s,
        None => {
            return InteractiveStatusResult {
                ok: false,
                output: String::new(),
                is_complete: false,
                exit_code: None,
                error: Some("Session not found".to_string()),
            };
        }
    };

    let output = session
        .output_buffer
        .lock()
        .map(|o| o.clone())
        .unwrap_or_default();
    let is_complete = session.is_complete.lock().map(|c| *c).unwrap_or(false);
    let exit_code = session.exit_code.lock().ok().and_then(|c| *c);

    InteractiveStatusResult {
        ok: true,
        output,
        is_complete,
        exit_code,
        error: None,
    }
}

/// Close and clean up an interactive session.
pub fn close_interactive(request: InteractiveCloseRequest) -> InteractiveCloseResult {
    let mut sessions = match SESSIONS.lock() {
        Ok(s) => s,
        Err(_) => {
            return InteractiveCloseResult {
                ok: false,
                error: Some("Failed to lock sessions".to_string()),
            };
        }
    };

    if sessions.remove(&request.session_id).is_some() {
        InteractiveCloseResult {
            ok: true,
            error: None,
        }
    } else {
        InteractiveCloseResult {
            ok: false,
            error: Some("Session not found".to_string()),
        }
    }
}
