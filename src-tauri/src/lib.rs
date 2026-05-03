// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[path = "ClassroomExport.rs"]
mod classroom_export;
#[path = "classroom_loader.rs"]
mod classroom_loader;
#[path = "dashboard_records.rs"]
mod dashboard_records;
#[path = "HashWithSalt.rs"]
mod hash_with_salt;
#[path = "ReadEnvConfig.rs"]
mod read_env_config;
#[path = "initDB.rs"]
mod init_db;
#[path = "database.rs"]
mod database;
#[path = "reward_calculator.rs"]
mod reward_calculator;
#[path = "evolution_bridge.rs"]
mod evolution_bridge;
#[path = "profile_manager.rs"]
mod profile_manager;
#[path = "seat_table_export.rs"]
mod seat_table_export;

use reward_calculator::{RewardCalcRequest, RewardCalcResult};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// 计算遗传算法的奖励值
/// 接收前端传入的奖励配置、学生信息、座位布局，
/// 返回每个学生的位置奖励、因子奖励、相邻关系奖励和总奖励。
#[tauri::command]
fn calculate_rewards(payload: RewardCalcRequest) -> RewardCalcResult {
    reward_calculator::calculate_rewards(&payload)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            read_env_config::get_default_config,
            classroom_export::export_classroom,
            classroom_loader::load_classroom,
            dashboard_records::get_dashboard_records,
            database::get_default_labels,
            database::save_default_labels,
            database::delete_classroom,
            database::save_namelist,
            database::get_namelists,
            database::load_namelist_content,
            calculate_rewards,
            evolution_bridge::start_evolution,
            evolution_bridge::get_evolution_status,
            evolution_bridge::stop_evolution,
            profile_manager::save_profile,
            profile_manager::get_profile_list,
            profile_manager::load_profile,
            profile_manager::delete_profile,
            seat_table_export::export_seat_table,
            seat_table_export::get_seat_tables,
            seat_table_export::load_seat_table,
            seat_table_export::delete_seat_table
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
