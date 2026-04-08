use std::path::Path;

use serde::Deserialize;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopManifest {
    #[serde(default)]
    pub format_version: i32,
    #[serde(default)]
    pub project_dir: String,
    #[serde(default)]
    pub app: ManifestApp,
    #[serde(default)]
    pub runtime: ManifestRuntime,
    #[serde(default)]
    pub bindings: ManifestBindings,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestRuntime {
    #[serde(default)]
    pub worker_entrypoint: String,
    #[serde(default)]
    pub assets_root: Option<String>,
    #[serde(default)]
    pub compatibility_date: String,
    #[serde(default)]
    pub compatibility_flags: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestApp {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub initial_path: String,
    #[serde(default)]
    pub window: ManifestWindow,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestWindow {
    #[serde(default)]
    pub title: String,
    #[serde(default = "default_width")]
    pub width: i32,
    #[serde(default = "default_height")]
    pub height: i32,
}

impl Default for ManifestWindow {
    fn default() -> Self {
        Self {
            title: String::new(),
            width: default_width(),
            height: default_height(),
        }
    }
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct ManifestBindings {
    #[serde(default)]
    pub desktop: DesktopBindings,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct DesktopBindings {
    #[serde(default)]
    pub notifications: bool,
    #[serde(default)]
    pub files: bool,
}

fn default_width() -> i32 {
    1200
}

fn default_height() -> i32 {
    900
}

pub fn load_manifest(path: &Path) -> Result<DesktopManifest, String> {
    let raw = std::fs::read_to_string(path)
        .map_err(|error| format!("Failed to read manifest at {}: {error}", path.display()))?;
    serde_json::from_str::<DesktopManifest>(&raw)
        .map_err(|error| format!("Failed to parse desktop manifest: {error}"))
}
