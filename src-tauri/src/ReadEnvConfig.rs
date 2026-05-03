use std::{collections::HashMap, fs, path::PathBuf};

fn read_default_config_file() -> Result<String, String> {
	let mut candidates: Vec<PathBuf> = Vec::new();

	if let Some(manifest_dir) = option_env!("CARGO_MANIFEST_DIR") {
		candidates.push(PathBuf::from(manifest_dir).join("../data/default_config.env"));
	}

	if let Ok(current_dir) = std::env::current_dir() {
		candidates.push(current_dir.join("data/default_config.env"));
		candidates.push(current_dir.join("../data/default_config.env"));
		candidates.push(current_dir.join("../../data/default_config.env"));
		candidates.push(current_dir.join("../../../data/default_config.env"));
	}

	for path in candidates {
		if path.exists() {
			return fs::read_to_string(path).map_err(|err| err.to_string());
		}
	}

	Err("无法读取 data/default_config.env，请确认文件存在。".to_string())
}

fn parse_default_config(raw: &str) -> HashMap<String, f64> {
	raw.lines()
		.filter_map(|line| {
			let trimmed = line.trim();
			if trimmed.is_empty() || trimmed.starts_with('#') {
				return None;
			}

			let (key, value) = trimmed.split_once('=')?;
			let value = value.trim().parse::<f64>().ok()?;
			Some((key.trim().to_string(), value))
		})
		.collect()
}

#[tauri::command]
pub fn get_default_config() -> Result<HashMap<String, f64>, String> {
	let raw = read_default_config_file()?;
	Ok(parse_default_config(&raw))
}
