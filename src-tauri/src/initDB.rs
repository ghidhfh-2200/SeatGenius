use rusqlite::Connection;
use std::{fs, path::PathBuf};

pub fn project_data_dir() -> PathBuf {
    if let Some(manifest_dir) = option_env!("CARGO_MANIFEST_DIR") {
        return PathBuf::from(manifest_dir).join("../data");
    }

    if let Ok(current_dir) = std::env::current_dir() {
        let candidates = [
            current_dir.join("data"),
            current_dir.join("../data"),
            current_dir.join("../../data"),
        ];

        if let Some(found) = candidates.into_iter().find(|path| path.exists()) {
            return found;
        }

        return current_dir.join("data");
    }

    PathBuf::from("data")
}

pub fn classrooms_dir() -> PathBuf {
    project_data_dir().join("classrooms")
}

pub fn previews_dir() -> PathBuf {
    project_data_dir().join("previews")
}

pub fn seattable_previews_dir() -> PathBuf {
    project_data_dir().join("seattable-preview")
}

pub fn namelists_dir() -> PathBuf {
    project_data_dir().join("namelist")
}

pub fn profiles_dir() -> PathBuf {
    project_data_dir().join("profile")
}

pub fn seattables_dir() -> PathBuf {
    project_data_dir().join("seattable")
}

pub fn database_path() -> PathBuf {
    project_data_dir().join("classrooms.db")
}

pub fn init_db() -> Result<(), String> {
    let data_dir = project_data_dir();
    fs::create_dir_all(&data_dir).map_err(|err| err.to_string())?;
    fs::create_dir_all(classrooms_dir()).map_err(|err| err.to_string())?;
    fs::create_dir_all(previews_dir()).map_err(|err| err.to_string())?;
    fs::create_dir_all(namelists_dir()).map_err(|err| err.to_string())?;
    fs::create_dir_all(profiles_dir()).map_err(|err| err.to_string())?;
    fs::create_dir_all(seattables_dir()).map_err(|err| err.to_string())?;
    fs::create_dir_all(seattable_previews_dir()).map_err(|err| err.to_string())?;

    let conn = Connection::open(database_path()).map_err(|err| err.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS classrooms (
            SGID TEXT PRIMARY KEY,
            ClassroomData TEXT NOT NULL,
            ClassroomPreview TEXT NOT NULL,
            Name TEXT NOT NULL,
            CreateTime TEXT NOT NULL
        )",
        [],
    )
    .map_err(|err| err.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS namelist (
            ID INTEGER PRIMARY KEY AUTOINCREMENT,
            Name TEXT NOT NULL,
            File TEXT NOT NULL,
            CreateTime TEXT NOT NULL,
            Count INTEGER NOT NULL
        )",
        [],
    )
    .map_err(|err| err.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS profile (
            ID INTEGER PRIMARY KEY AUTOINCREMENT,
            Name TEXT NOT NULL,
            File TEXT NOT NULL,
            CreateTime TEXT NOT NULL,
            UpdateTime TEXT NOT NULL,
            Description TEXT DEFAULT ''
        )",
        [],
    )
    .map_err(|err| err.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS seattables (
            SGID TEXT PRIMARY KEY,
            Name TEXT NOT NULL,
            File TEXT NOT NULL,
            ClassroomName TEXT NOT NULL,
            StudentCount INTEGER NOT NULL DEFAULT 0,
            CreateTime TEXT NOT NULL,
            PreviewFile TEXT DEFAULT ''
        )",
        [],
    )
    .map_err(|err| err.to_string())?;

    // 迁移：为旧表添加 PreviewFile 列（如果不存在）
    let mut stmt = conn
        .prepare("PRAGMA table_info(seattables)")
        .map_err(|err| err.to_string())?;
    let seattable_columns = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;

    if !seattable_columns.iter().any(|col| col == "PreviewFile") {
        conn.execute("ALTER TABLE seattables ADD COLUMN PreviewFile TEXT DEFAULT ''", [])
            .map_err(|err| err.to_string())?;
    }

    let mut stmt = conn
        .prepare("PRAGMA table_info(classrooms)")
        .map_err(|err| err.to_string())?;
    let columns = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;

    if columns.iter().any(|column| column == "name") && !columns.iter().any(|column| column == "Name") {
        conn.execute("ALTER TABLE classrooms RENAME COLUMN name TO Name", [])
            .map_err(|err| err.to_string())?;
    }

    Ok(())
}