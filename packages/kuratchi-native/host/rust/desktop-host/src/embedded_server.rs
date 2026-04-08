use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;

pub struct EmbeddedServer {
    port: u16,
    worker_bundle: String,
    assets_root: Option<String>,
    shutdown: Arc<AtomicBool>,
}

impl EmbeddedServer {
    pub fn new(
        port: u16,
        worker_bundle: String,
        assets_root: Option<String>,
        shutdown: Arc<AtomicBool>,
    ) -> Self {
        Self {
            port,
            worker_bundle,
            assets_root,
            shutdown,
        }
    }

    pub fn start(self) -> Result<thread::JoinHandle<()>, String> {
        let addr = format!("127.0.0.1:{}", self.port);
        let listener = TcpListener::bind(&addr)
            .map_err(|e| format!("Failed to bind to {}: {}", addr, e))?;

        listener
            .set_nonblocking(true)
            .map_err(|e| format!("Failed to set non-blocking: {}", e))?;

        println!("[embedded-server] Listening on http://{}", addr);

        let handle = thread::spawn(move || {
            self.run_server(listener);
        });

        Ok(handle)
    }

    fn run_server(self, listener: TcpListener) {
        loop {
            if self.shutdown.load(Ordering::SeqCst) {
                println!("[embedded-server] Shutting down...");
                break;
            }

            match listener.accept() {
                Ok((stream, _)) => {
                    let worker_bundle = self.worker_bundle.clone();
                    let assets_root = self.assets_root.clone();
                    thread::spawn(move || {
                        if let Err(e) = handle_connection(stream, &worker_bundle, assets_root.as_deref()) {
                            eprintln!("[embedded-server] Connection error: {}", e);
                        }
                    });
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(std::time::Duration::from_millis(10));
                }
                Err(e) => {
                    eprintln!("[embedded-server] Accept error: {}", e);
                }
            }
        }
    }
}

fn handle_connection(
    mut stream: TcpStream,
    worker_bundle: &str,
    assets_root: Option<&str>,
) -> Result<(), String> {
    let mut reader = BufReader::new(&stream);
    let mut request_line = String::new();
    reader
        .read_line(&mut request_line)
        .map_err(|e| format!("Failed to read request: {}", e))?;

    let parts: Vec<&str> = request_line.trim().split_whitespace().collect();
    if parts.len() < 2 {
        return send_response(&mut stream, 400, "text/plain", b"Bad Request");
    }

    let method = parts[0];
    let path = parts[1];

    // Read headers
    let mut headers = HashMap::new();
    loop {
        let mut line = String::new();
        reader
            .read_line(&mut line)
            .map_err(|e| format!("Failed to read header: {}", e))?;
        let line = line.trim();
        if line.is_empty() {
            break;
        }
        if let Some((key, value)) = line.split_once(':') {
            headers.insert(key.trim().to_lowercase(), value.trim().to_string());
        }
    }

    // Read body if present
    let content_length: usize = headers
        .get("content-length")
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);

    let mut body = vec![0u8; content_length];
    if content_length > 0 {
        reader
            .read_exact(&mut body)
            .map_err(|e| format!("Failed to read body: {}", e))?;
    }

    // Route the request
    match (method, path) {
        ("GET", "/") | ("GET", "/index.html") => {
            // Serve the main HTML page
            let html = generate_index_html(worker_bundle);
            send_response(&mut stream, 200, "text/html; charset=utf-8", html.as_bytes())
        }
        ("GET", p) if p.starts_with("/assets/") => {
            // Serve static assets
            if let Some(assets_root) = assets_root {
                let asset_path = Path::new(assets_root).join(&p[1..]); // Remove leading /
                serve_static_file(&mut stream, &asset_path)
            } else {
                send_response(&mut stream, 404, "text/plain", b"Not Found")
            }
        }
        ("GET", p) => {
            // For any other GET request, serve the SPA shell
            let html = generate_index_html(worker_bundle);
            send_response(&mut stream, 200, "text/html; charset=utf-8", html.as_bytes())
        }
        _ => send_response(&mut stream, 405, "text/plain", b"Method Not Allowed"),
    }
}

fn generate_index_html(worker_bundle: &str) -> String {
    // Read the worker bundle to extract any pre-rendered HTML
    // For now, we generate a minimal shell that could be enhanced
    let worker_content = fs::read_to_string(worker_bundle).unwrap_or_default();

    // Check if the worker bundle contains pre-rendered HTML
    // This is a simplified approach - in production, we'd want to
    // actually execute the worker or use pre-rendered output
    format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kuratchi App</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }}
        .loading {{
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            font-size: 18px;
            color: #666;
        }}
    </style>
</head>
<body>
    <div id="app">
        <div class="loading">Loading...</div>
    </div>
    <script type="module">
        // Worker bundle loaded: {} bytes
        // In production, this would execute the pre-rendered content
        console.log('[kuratchi-native] App loaded in embedded mode');
    </script>
</body>
</html>"#,
        worker_content.len()
    )
}

fn serve_static_file(stream: &mut TcpStream, path: &Path) -> Result<(), String> {
    if !path.exists() {
        return send_response(stream, 404, "text/plain", b"Not Found");
    }

    let content = fs::read(path).map_err(|e| format!("Failed to read file: {}", e))?;

    let content_type = match path.extension().and_then(|e| e.to_str()) {
        Some("html") => "text/html; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("js") => "application/javascript; charset=utf-8",
        Some("json") => "application/json; charset=utf-8",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("svg") => "image/svg+xml",
        Some("ico") => "image/x-icon",
        Some("woff") => "font/woff",
        Some("woff2") => "font/woff2",
        Some("ttf") => "font/ttf",
        _ => "application/octet-stream",
    };

    send_response(stream, 200, content_type, &content)
}

fn send_response(
    stream: &mut TcpStream,
    status: u16,
    content_type: &str,
    body: &[u8],
) -> Result<(), String> {
    let status_text = match status {
        200 => "OK",
        400 => "Bad Request",
        404 => "Not Found",
        405 => "Method Not Allowed",
        500 => "Internal Server Error",
        _ => "Unknown",
    };

    let response = format!(
        "HTTP/1.1 {} {}\r\n\
         Content-Type: {}\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\
         \r\n",
        status, status_text, content_type, body.len()
    );

    stream
        .write_all(response.as_bytes())
        .map_err(|e| format!("Failed to write response header: {}", e))?;
    stream
        .write_all(body)
        .map_err(|e| format!("Failed to write response body: {}", e))?;
    stream
        .flush()
        .map_err(|e| format!("Failed to flush response: {}", e))?;

    Ok(())
}
