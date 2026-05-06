use crate::init_db;
use base64::{engine::general_purpose, Engine as _};
use rusqlite::Connection;
use serde::Serialize;
use std::fs;
use crate::seat_table_export::seattable_dir;
use crate::seat_table_export::seattable_preview_dir;
use std::path::PathBuf;

#[derive(Debug, Serialize)]
pub struct DashboardRecord {
    pub sgid: String,
    pub name: String,
    pub create_time: String,
    pub data_file: String,
    pub preview_file: String,
    pub data_file_exists: bool,
    pub preview_file_exists: bool,
    pub is_broken: bool,
    pub problem_message: Option<String>,
    pub preview_svg: Option<String>,
}

fn decode_base64_name(encoded: &str) -> Option<String> {
    let decoded = general_purpose::STANDARD.decode(encoded).ok()?;
    String::from_utf8(decoded).ok()
}

fn build_problem_message(data_exists: bool, preview_exists: bool, name_ok: bool) -> Option<String> {
    if data_exists && preview_exists && name_ok {
        return None;
    }

    let mut reasons = Vec::new();
    if !data_exists {
        reasons.push("JSON 文件缺失");
    }
    if !preview_exists {
        reasons.push("SVG 预览缺失");
    }
    if !name_ok {
        reasons.push("名称解码失败");
    }

    Some(format!("此数据存在问题：{}", reasons.join("、")))
}

#[tauri::command]
pub fn get_dashboard_records() -> Result<Vec<DashboardRecord>, String> {
    init_db::init_db()?;

    let conn = Connection::open(init_db::database_path()).map_err(|err| err.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT SGID, ClassroomData, ClassroomPreview, Name, CreateTime
             FROM classrooms
             ORDER BY CreateTime DESC",
        )
        .map_err(|err| err.to_string())?;

    let records = stmt
        .query_map([], |row| {
            let sgid: String = row.get(0)?;
            let data_file: String = row.get(1)?;
            let preview_file: String = row.get(2)?;
            let encoded_name: String = row.get(3)?;
            let create_time: String = row.get(4)?;

            let data_path = init_db::classrooms_dir().join(&data_file);
            let preview_path = init_db::previews_dir().join(&preview_file);
            let data_file_exists = data_path.exists();
            let preview_file_exists = preview_path.exists();

            let decoded_name = decode_base64_name(&encoded_name);
            let name = decoded_name.clone().unwrap_or_else(|| encoded_name.clone());
            let preview_svg = if preview_file_exists {
                fs::read_to_string(&preview_path).ok()
            } else {
                None
            };

            let is_broken = !data_file_exists || !preview_file_exists || decoded_name.is_none();
            let problem_message = build_problem_message(data_file_exists, preview_file_exists, decoded_name.is_some());

            Ok(DashboardRecord {
                sgid,
                name,
                create_time,
                data_file,
                preview_file,
                data_file_exists,
                preview_file_exists,
                is_broken,
                problem_message,
                preview_svg,
            })
        })
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;

    Ok(records)
}

/// 从数据库获取所有座位表记录（供 Dashboard 使用）
#[tauri::command]
pub fn get_seat_tables() -> Result<Vec<super::dashboard_records::DashboardRecord>, String> {
    use super::dashboard_records::DashboardRecord;

    init_db::init_db()?;

    let conn = Connection::open(init_db::database_path()).map_err(|err| err.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT SGID, Name, File, ClassroomName, StudentCount, CreateTime, PreviewFile
             FROM seattables
             ORDER BY CreateTime DESC",
        )
        .map_err(|err| err.to_string())?;

    let records = stmt
        .query_map([], |row| {
            let sgid: String = row.get(0)?;
            let encoded_name: String = row.get(1)?;
            let data_file: String = row.get(2)?;
            let _encoded_classroom: String = row.get(3)?;
            let _student_count: i64 = row.get(4)?;
            let create_time: String = row.get(5)?;
            let preview_file: String = row.get::<_, String>(6).unwrap_or_default();

            let data_path = seattable_dir().join(&data_file);
            let preview_path: PathBuf = if !preview_file.is_empty() {
                seattable_preview_dir().join(&preview_file)
            } else {
                PathBuf::new()
            };
            let data_file_exists = data_path.exists();
            let preview_file_exists = preview_path.exists();

            let decoded_name =
                general_purpose::STANDARD
                    .decode(&encoded_name)
                    .ok()
                    .and_then(|b| String::from_utf8(b).ok());
            let name = decoded_name.clone().unwrap_or_else(|| encoded_name.clone());

            let preview_svg = if preview_file_exists {
                fs::read_to_string(&preview_path).ok()
            } else {
                None
            };

            let is_broken = !data_file_exists || decoded_name.is_none();
            let problem_message = build_problem_message(data_file_exists, preview_file_exists, decoded_name.is_some());

            Ok(DashboardRecord {
                sgid,
                name,
                create_time,
                data_file,
                preview_file: preview_path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default(),
                data_file_exists,
                preview_file_exists,
                is_broken,
                problem_message,
                preview_svg,
            })
        })
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;

    Ok(records)
}