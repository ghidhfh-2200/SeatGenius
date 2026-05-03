use crate::init_db;
use base64::{engine::general_purpose, Engine as _};
use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

/// 前端传入的导出座位表请求
#[derive(Debug, Deserialize)]
pub struct ExportSeatTablePayload {
    /// 座位表名称
    pub name: String,
    /// 关联的教室名称
    pub classroom_name: String,
    /// 关联教室 SGID（可选，兼容旧版本）
    #[serde(default)]
    pub classroom_sgid: Option<String>,
    /// 学生座位分配映射：座位ID -> 学生姓名
    pub seat_order: HashMap<String, String>,
    /// 教室 SVG 预览内容
    pub preview_svg: Option<String>,
}

/// 导出结果
#[derive(Debug, Serialize)]
pub struct ExportSeatTableResult {
    pub sgid: String,
    pub file: String,
    pub file_path: String,
}

#[derive(Debug, Serialize)]
pub struct LoadedSeatTableResult {
    pub sgid: String,
    pub name: String,
    pub classroom_name: String,
    pub classroom_sgid: Option<String>,
    pub seat_order: HashMap<String, String>,
    pub create_time: Option<String>,
}

/// 获取 seattable 数据目录
fn seattable_dir() -> PathBuf {
    init_db::seattables_dir()
}

/// 获取 seattable-preview 目录
fn seattable_preview_dir() -> PathBuf {
    init_db::seattable_previews_dir()
}

/// 导出座位表：写入文件 + 存入数据库
#[tauri::command]
pub fn export_seat_table(payload: ExportSeatTablePayload) -> Result<ExportSeatTableResult, String> {
    let table_name = payload.name.trim();
    if table_name.is_empty() {
        return Err("座位表名称不能为空".to_string());
    }

    init_db::init_db()?;

    let created_at = Utc::now().to_rfc3339();
    let hash_seed = format!("{}-{}", table_name, created_at);
    let sgid = crate::hash_with_salt::hash_with_salt(&hash_seed);
    let filename = format!("{}.json", sgid);

    // 构建座位表数据（seat_order 现在是 ID->姓名的映射）
    let seat_table_data = serde_json::json!({
        "sgid": sgid,
        "name": table_name,
        "classroom_name": payload.classroom_name,
        "classroom_sgid": payload.classroom_sgid,
        "seat_order": payload.seat_order,
        "student_count": payload.seat_order.len(),
        "create_time": created_at,
    });

    // 写入 JSON 文件到 seattable 目录
    let file_path = seattable_dir().join(&filename);
    let json_content =
        serde_json::to_string_pretty(&seat_table_data).map_err(|err| err.to_string())?;
    fs::write(&file_path, json_content).map_err(|err| err.to_string())?;

    // 如果有 SVG 预览，保存到 seattable-preview 目录
    let preview_filename = if let Some(svg) = &payload.preview_svg {
        let svg_filename = format!("{}.svg", sgid);
        let svg_path = seattable_preview_dir().join(&svg_filename);
        fs::write(&svg_path, svg).map_err(|err| err.to_string())?;
        svg_filename
    } else {
        String::new()
    };

    // 写入数据库 seattables 表
    let database_path = init_db::database_path();
    let conn = Connection::open(database_path).map_err(|err| err.to_string())?;

    let encoded_name = general_purpose::STANDARD.encode(table_name.as_bytes());
    let encoded_classroom = general_purpose::STANDARD.encode(payload.classroom_name.as_bytes());

    conn.execute(
        "INSERT OR REPLACE INTO seattables (SGID, Name, File, ClassroomName, StudentCount, CreateTime, PreviewFile)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            sgid,
            encoded_name,
            filename,
            encoded_classroom,
            payload.seat_order.len() as i64,
            created_at,
            preview_filename,
        ],
    )
    .map_err(|err| err.to_string())?;

    Ok(ExportSeatTableResult {
        sgid,
        file: filename,
        file_path: file_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn load_seat_table(sgid: String) -> Result<LoadedSeatTableResult, String> {
    init_db::init_db()?;

    let conn = Connection::open(init_db::database_path()).map_err(|err| err.to_string())?;
    let mut stmt = conn
        .prepare("SELECT Name, File, ClassroomName, CreateTime FROM seattables WHERE SGID = ?1 LIMIT 1")
        .map_err(|err| err.to_string())?;

    let (encoded_name, data_file, encoded_classroom, create_time): (String, String, String, String) = stmt
        .query_row([sgid.as_str()], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        })
        .map_err(|_| "未找到指定的座位表记录".to_string())?;

    let name = general_purpose::STANDARD
        .decode(&encoded_name)
        .ok()
        .and_then(|b| String::from_utf8(b).ok())
        .unwrap_or(encoded_name);

    let classroom_name = general_purpose::STANDARD
        .decode(&encoded_classroom)
        .ok()
        .and_then(|b| String::from_utf8(b).ok())
        .unwrap_or(encoded_classroom);

    let data_path = seattable_dir().join(&data_file);
    let raw = fs::read_to_string(&data_path).map_err(|err| err.to_string())?;
    let json: Value = serde_json::from_str(&raw).map_err(|err| err.to_string())?;

    let mut seat_order: HashMap<String, String> = HashMap::new();
    if let Some(map) = json.get("seat_order").and_then(|v| v.as_object()) {
        for (k, v) in map {
            if let Some(name) = v.as_str() {
                seat_order.insert(k.clone(), name.to_string());
            }
        }
    } else if let Some(arr) = json.get("seat_order").and_then(|v| v.as_array()) {
        for (idx, v) in arr.iter().enumerate() {
            if let Some(name) = v.as_str() {
                if name != "空位" {
                    seat_order.insert(idx.to_string(), name.to_string());
                }
            }
        }
    }

    let classroom_sgid = json
        .get("classroom_sgid")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .filter(|s| !s.trim().is_empty());

    Ok(LoadedSeatTableResult {
        sgid,
        name,
        classroom_name,
        classroom_sgid,
        seat_order,
        create_time: Some(create_time),
    })
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
            let preview_path = if preview_file.is_empty() {
                // 兼容旧数据：尝试从 seattable 目录找同名的 svg
                let svg_file = data_file.replace(".json", ".svg");
                seattable_dir().join(&svg_file)
            } else {
                seattable_preview_dir().join(&preview_file)
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
            let problem_message = if is_broken {
                Some("此座位表数据存在问题".to_string())
            } else {
                None
            };

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

/// 删除座位表记录及对应文件
#[tauri::command]
pub fn delete_seat_table(sgid: String) -> Result<(), String> {
    init_db::init_db()?;

    let conn = Connection::open(init_db::database_path()).map_err(|e| e.to_string())?;

    // 查询文件名和预览文件名
    let mut stmt = conn
        .prepare("SELECT File, PreviewFile FROM seattables WHERE SGID = ?1 LIMIT 1")
        .map_err(|e| e.to_string())?;

    let (filename, preview_file): (String, String) = stmt
        .query_row([sgid.as_str()], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1).unwrap_or_default()))
        })
        .map_err(|_| "未找到指定的座位表记录".to_string())?;

    // 删除 JSON 文件
    let json_path = seattable_dir().join(&filename);
    let _ = fs::remove_file(&json_path);

    // 删除预览文件（优先从 seattable-preview 目录删除）
    if !preview_file.is_empty() {
        let preview_path = seattable_preview_dir().join(&preview_file);
        let _ = fs::remove_file(&preview_path);
    } else {
        // 兼容旧数据：尝试从 seattable 目录删除
        let svg_filename = filename.replace(".json", ".svg");
        let svg_path = seattable_dir().join(&svg_filename);
        let _ = fs::remove_file(&svg_path);
    }

    // 删除数据库记录
    conn.execute("DELETE FROM seattables WHERE SGID = ?1", [sgid.as_str()])
        .map_err(|e| e.to_string())?;

    Ok(())
}
