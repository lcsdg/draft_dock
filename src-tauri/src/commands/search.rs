use crate::db::DbState;
use crate::models::SearchResult;
use tauri::State;

#[tauri::command]
pub fn search(state: State<DbState>, query: String) -> Result<Vec<SearchResult>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let like_pattern = format!("%{}%", query);

    let mut stmt = conn
        .prepare(
            "SELECT p.id, p.name, d.id, d.name, d.content
             FROM documents d
             JOIN projects p ON p.id = d.project_id
             WHERE p.name LIKE ?1
                OR d.name LIKE ?1
                OR d.content LIKE ?1
             ORDER BY p.sort_order ASC, d.sort_order ASC
             LIMIT 50",
        )
        .map_err(|e| e.to_string())?;

    let results = stmt
        .query_map([&like_pattern], |row| {
            let content: String = row.get(4)?;
            let snippet = if content.len() > 120 {
                format!("{}...", &content[..120])
            } else {
                content
            };
            Ok(SearchResult {
                project_id: row.get(0)?,
                project_name: row.get(1)?,
                document_id: row.get(2)?,
                document_name: row.get(3)?,
                snippet,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(results)
}
