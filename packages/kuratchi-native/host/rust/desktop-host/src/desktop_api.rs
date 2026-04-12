use std::fs;
use std::io::{Read, Write};
use std::net::{Shutdown, TcpListener, TcpStream};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::thread;
use std::time::Duration;

use base64::Engine;
use rfd::FileDialog;
use serde_json::{json, Value};

#[cfg(target_os = "windows")]
use winrt_notification::{Duration as ToastDuration, Sound, Toast};

use crate::cli::RunCommandOptions;
use crate::command::run_command;
use crate::interactive::{
    close_interactive, start_interactive, status_interactive, write_interactive,
    InteractiveCloseRequest, InteractiveStartRequest, InteractiveStatusRequest,
    InteractiveWriteRequest,
};
use crate::manifest::DesktopManifest;

#[derive(Clone)]
pub struct DesktopApiState {
    pub manifest: DesktopManifest,
}

pub fn build_initialization_script(desktop_api_origin: &str) -> String {
    let origin_json = serde_json::to_string(desktop_api_origin).unwrap_or_else(|_| "\"\"".to_string());
    format!(
        r#"(function() {{
  if (window.__kuratchiDesktop) return;
  const apiOrigin = {origin_json};
  async function desktopPost(path, body) {{
    const response = await fetch(new URL(path, apiOrigin), {{
      method: 'POST',
      headers: {{ 'content-type': 'application/json' }},
      body: JSON.stringify(body ?? {{}}),
      mode: 'cors',
      credentials: 'omit'
    }});
    const payload = await response.json().catch(() => null);
    if (!response.ok) {{
      throw new Error(payload?.error || `Desktop request failed with status ${{response.status}}.`);
    }}
    if (payload && payload.ok === false) {{
      throw new Error(payload.error || 'Desktop request failed.');
    }}
    return payload;
  }}
  window.__kuratchiDesktop = {{
    apiOrigin,
    async runCommand(command, options = {{}}) {{
      return await desktopPost('/commands/run', {{
        command: String(command || ''),
        workingDirectory: options.workingDirectory ?? null,
        timeoutMs: Number(options.timeoutMs) || 30000
      }});
    }},
    async openFile(options = {{}}) {{
      return await desktopPost('/files/open', {{
        title: options.title ?? null
      }});
    }}
  }};
  document.cookie = '__kuratchi_desktop_api=' + encodeURIComponent(apiOrigin) + '; path=/; SameSite=Lax';
}})();"#,
        origin_json = origin_json,
    )
}

pub fn parse_port_from_origin(origin: &str) -> Option<u16> {
    let stripped = origin.strip_prefix("http://127.0.0.1:")?;
    stripped.parse::<u16>().ok()
}

pub fn start_desktop_api_server(
    desktop_api_origin: String,
    state: Arc<DesktopApiState>,
    shutdown: Arc<AtomicBool>,
) -> Result<thread::JoinHandle<()>, String> {
    let port = parse_port_from_origin(&desktop_api_origin)
        .ok_or_else(|| format!("Invalid desktop API origin: {desktop_api_origin}"))?;
    let listener = TcpListener::bind(("127.0.0.1", port))
        .map_err(|error| format!("Failed to bind desktop API port {port}: {error}"))?;
    listener
        .set_nonblocking(true)
        .map_err(|error| format!("Failed to configure desktop API socket: {error}"))?;

    Ok(thread::spawn(move || {
        while !shutdown.load(Ordering::SeqCst) {
            match listener.accept() {
                Ok((mut stream, _)) => {
                    let _ = handle_connection(&mut stream, &state);
                    let _ = stream.shutdown(Shutdown::Both);
                }
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(25));
                }
                Err(_) => {
                    thread::sleep(Duration::from_millis(25));
                }
            }
        }
    }))
}

struct HttpRequest {
    method: String,
    target: String,
    body: Vec<u8>,
}

fn handle_connection(stream: &mut TcpStream, state: &DesktopApiState) -> Result<(), String> {
    let request = read_http_request(stream).map_err(|error| error.to_string())?;
    let (status, content_type, body) = route_request(&request, state);
    write_http_response(stream, status, content_type, &body).map_err(|error| error.to_string())
}

fn read_http_request(stream: &mut TcpStream) -> Result<HttpRequest, std::io::Error> {
    let mut buffer = Vec::new();
    let mut temp = [0u8; 4096];
    let mut headers_end = None;
    let mut content_length = 0usize;

    loop {
        let read = stream.read(&mut temp)?;
        if read == 0 {
            break;
        }
        buffer.extend_from_slice(&temp[..read]);
        if headers_end.is_none() {
            headers_end = find_subsequence(&buffer, b"\r\n\r\n");
            if let Some(index) = headers_end {
                let head = String::from_utf8_lossy(&buffer[..index + 4]);
                content_length = parse_content_length(&head).unwrap_or(0);
            }
        }
        if let Some(index) = headers_end {
            let body_start = index + 4;
            if buffer.len() >= body_start + content_length {
                break;
            }
        }
    }

    let headers_end = headers_end
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidData, "invalid request"))?;
    let header_text = String::from_utf8_lossy(&buffer[..headers_end]);
    let mut lines = header_text.split("\r\n");
    let request_line = lines.next().unwrap_or_default();
    let mut request_parts = request_line.split_whitespace();
    let method = request_parts.next().unwrap_or_default().to_string();
    let target = request_parts.next().unwrap_or_default().to_string();
    let body = buffer[headers_end + 4..].to_vec();

    Ok(HttpRequest { method, target, body })
}

fn find_subsequence(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack.windows(needle.len()).position(|window| window == needle)
}

fn parse_content_length(headers: &str) -> Option<usize> {
    headers.lines().find_map(|line| {
        line.strip_prefix("Content-Length:")
            .or_else(|| line.strip_prefix("content-length:"))
            .and_then(|value| value.trim().parse::<usize>().ok())
    })
}

fn route_request(request: &HttpRequest, state: &DesktopApiState) -> (u16, &'static str, String) {
    if request.method.eq_ignore_ascii_case("OPTIONS") {
        return (204, "application/json", String::new());
    }

    if request.method.eq_ignore_ascii_case("GET") && request.target == "/health" {
        return (200, "application/json", json!({ "ok": true }).to_string());
    }

    if request.method.eq_ignore_ascii_case("POST")
        && (request.target == "/notifications/show" || request.target == "/__desktop/notify")
    {
        let body: Value = serde_json::from_slice(&request.body).unwrap_or_else(|_| json!({}));
        let title = body.get("title").and_then(Value::as_str).unwrap_or("").trim();
        if title.is_empty() {
            return (
                400,
                "application/json",
                json!({ "ok": false, "error": "missing-title" }).to_string(),
            );
        }
        let shown = show_notification(
            state,
            title,
            body.get("body").and_then(Value::as_str).unwrap_or_default(),
        );
        return (200, "application/json", json!({ "ok": shown }).to_string());
    }

    if request.method.eq_ignore_ascii_case("POST") && request.target == "/commands/run" {
        let body: Value = serde_json::from_slice(&request.body).unwrap_or_else(|_| json!({}));
        let command = body
            .get("command")
            .and_then(Value::as_str)
            .unwrap_or("")
            .trim()
            .to_string();
        if command.is_empty() {
            return (
                400,
                "application/json",
                json!({ "ok": false, "error": "Command text is required." }).to_string(),
            );
        }
        let timeout_ms = body.get("timeoutMs").and_then(Value::as_u64).unwrap_or(30_000);
        let working_directory = body
            .get("workingDirectory")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned)
            .filter(|value| !value.trim().is_empty());
        let result = run_command(RunCommandOptions {
            command,
            working_directory,
            timeout_ms,
        });
        return (
            200,
            "application/json",
            json!({
                "ok": result.ok,
                "error": result.error,
                "exitCode": result.exit_code,
                "durationMs": result.duration_ms,
                "stdout": result.stdout,
                "stderr": result.stderr,
            })
            .to_string(),
        );
    }

    if request.method.eq_ignore_ascii_case("POST") && request.target == "/files/open" {
        let body: Value = serde_json::from_slice(&request.body).unwrap_or_else(|_| json!({}));
        let title = body.get("title").and_then(Value::as_str).map(ToOwned::to_owned);
        let result = open_file(state, title);
        return (200, "application/json", result.to_string());
    }

    // Interactive command endpoints
    if request.method.eq_ignore_ascii_case("POST") && request.target == "/interactive/start" {
        let body: Value = serde_json::from_slice(&request.body).unwrap_or_else(|_| json!({}));
        let req = InteractiveStartRequest {
            command: body
                .get("command")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
            working_directory: body
                .get("workingDirectory")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
                .filter(|v| !v.is_empty()),
            timeout_ms: body.get("timeoutMs").and_then(Value::as_u64),
        };
        let result = start_interactive(req);
        return (
            200,
            "application/json",
            json!({
                "ok": result.ok,
                "sessionId": result.session_id,
                "error": result.error,
            })
            .to_string(),
        );
    }

    if request.method.eq_ignore_ascii_case("POST") && request.target == "/interactive/write" {
        let body: Value = serde_json::from_slice(&request.body).unwrap_or_else(|_| json!({}));
        let req = InteractiveWriteRequest {
            session_id: body
                .get("sessionId")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
            input: body
                .get("input")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
        };
        let result = write_interactive(req);
        return (
            200,
            "application/json",
            json!({
                "ok": result.ok,
                "error": result.error,
            })
            .to_string(),
        );
    }

    if request.method.eq_ignore_ascii_case("POST") && request.target == "/interactive/status" {
        let body: Value = serde_json::from_slice(&request.body).unwrap_or_else(|_| json!({}));
        let req = InteractiveStatusRequest {
            session_id: body
                .get("sessionId")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
        };
        let result = status_interactive(req);
        return (
            200,
            "application/json",
            json!({
                "ok": result.ok,
                "output": result.output,
                "isComplete": result.is_complete,
                "exitCode": result.exit_code,
                "error": result.error,
            })
            .to_string(),
        );
    }

    if request.method.eq_ignore_ascii_case("POST") && request.target == "/interactive/close" {
        let body: Value = serde_json::from_slice(&request.body).unwrap_or_else(|_| json!({}));
        let req = InteractiveCloseRequest {
            session_id: body
                .get("sessionId")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
        };
        let result = close_interactive(req);
        return (
            200,
            "application/json",
            json!({
                "ok": result.ok,
                "error": result.error,
            })
            .to_string(),
        );
    }

    (
        404,
        "application/json",
        json!({ "ok": false, "error": "desktop-api-not-found" }).to_string(),
    )
}

fn write_http_response(
    stream: &mut TcpStream,
    status: u16,
    content_type: &'static str,
    body: &str,
) -> Result<(), std::io::Error> {
    let status_text = match status {
        200 => "OK",
        204 => "No Content",
        400 => "Bad Request",
        404 => "Not Found",
        _ => "OK",
    };
    let response = format!(
        "HTTP/1.1 {status} {status_text}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: content-type, x-kuratchi-desktop-api-origin, x-kuratchi-desktop-origin\r\n\r\n{}",
        body.len(),
        body
    );
    stream.write_all(response.as_bytes())?;
    stream.flush()
}

#[cfg(target_os = "windows")]
fn show_notification(state: &DesktopApiState, title: &str, body: &str) -> bool {
    if !state.manifest.bindings.desktop.notifications {
        return false;
    }
    let app_id = if state.manifest.app.id.is_empty() {
        Toast::POWERSHELL_APP_ID.to_string()
    } else {
        state.manifest.app.id.clone()
    };
    let toast = if body.trim().is_empty() {
        Toast::new(&app_id)
            .title(title)
            .duration(ToastDuration::Short)
            .sound(Some(Sound::Default))
    } else {
        Toast::new(&app_id)
            .title(title)
            .text1(body)
            .duration(ToastDuration::Short)
            .sound(Some(Sound::Default))
    };
    toast.show().is_ok()
}

#[cfg(not(target_os = "windows"))]
fn show_notification(state: &DesktopApiState, _title: &str, _body: &str) -> bool {
    if !state.manifest.bindings.desktop.notifications {
        return false;
    }
    // macOS notifications not yet implemented
    false
}

fn open_file(state: &DesktopApiState, title: Option<String>) -> Value {
    if !state.manifest.bindings.desktop.files {
        return json!({ "ok": false, "error": "Desktop file access is disabled." });
    }

    let mut dialog = FileDialog::new();
    if let Some(title) = title.as_deref().filter(|value| !value.trim().is_empty()) {
        dialog = dialog.set_title(title);
    }

    let Some(path) = dialog.pick_file() else {
        return json!({ "ok": false, "error": "File selection cancelled." });
    };

    match fs::read(&path) {
        Ok(bytes) => {
            let name = path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or_default()
                .to_string();
            let content_base64 = base64::engine::general_purpose::STANDARD.encode(bytes.as_slice());
            json!({
                "ok": true,
                "path": path.to_string_lossy().to_string(),
                "name": name,
                "contentBase64": content_base64,
                "size": bytes.len(),
            })
        }
        Err(error) => json!({ "ok": false, "error": format!("Selected file could not be read: {error}") }),
    }
}
