use pyo3::prelude::*;
use pyo3::types::{PyList, PyModule};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::Instant;

#[pyclass]
struct EvolutionProgressCallback {
    generations: u32,
}

#[pymethods]
impl EvolutionProgressCallback {
    #[pyo3(name = "__call__")]
    fn call(&self, generation: u32, best_fitness: f64, message: Option<String>) {
        let total = self.generations.max(1);
        let gen = generation.min(total);
        let progress = (gen as f64) / (total as f64);
        let best = if best_fitness.is_finite() { best_fitness } else { 0.0 };
        let msg = message.unwrap_or_else(|| format!("Python 演化中：第 {gen}/{total} 代"));

        set_status(|s| {
            s.progress = progress.min(1.0).max(0.0);
            s.generation = gen;
            s.best_fitness = best;
            s.message = msg;
        });
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvolutionStartPayload {
    pub classroom_sgid: String,
    pub classroom_name: String,
    pub names: Vec<String>,
    pub personal_attrs: Vec<Value>,
    pub conditions: Vec<Value>,
    #[serde(default)]
    pub seat_ids: Vec<String>,
    pub generations: u32,
    #[serde(default)]
    pub pop_size: Option<u32>,
    #[serde(default)]
    pub mutpb: Option<f64>,
    #[serde(default)]
    pub cxpb: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvolutionStatus {
    pub state: String,
    pub progress: f64,
    pub generation: u32,
    pub best_fitness: f64,
    pub message: String,
    pub classroom_sgid: String,
    pub classroom_name: String,
    /// 座位分配映射：座位ID -> 学生姓名
    pub seat_order: HashMap<String, String>,
}

#[derive(Debug, Clone, Deserialize)]
struct PythonEvolutionResult {
    generation: u32,
    best_fitness: f64,
    message: Option<String>,
    #[serde(default)]
    seat_order: HashMap<String, String>,
}

static EVOLUTION_STATUS: OnceLock<Mutex<EvolutionStatus>> = OnceLock::new();
static EVOLUTION_CANCEL_FLAG: AtomicBool = AtomicBool::new(false);

fn default_status() -> EvolutionStatus {
    EvolutionStatus {
        state: "idle".to_string(),
        progress: 0.0,
        generation: 0,
        best_fitness: 0.0,
        message: "等待开始".to_string(),
        classroom_sgid: String::new(),
        classroom_name: String::new(),
        seat_order: HashMap::new(),
    }
}

fn status_store() -> &'static Mutex<EvolutionStatus> {
    EVOLUTION_STATUS.get_or_init(|| Mutex::new(default_status()))
}

fn set_status(updater: impl FnOnce(&mut EvolutionStatus)) {
    if let Ok(mut guard) = status_store().lock() {
        updater(&mut guard);
    }
}

fn current_status() -> EvolutionStatus {
    status_store()
        .lock()
        .map(|g| g.clone())
        .unwrap_or_else(|_| default_status())
}

fn run_python_evolution(payload: &EvolutionStartPayload) -> Result<PythonEvolutionResult, String> {
    let payload_json = serde_json::to_string(payload).map_err(|e| e.to_string())?;
    let python_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("python");
    let python_dir_str = python_dir.to_string_lossy().to_string();

    Python::with_gil(|py| -> Result<PythonEvolutionResult, String> {
        let sys = PyModule::import_bound(py, "sys").map_err(|e| e.to_string())?;
        let path_obj = sys.getattr("path").map_err(|e| e.to_string())?;
        let path = path_obj
            .downcast_into::<PyList>()
            .map_err(|e| e.to_string())?;
        let _ = path.insert(0, python_dir_str.as_str());

        let module = PyModule::import_bound(py, "evolution_engine")
            .map_err(|e| format!("导入 evolution_engine 失败: {e}"))?;
        let progress_callback = Py::new(
            py,
            EvolutionProgressCallback {
                generations: payload.generations.max(1),
            },
        )
        .map_err(|e| e.to_string())?;
        let result = module
            .getattr("run_evolution")
            .map_err(|e| e.to_string())?
            .call1((payload_json, progress_callback))
            .map_err(|e| format!("调用 run_evolution 失败: {e}"))?;

        let json = PyModule::import_bound(py, "json")
            .map_err(|e| e.to_string())?
            .call_method1("dumps", (result,))
            .map_err(|e| e.to_string())?
            .extract::<String>()
            .map_err(|e| e.to_string())?;

        serde_json::from_str::<PythonEvolutionResult>(&json).map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub fn start_evolution(payload: EvolutionStartPayload) -> Result<EvolutionStatus, String> {
    let prev = current_status();
    if prev.state == "running" {
        return Err("已有演化任务正在运行，请稍后再试".to_string());
    }

    // 重置取消标志
    EVOLUTION_CANCEL_FLAG.store(false, Ordering::SeqCst);

    let classroom_sgid = payload.classroom_sgid.clone();
    let classroom_name = payload.classroom_name.clone();

    set_status(|s| {
        s.state = "running".to_string();
        s.progress = 0.01;
        s.generation = 0;
        s.best_fitness = 0.0;
        s.message = "演化已启动".to_string();
        s.classroom_sgid = classroom_sgid;
        s.classroom_name = classroom_name;
        s.seat_order.clear();
    });

    thread::spawn(move || {
        let started = Instant::now();

        match run_python_evolution(&payload) {
            Ok(result) => {
                let elapsed = started.elapsed().as_secs_f32();
                set_status(|s| {
                    s.state = "completed".to_string();
                    s.progress = 1.0;
                    s.generation = result.generation;
                    s.best_fitness = result.best_fitness;
                    s.seat_order = result.seat_order;
                    s.message = result
                        .message
                        .unwrap_or_else(|| format!("演化完成，用时 {:.2}s", elapsed));
                });
            }
            Err(err) => {
                set_status(|s| {
                    s.state = "failed".to_string();
                    s.progress = 1.0;
                    s.message = err;
                    s.seat_order.clear();
                });
            }
        }
    });

    Ok(current_status())
}

#[tauri::command]
pub fn stop_evolution() -> Result<EvolutionStatus, String> {
    let prev = current_status();
    if prev.state != "running" {
        return Err("当前没有正在运行的演化任务".to_string());
    }

    // 设置取消标志，演化线程会在下一次循环检查时退出
    EVOLUTION_CANCEL_FLAG.store(true, Ordering::SeqCst);

    set_status(|s| {
        s.state = "cancelled".to_string();
        s.progress = 0.0;
        s.message = "正在取消演化任务...".to_string();
        s.seat_order.clear();
    });

    Ok(current_status())
}

#[tauri::command]
pub fn get_evolution_status() -> Result<EvolutionStatus, String> {
    Ok(current_status())
}
