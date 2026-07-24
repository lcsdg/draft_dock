use crate::db::DbState;
use crate::models::Document;
use tauri::State;

#[tauri::command]
pub fn create_document(
    state: State<DbState>,
    project_id: String,
    name: String,
) -> Result<Document, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono_now();

    conn.execute(
        "INSERT INTO documents (id, project_id, name, content, font_size, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, '', 14, ?4, ?5, ?6)",
        rusqlite::params![id, project_id, name, 0, now, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(Document {
        id,
        project_id,
        name,
        content: String::new(),
        font_size: 14,
        sort_order: 0,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn list_documents(
    state: State<DbState>,
    project_id: String,
) -> Result<Vec<Document>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, project_id, name, content, font_size, sort_order, created_at, updated_at FROM documents WHERE project_id = ?1 ORDER BY sort_order ASC, created_at ASC")
        .map_err(|e| e.to_string())?;

    let documents = stmt
        .query_map([&project_id], |row| {
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

    Ok(documents)
}

#[tauri::command]
pub fn update_document(
    state: State<DbState>,
    id: String,
    name: Option<String>,
    content: Option<String>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono_now();

    if let Some(name) = name {
        conn.execute(
            "UPDATE documents SET name = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![name, now, id],
        )
        .map_err(|e| e.to_string())?;
    }

    if let Some(content) = content {
        conn.execute(
            "UPDATE documents SET content = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![content, now, id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn set_font_size(state: State<DbState>, id: String, size: i32) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono_now();
    conn.execute(
        "UPDATE documents SET font_size = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![size, now, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn save_to_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, &content).map_err(|e| format!("保存文件失败: {}", e))
}

#[tauri::command]
pub fn delete_document(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM documents WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn reorder_documents(
    state: State<DbState>,
    ordered_ids: Vec<String>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono_now();
    for (i, id) in ordered_ids.iter().enumerate() {
        conn.execute(
            "UPDATE documents SET sort_order = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![i as i32, now, id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn chrono_now() -> String {
    chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
}
