use crate::db::DbState;
use crate::models::{Document, ExportData, Project};
use tauri::State;

#[tauri::command]
pub fn export_data(state: State<DbState>) -> Result<ExportData, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, name, sort_order, archived, created_at, updated_at FROM projects ORDER BY sort_order ASC")
        .map_err(|e| e.to_string())?;

    let projects = stmt
        .query_map([], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                sort_order: row.get(2)?,
                archived: row.get::<_, i32>(3)? != 0,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, project_id, name, content, font_size, sort_order, created_at, updated_at FROM documents ORDER BY sort_order ASC")
        .map_err(|e| e.to_string())?;

    let documents = stmt
        .query_map([], |row| {
            Ok(Document {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                content: row.get(3)?,
                font_size: row.get(4)?,
                sort_order: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(ExportData {
        projects,
        documents,
    })
}

#[tauri::command]
pub fn import_data(
    state: State<DbState>,
    json: String,
    mode: String,
) -> Result<(), String> {
    let data: ExportData =
        serde_json::from_str(&json).map_err(|e| format!("JSON 格式错误: {}", e))?;

    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    if mode == "replace" {
        conn.execute_batch(
            "DELETE FROM documents; DELETE FROM projects;",
        )
        .map_err(|e| e.to_string())?;
    }

    for project in &data.projects {
        conn.execute(
            "INSERT OR REPLACE INTO projects (id, name, sort_order, archived, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                project.id,
                project.name,
                project.sort_order,
                project.archived as i32,
                project.created_at,
                project.updated_at,
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    for doc in &data.documents {
        conn.execute(
            "INSERT OR REPLACE INTO documents (id, project_id, name, content, font_size, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                doc.id,
                doc.project_id,
                doc.name,
                doc.content,
                doc.font_size,
                doc.sort_order,
                doc.created_at,
                doc.updated_at,
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}
