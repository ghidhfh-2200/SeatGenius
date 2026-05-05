use crate::init_db;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::fs;

/// 档案记录（用于列表展示）
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProfileRecord {
    pub id: i64,
    pub name: String,
    pub file: String,
    pub create_time: String,
    pub update_time: String,
    pub description: String,
}

/// 档案数据（存储在 JSON 文件中）
/// 包含所有配置：奖励值、个人属性、名单、标签、条件
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProfileData {
    // ===== 奖励值配置（原 ConditionSettingsModal 数据） =====
    pub position_rewards: std::collections::HashMap<String, f64>,
    pub special_rewards: std::collections::HashMap<String, f64>,
    pub factor_rewards: std::collections::HashMap<String, Vec<FactorRange>>,
    pub adjacency_rewards: std::collections::HashMap<String, f64>,
    pub seat_rewards: std::collections::HashMap<String, f64>,
    pub classroom_sgid: Option<String>,
    // ===== 新增：完整配置数据 =====
    /// 学生名单
    pub names: Vec<String>,
    /// 个人属性数据 [{ name: string, factors: { ... } }]
    pub personal_attrs: Vec<serde_json::Value>,
    /// 条件列表（含奖励配置项）
    pub conditions: Vec<serde_json::Value>,
    /// 标签定义 [{ id, name, color, factor, weight }]
    pub labels: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FactorRange {
    pub min: f64,
    pub max: f64,
    pub label: String,
    pub reward: f64,
    pub id: String,
}

/// 保存档案
#[tauri::command]
pub fn save_profile(name: String, description: String, data: ProfileData) -> Result<ProfileRecord, String> {
    init_db::init_db()?;

    let safe_name = name.replace(|c: char| !c.is_alphanumeric() && c != '_' && c != '-' && c != ' ', "_");
    let ts = chrono::Utc::now().format("%Y%m%d%H%M%S").to_string();
    let filename = format!("{}-{}.json", safe_name, ts);
    let path = init_db::profiles_dir().join(&filename);

    // 写入 JSON 文件
    let content = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("序列化档案数据失败: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("写入档案文件失败: {}", e))?;

    let now = chrono::Utc::now().to_rfc3339();

    // 插入数据库
    let conn = Connection::open(init_db::database_path()).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO profile (Name, File, CreateTime, UpdateTime, Description) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![name.as_str(), filename.as_str(), now.as_str(), now.as_str(), description.as_str()],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    Ok(ProfileRecord {
        id,
        name,
        file: filename,
        create_time: now.clone(),
        update_time: now,
        description,
    })
}

/// 更新档案（覆盖原档案文件）
#[tauri::command]
pub fn update_profile(id: i64, data: ProfileData) -> Result<ProfileRecord, String> {
    init_db::init_db()?;

    let conn = Connection::open(init_db::database_path()).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT Name, File, CreateTime, Description FROM profile WHERE ID = ?1")
        .map_err(|e| e.to_string())?;

    let result = stmt
        .query_row([id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        })
        .map_err(|e| format!("未找到档案记录: {}", e))?;

    let (name, file, create_time, description) = result;
    let path = init_db::profiles_dir().join(&file);

    let content = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("序列化档案数据失败: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("写入档案文件失败: {}", e))?;

    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE profile SET UpdateTime = ?1 WHERE ID = ?2",
        rusqlite::params![now.as_str(), id],
    )
    .map_err(|e| e.to_string())?;

    Ok(ProfileRecord {
        id,
        name,
        file,
        create_time,
        update_time: now,
        description,
    })
}

/// 获取所有档案列表
#[tauri::command]
pub fn get_profile_list() -> Result<Vec<ProfileRecord>, String> {
    init_db::init_db()?;

    let conn = Connection::open(init_db::database_path()).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT ID, Name, File, CreateTime, UpdateTime, Description
             FROM profile
             ORDER BY UpdateTime DESC",
        )
        .map_err(|e| e.to_string())?;

    let records = stmt
        .query_map([], |row| {
            Ok(ProfileRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                file: row.get(2)?,
                create_time: row.get(3)?,
                update_time: row.get(4)?,
                description: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(records)
}

/// 从档案加载数据（异步，不阻塞主线程）
#[tauri::command]
pub async fn load_profile(id: i64) -> Result<ProfileData, String> {
    init_db::init_db()?;

    let conn = Connection::open(init_db::database_path()).map_err(|e| e.to_string())?;
    let file: String = conn
        .query_row(
            "SELECT File FROM profile WHERE ID = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .map_err(|_| format!("未找到 ID 为 {} 的档案记录", id))?;

    let path = init_db::profiles_dir().join(&file);
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("读取档案文件失败: {}", e))?;

    let data: ProfileData = serde_json::from_str(&content)
        .map_err(|e| format!("解析档案数据失败: {}", e))?;

    Ok(data)
}

/// 删除档案
#[tauri::command]
pub fn delete_profile(id: i64) -> Result<(), String> {
    init_db::init_db()?;

    let conn = Connection::open(init_db::database_path()).map_err(|e| e.to_string())?;

    // 获取文件名
    let file: String = conn
        .query_row(
            "SELECT File FROM profile WHERE ID = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .map_err(|_| format!("未找到 ID 为 {} 的档案记录", id))?;

    // 删除文件
    let path = init_db::profiles_dir().join(&file);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("删除档案文件失败: {}", e))?;
    }

    // 删除数据库记录
    conn.execute("DELETE FROM profile WHERE ID = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}
