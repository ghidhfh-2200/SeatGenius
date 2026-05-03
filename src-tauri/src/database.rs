use crate::init_db;
use serde::{Deserialize, Serialize};
use rusqlite::Connection;
use std::fs;
use std::io::ErrorKind;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LabelItem {
    pub name: String,
    pub color: String,
    pub factor: String,
    pub weight: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DefaultLabelsPayload {
    pub labels: Vec<LabelItem>,
}

#[tauri::command]
pub fn get_default_labels() -> Result<DefaultLabelsPayload, String> {
    init_db::init_db()?;

    let cfg_path = init_db::project_data_dir().join("defaultLabels.cfg");
    let content = fs::read_to_string(&cfg_path)
        .map_err(|e| format!("读取默认标签配置失败: {}", e))?;

    let parsed: DefaultLabelsPayload = serde_json::from_str(&content)
        .map_err(|e| format!("解析默认标签 JSON 失败: {}", e))?;

    Ok(parsed)
}

#[tauri::command]
pub fn save_default_labels(labels: Vec<LabelItem>) -> Result<(), String> {
    init_db::init_db()?;

    let cfg_path = init_db::project_data_dir().join("defaultLabels.cfg");
    let payload = DefaultLabelsPayload { labels };
    let output = serde_json::to_string_pretty(&payload)
        .map_err(|e| format!("序列化默认标签 JSON 失败: {}", e))?;

    fs::write(&cfg_path, output).map_err(|e| format!("保存默认标签配置失败: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn delete_classroom(sgid: String) -> Result<(), String> {
    init_db::init_db()?;

    let conn = Connection::open(init_db::database_path()).map_err(|e| e.to_string())?;

    // Fetch filenames for the record first
    let mut stmt = conn
        .prepare(
            "SELECT ClassroomData, ClassroomPreview FROM classrooms WHERE SGID = ?1 LIMIT 1",
        )
        .map_err(|e| e.to_string())?;

    let row = stmt
        .query_row([sgid.as_str()], |row| {
            let data_file: String = row.get(0)?;
            let preview_file: String = row.get(1)?;
            Ok((data_file, preview_file))
        })
        .map_err(|_| "未找到指定的教室记录".to_string())?;

    let (data_file, preview_file) = row;
    let data_path = init_db::classrooms_dir().join(&data_file);
    let preview_path = init_db::previews_dir().join(&preview_file);

    // Helper to remove file but ignore NotFound
    let try_remove = |path: &std::path::Path| -> Result<(), String> {
        match fs::remove_file(path) {
            Ok(_) => Ok(()),
            Err(e) if e.kind() == ErrorKind::NotFound => Ok(()),
            Err(e) => Err(format!("删除文件失败: {}", e)),
        }
    };

    try_remove(&data_path)?;
    try_remove(&preview_path)?;

    // Remove DB record
    conn.execute("DELETE FROM classrooms WHERE SGID = ?1", [sgid.as_str()])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn save_namelist(name: String, names: Vec<String>) -> Result<String, String> {
    init_db::init_db()?;

    let conn = Connection::open(init_db::database_path()).map_err(|e| e.to_string())?;

    // Ensure name is safe for filename
    let safe_name = name.replace(|c: char| !c.is_alphanumeric() && c != '_' && c != '-' , "_");
    let ts = chrono::Utc::now().format("%Y%m%d%H%M%S").to_string();
    let filename = format!("{}-{}.txt", safe_name, ts);
    let path = init_db::namelists_dir().join(&filename);

    // Write file
    let content = names.join("\n");
    fs::write(&path, content).map_err(|e| e.to_string())?;

    // Insert into DB
    let create_time = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO namelist (Name, File, CreateTime, Count) VALUES (?1, ?2, ?3, ?4)",
        [name.as_str(), filename.as_str(), create_time.as_str(), &names.len().to_string()],
    )
    .map_err(|e| e.to_string())?;

    Ok(path.to_string_lossy().into_owned())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NamelistRecord {
    pub id: i64,
    pub name: String,
    pub file: String,
    pub create_time: String,
    pub count: i64,
}

#[tauri::command]
pub fn get_namelists() -> Result<Vec<NamelistRecord>, String> {
    init_db::init_db()?;

    let conn = Connection::open(init_db::database_path()).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT ID, Name, File, CreateTime, Count FROM namelist ORDER BY CreateTime DESC")
        .map_err(|e| e.to_string())?;

    let records = stmt
        .query_map([], |row| {
            Ok(NamelistRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                file: row.get(2)?,
                create_time: row.get(3)?,
                count: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(records)
}

#[tauri::command]
pub fn load_namelist_content(id: i64) -> Result<Vec<String>, String> {
    init_db::init_db()?;

    let conn = Connection::open(init_db::database_path()).map_err(|e| e.to_string())?;

    let filename: String = conn
        .query_row(
            "SELECT File FROM namelist WHERE ID = ?1",
            [id],
            |row| row.get(0),
        )
        .map_err(|_| "未找到指定的名单记录".to_string())?;

    let path = init_db::namelists_dir().join(&filename);
    let content = fs::read_to_string(&path).map_err(|e| format!("读取名单文件失败: {}", e))?;

    let names: Vec<String> = content
        .split('\n')
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect();

    Ok(names)
}
