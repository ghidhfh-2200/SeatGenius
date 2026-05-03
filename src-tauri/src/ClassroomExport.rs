use crate::{hash_with_salt::hash_with_salt, init_db};
use chrono::Utc;
use base64::{engine::general_purpose, Engine as _};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Debug, Deserialize)]
pub struct ExportClassroomPayload {
    pub name: String,
    pub classroom_data: serde_json::Value,
    pub preview_svg: String,
}

#[derive(Debug, Serialize)]
pub struct ExportClassroomResult {
    pub sgid: String,
    pub data_file: String,
    pub preview_file: String,
    pub database_file: String,
}

#[tauri::command]
pub fn export_classroom(payload: ExportClassroomPayload) -> Result<ExportClassroomResult, String> {
    let classroom_name = payload.name.trim();
    if classroom_name.is_empty() {
        return Err("教室名称不能为空".to_string());
    }

    init_db::init_db()?;

    let created_at = Utc::now().to_rfc3339();
    let hash_seed = format!("{}-{}", classroom_name, created_at);
    let sgid = hash_with_salt(&hash_seed);
    let data_file = format!("{}.json", sgid);
    let preview_file = format!("{}.svg", sgid);

    let classrooms_path = init_db::classrooms_dir().join(&data_file);
    let previews_path = init_db::previews_dir().join(&preview_file);
    let database_path = init_db::database_path();

    let json_content = serde_json::to_string_pretty(&payload.classroom_data)
        .map_err(|err| err.to_string())?;

    fs::write(&classrooms_path, json_content).map_err(|err| err.to_string())?;
    fs::write(&previews_path, payload.preview_svg).map_err(|err| err.to_string())?;

    let conn = Connection::open(database_path.clone()).map_err(|err| err.to_string())?;
    let encoded_name = general_purpose::STANDARD.encode(classroom_name.as_bytes());
    conn.execute(
        "INSERT OR REPLACE INTO classrooms (SGID, ClassroomData, ClassroomPreview, Name, CreateTime)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![sgid, data_file, preview_file, encoded_name, created_at],
    )
    .map_err(|err| err.to_string())?;

    Ok(ExportClassroomResult {
        sgid,
        data_file,
        preview_file,
        database_file: database_path.to_string_lossy().to_string(),
    })
}
