pub mod commands;
pub mod db;
pub mod models;

use tauri::Manager;

#[tauri::command]
fn ping() -> String {
    "pong".to_string()
}

#[tauri::command]
fn get_db_path(state: tauri::State<db::DbState>) -> Result<String, String> {
    state.db_path.to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Invalid path".to_string())
}

#[tauri::command]
fn open_db_folder(state: tauri::State<db::DbState>) -> Result<(), String> {
    let path = state.db_path.to_str().ok_or("Invalid path")?;
    std::process::Command::new("open")
        .arg("-R")
        .arg(path)
        .spawn()
        .map_err(|e| format!("Failed to open Finder: {}", e))?;
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data directory");

            let db_path = app_data_dir.join("draftdock.db");
            let conn = db::init_db(&db_path).expect("Failed to initialize database");

            app.manage(db::DbState {
                conn: std::sync::Mutex::new(conn),
                db_path,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            get_db_path,
            open_db_folder,
            commands::projects::create_project,
            commands::projects::list_projects,
            commands::projects::update_project,
            commands::projects::delete_project,
            commands::projects::reorder_projects,
            commands::documents::create_document,
            commands::documents::list_documents,
            commands::documents::update_document,
            commands::documents::set_font_size,
            commands::documents::save_to_file,
            commands::documents::delete_document,
            commands::documents::reorder_documents,
            commands::search::search,
            commands::import_export::export_data,
            commands::import_export::import_data,
            commands::settings::get_setting,
            commands::settings::set_setting,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
