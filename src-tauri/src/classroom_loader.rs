use crate::init_db;
use base64::{engine::general_purpose, Engine as _};
use rusqlite::Connection;
use serde::Serialize;
use std::fs;

#[derive(Debug, Serialize)]
pub struct LoadedClassroomPayload {
    pub sgid: String,
    pub name: String,
    pub create_time: String,
    pub data_file: String,
    pub preview_file: String,
    pub classroom_data: serde_json::Value,
    pub preview_svg: Option<String>,
    pub is_broken: bool,
    pub problem_message: Option<String>,
}

fn decode_base64_name(encoded: &str) -> Option<String> {
    let decoded = general_purpose::STANDARD.decode(encoded).ok()?;
    String::from_utf8(decoded).ok()
}

#[tauri::command]
pub fn load_classroom(sgid: String) -> Result<LoadedClassroomPayload, String> {
    init_db::init_db()?;

    let conn = Connection::open(init_db::database_path()).map_err(|err| err.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT SGID, ClassroomData, ClassroomPreview, Name, CreateTime
             FROM classrooms
             WHERE SGID = ?1
             LIMIT 1",
        )
        .map_err(|err| err.to_string())?;

    let row = stmt
        .query_row([sgid.as_str()], |row| {
            let sgid: String = row.get(0)?;
            let data_file: String = row.get(1)?;
            let preview_file: String = row.get(2)?;
            let encoded_name: String = row.get(3)?;
            let create_time: String = row.get(4)?;
            Ok((sgid, data_file, preview_file, encoded_name, create_time))
        })
        .map_err(|err| err.to_string())?;

    let (sgid, data_file, preview_file, encoded_name, create_time) = row;
    let data_path = init_db::classrooms_dir().join(&data_file);
    let preview_path = init_db::previews_dir().join(&preview_file);

    let data_content = fs::read_to_string(&data_path)
        .map_err(|_| "教室数据文件不存在或无法读取".to_string())?;
    let classroom_data: serde_json::Value = serde_json::from_str(&data_content)
        .map_err(|err| err.to_string())?;

    let preview_svg = fs::read_to_string(&preview_path).ok();
    let decoded_name = decode_base64_name(&encoded_name).unwrap_or_else(|| encoded_name.clone());

    let is_broken = preview_svg.is_none() || decode_base64_name(&encoded_name).is_none();
    let problem_message = if is_broken {
        Some("此数据存在问题".to_string())
    } else {
        None
    };

    Ok(LoadedClassroomPayload {
        sgid,
        name: decoded_name,
        create_time,
        data_file,
        preview_file,
        classroom_data,
        preview_svg,
        is_broken,
        problem_message,
    })
}