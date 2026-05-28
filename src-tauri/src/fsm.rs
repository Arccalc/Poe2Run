use std::collections::{HashSet, HashMap};
use std::path::Path;
use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};
use crate::models::{Route, Split};

const TOWN_ZONES_ARRAY: &[&str] = &[
    "The Rogue Harbour",
    "Kingsmarch",
    "Osgoth",
    "The Forest Town",
    "Sarn Encampment",
    "Lioneye's Watch",
    "Forest Encampment",
    "The Sarn Encampment",
    "Highgate",
    "Overseer's Tower",
    "Bridge Encampment",
    "Karui Shores",
    "Clearfell Encampment",
    "Ardura Caravan",
    "Arduran Caravan",
    "The Glade",
    "The Khari Bazaar",
    "The Refuge",
];

fn is_town_zone(zone_name: &str) -> bool {
    let name_lower = zone_name.to_lowercase();
    if TOWN_ZONES_ARRAY.iter().any(|&town| town.to_lowercase() == name_lower) {
        return true;
    }
    if name_lower.contains("encampment")
        || name_lower.contains("town")
        || name_lower.contains("harbour")
        || name_lower.contains("shores")
        || name_lower.contains("caravan")
        || name_lower == "kingsmarch"
        || name_lower == "osgoth"
    {
        return true;
    }
    false
}

fn is_act_trigger_zone(zone_name: &str) -> bool {
    let name_lower = zone_name.to_lowercase();
    name_lower == "the riverbank"
        || name_lower == "vastiri outskirts"
        || name_lower == "sandswept marsh"
        || name_lower == "sandswept march"
        || name_lower == "kingsmarch"
        || name_lower == "the refuge"
        || name_lower == "the khari bazaar"
        || name_lower == "the glade"
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RunMode {
    Idle,
    ShadowRecord,
    Speedrun,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZoneAnalytics {
    pub total_duration_ms: i64,
    pub visits_count: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct FsmSplit {
    pub zone_name: String,
    pub ref_elapsed_ms: i64,
    pub ref_duration_ms: i64,
    pub actual_elapsed_ms: Option<i64>,
    pub actual_duration_ms: Option<i64>,
    pub delta_ms: Option<i64>,
    pub visit_number: Option<usize>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FsmStatePayload {
    pub mode: RunMode,
    pub total_elapsed_ms: i64,
    pub total_town_time_ms: i64,
    pub is_in_town: bool,
    pub current_zone: String,
    pub current_split_index: usize,
    pub current_split_name: String,
    pub delta_ms: i64,
    pub route_splits: Vec<FsmSplit>,
    pub is_paused: bool,
}

pub struct SpeedrunFsm {
    pub mode: RunMode,
    pub run_start_time: Option<DateTime<Utc>>,
    pub total_elapsed_ms: i64,
    pub current_zone: String,
    pub visited_zones_set: HashSet<String>,
    pub route_splits: Vec<Split>,
    pub town_zones: HashSet<String>,
    pub total_town_time_ms: i64,
    pub last_town_entry: Option<DateTime<Utc>>,
    pub is_in_town: bool,
    pub zone_analytics: HashMap<String, ZoneAnalytics>,
    pub last_zone_name: Option<String>,
    pub last_zone_entry_time: Option<DateTime<Utc>>,
    pub reference_route: Option<Route>,
    pub route_file_path: Option<String>,
    
    // --- НОВЫЕ ПОЛЯ ДЛЯ ЧЕК-ЛИСТА ---
    pub actual_durations: Vec<Option<i64>>, 
    pub active_split_index: Option<usize>,  
    // --------------------------------
    
    pub is_paused: bool,
    pub paused_at: Option<DateTime<Utc>>,
    pub total_paused_duration_ms: i64,
    pub is_muling: bool,
    pub visited_split_order: Vec<usize>,
}

impl SpeedrunFsm {
    pub fn new() -> Self {
        let town_zones = TOWN_ZONES_ARRAY.iter().map(|&s| s.to_string()).collect();
        Self {
            mode: RunMode::Idle,
            run_start_time: None,
            total_elapsed_ms: 0,
            current_zone: "Unknown".to_string(),
            visited_zones_set: HashSet::new(),
            route_splits: Vec::new(),
            town_zones,
            total_town_time_ms: 0,
            last_town_entry: None,
            is_in_town: false,
            zone_analytics: HashMap::new(),
            last_zone_name: None,
            last_zone_entry_time: None,
            reference_route: None,
            route_file_path: None,
            actual_durations: Vec::new(),
            active_split_index: None,
            is_paused: false,
            paused_at: None,
            total_paused_duration_ms: 0,
            is_muling: false,
            visited_split_order: Vec::new(),
        }
    }

    pub fn start_run(&mut self, mode: RunMode, reference_route: Option<Route>, reference_route_path: Option<String>, is_muling: bool) {
        self.mode = mode;
        self.run_start_time = None;
        self.total_elapsed_ms = 0;
        self.total_town_time_ms = 0;
        self.last_town_entry = None;
        self.is_in_town = false;
        self.visited_zones_set.clear();
        self.route_splits.clear();
        self.zone_analytics.clear();
        self.last_zone_name = None;
        self.last_zone_entry_time = None;
        self.current_zone = "Unknown".to_string();
        self.actual_durations.clear();
        self.active_split_index = None;
        self.is_paused = false;
        self.paused_at = None;
        self.total_paused_duration_ms = 0;
        self.route_file_path = reference_route_path;
        self.is_muling = is_muling;
        self.visited_split_order.clear();

        if mode == RunMode::Speedrun {
            if let Some(ref route) = reference_route {
                self.route_splits = route.splits.clone();
                self.actual_durations = vec![None; self.route_splits.len()];
            }
            self.reference_route = reference_route;
        } else {
            self.reference_route = None;
        }
    }

    pub fn resume_run(&mut self, route: Route, route_path: Option<String>, mode: RunMode) {
        self.mode = mode;
        self.run_start_time = None;
        self.route_splits = route.splits.clone();
        
        self.visited_zones_set.clear();
        self.actual_durations.clear();
        for i in 0..self.route_splits.len() {
            let split = &self.route_splits[i];
            self.visited_zones_set.insert(split.zone_name.clone());
            
            let ref_entry = if i == 0 { 0 } else { self.route_splits[i - 1].elapsed_ms };
            let duration = split.elapsed_ms - ref_entry;
            self.actual_durations.push(Some(duration));
        }
        self.visited_split_order = (0..self.route_splits.len()).collect();
        self.active_split_index = None;
        
        let last_elapsed = self.route_splits.last().map(|s| s.elapsed_ms).unwrap_or(0);
        self.total_elapsed_ms = last_elapsed;
        
        if mode == RunMode::Speedrun {
            self.reference_route = Some(route);
        } else {
            self.reference_route = None;
        }
        self.route_file_path = route_path;
        
        self.active_split_index = None;
        self.is_paused = false;
        self.paused_at = None;
        self.total_paused_duration_ms = 0;
        
        self.is_in_town = false;
        self.last_town_entry = None;
        self.total_town_time_ms = 0;
        self.last_zone_name = None;
        self.last_zone_entry_time = None;
        self.current_zone = "Unknown".to_string();
    }
    
    // Вспомогательная функция сборки финального роута
    pub fn get_completed_route(&self) -> Vec<Split> {
        let mut new_splits = Vec::new();
        let mut cumulative = 0;
        for i in 0..self.route_splits.len() {
            let dur = self.actual_durations.get(i).copied().flatten().unwrap_or_else(|| {
                let r_entry = if i == 0 { 0 } else { self.route_splits[i-1].elapsed_ms };
                let r_exit = self.route_splits[i].elapsed_ms;
                r_exit - r_entry
            });
            cumulative += dur;
            new_splits.push(Split {
                zone_name: self.route_splits[i].zone_name.clone(),
                elapsed_ms: cumulative,
            });
        }
        new_splits
    }

    pub fn stop_run(&mut self) {
        let now = Utc::now();
        if let Some(prev_zone) = self.last_zone_name.take() {
            if let Some(entry_time) = self.last_zone_entry_time {
                let duration_ms = now.signed_duration_since(entry_time).num_milliseconds();
                if duration_ms > 0 {
                    let entry = self.zone_analytics.entry(prev_zone).or_insert(ZoneAnalytics {
                        total_duration_ms: 0,
                        visits_count: 0,
                    });
                    entry.total_duration_ms += duration_ms;
                }
            }
        }
        self.mode = RunMode::Idle;
    }

    pub fn stop_and_save_run(&mut self) -> Result<String, String> {
        let mut saved_message = String::new();
        let mode = self.mode;
        let route_splits = self.route_splits.clone();
        
        if mode == RunMode::ShadowRecord && !route_splits.is_empty() {
            let exe_dir = std::env::current_exe().ok().and_then(|p| p.parent().map(|parent| parent.to_path_buf())).unwrap_or_else(|| std::path::PathBuf::from("."));
            let routes_dir = exe_dir.join("routes");
            if let Err(e) = std::fs::create_dir_all(&routes_dir) {
                return Err(format!("Failed to create routes directory. System Access Denied: {:?}", e));
            } else {
                let filename = format!("route_{}.json", chrono::Utc::now().format("%Y%m%d_%H%M%S"));
                let file_path = routes_dir.join(&filename);
                if let Err(e) = self.export_route(&file_path) {
                    return Err(format!("Failed to auto-save route: {:?}", e));
                } else {
                    if let Ok(absolute_path) = std::fs::canonicalize(&file_path) {
                        saved_message = absolute_path.to_string_lossy().to_string();
                    } else {
                        saved_message = file_path.to_string_lossy().to_string();
                    }
                }
            }
        } else if mode == RunMode::Speedrun {
            if self.actual_durations.iter().all(|x| x.is_none()) {
                saved_message = "Run stopped. Warning: No splits were completed, so the route file was not updated.".to_string();
            } else if let Some(ref _route) = self.reference_route {
                let new_route = Route {
                    name: format!("Speedrun_Run_{}", chrono::Utc::now().format("%Y%m%d_%H%M%S")),
                    created_at: chrono::Utc::now(),
                    splits: self.get_completed_route(),
                };
                
                let exe_dir = std::env::current_exe().ok().and_then(|p| p.parent().map(|parent| parent.to_path_buf())).unwrap_or_else(|| std::path::PathBuf::from("."));
                let routes_dir = exe_dir.join("routes");
                if let Err(e) = std::fs::create_dir_all(&routes_dir) {
                    return Err(format!("Failed to create routes directory. System Access Denied: {:?}", e));
                } else {
                    let filename = format!("route_speedrun_{}.json", chrono::Utc::now().format("%Y%m%d_%H%M%S"));
                    let file_path = routes_dir.join(&filename);
                    if let Ok(file) = std::fs::File::create(&file_path) {
                        if serde_json::to_writer_pretty(file, &new_route).is_ok() {
                            if let Ok(absolute_path) = std::fs::canonicalize(&file_path) {
                                saved_message = absolute_path.to_string_lossy().to_string();
                            } else {
                                saved_message = file_path.to_string_lossy().to_string();
                            }
                        } else {
                            return Err("Failed to serialize route to JSON.".to_string());
                        }
                    } else {
                        return Err("Failed to create file in routes directory.".to_string());
                    }
                }
            }
        }

        self.stop_run();
        if !saved_message.is_empty() { Ok(saved_message) } else { Ok("Run stopped".to_string()) }
    }

    pub fn toggle_pause(&mut self) {
        if self.mode == RunMode::Idle || self.run_start_time.is_none() {
            return;
        }

        let now = Utc::now();
        if self.is_paused {
            if let Some(paused_at) = self.paused_at {
                let duration = now.signed_duration_since(paused_at).num_milliseconds();
                if duration > 0 {
                    self.total_paused_duration_ms += duration;
                    if let Some(ref mut start) = self.run_start_time {
                        *start = *start + chrono::Duration::milliseconds(duration);
                    }
                    if let Some(ref mut entry) = self.last_town_entry {
                        *entry = *entry + chrono::Duration::milliseconds(duration);
                    }
                    if let Some(ref mut entry) = self.last_zone_entry_time {
                        *entry = *entry + chrono::Duration::milliseconds(duration);
                    }
                }
            }
            self.is_paused = false;
            self.paused_at = None;
        } else {
            self.is_paused = true;
            self.paused_at = Some(now);
        }
    }

    pub fn update_timers(&mut self) {
        if self.mode == RunMode::Idle {
            return;
        }
        
        let now = Utc::now();
        if let Some(start) = self.run_start_time {
            if self.is_paused {
                if let Some(paused_at) = self.paused_at {
                    self.total_elapsed_ms = paused_at.signed_duration_since(start).num_milliseconds();
                }
            } else {
                self.total_elapsed_ms = now.signed_duration_since(start).num_milliseconds();
            }
        }
    }

    pub fn handle_zone_transition(&mut self, zone_name: String, timestamp: DateTime<Utc>) {
        if self.mode == RunMode::Idle { return; }
        if self.is_paused { self.toggle_pause(); }

        if self.run_start_time.is_none() {
            let should_start = match self.mode {
                RunMode::ShadowRecord => !self.route_splits.is_empty() || zone_name.to_lowercase().contains("riverbank"),
                RunMode::Speedrun => !self.route_splits.is_empty() && zone_name.trim().eq_ignore_ascii_case(self.route_splits[0].zone_name.trim()),
                RunMode::Idle => false,
            };
            if should_start { self.run_start_time = Some(timestamp); } else { return; }
        }

        self.current_zone = zone_name.clone();

        // 1. АКУММУЛИРУЕМ ВРЕМЯ ПРОШЛОЙ ЗОНЫ
        if let Some(prev_zone) = self.last_zone_name.take() {
            if let Some(entry_time) = self.last_zone_entry_time {
                let duration_ms = timestamp.signed_duration_since(entry_time).num_milliseconds();
                if duration_ms > 0 {
                    let entry = self.zone_analytics.entry(prev_zone).or_insert(ZoneAnalytics { total_duration_ms: 0, visits_count: 0 });
                    entry.total_duration_ms += duration_ms;
                }
                
                if let Some(idx) = self.active_split_index {
                    if idx < self.actual_durations.len() {
                        let existing = self.actual_durations[idx].unwrap_or(0);
                        self.actual_durations[idx] = Some(existing + duration_ms);
                    }
                }
            }
        }
        
        self.last_zone_name = Some(zone_name.clone());
        self.last_zone_entry_time = Some(timestamp);
        let zone_analytics_entry = self.zone_analytics.entry(zone_name.clone()).or_insert(ZoneAnalytics { total_duration_ms: 0, visits_count: 0 });
        zone_analytics_entry.visits_count += 1;

        let is_town = is_town_zone(&zone_name);
        
        if is_town {
            if !self.is_in_town {
                self.is_in_town = true;
                self.last_town_entry = Some(timestamp);
            }
        } else if self.is_in_town {
            if let Some(entry_time) = self.last_town_entry {
                let duration = timestamp.signed_duration_since(entry_time).num_milliseconds();
                if duration > 0 { self.total_town_time_ms += duration; }
            }
            self.is_in_town = false;
            self.last_town_entry = None;
        }

        let mut skip_split = false;
        if self.is_muling && zone_name.trim().eq_ignore_ascii_case("the riverbank") {
            let visits = self.zone_analytics.get(&zone_name).map(|z| z.visits_count).unwrap_or(0);
            if visits <= 1 { skip_split = true; }
        }

        let is_act_trigger = is_act_trigger_zone(&zone_name);

        // 2. ИЩЕМ ЗОНУ (ПРИВЯЗКА К СЛОВАРЮ/ЛОКАЦИИ)
        if (!is_town || is_act_trigger) && !skip_split {
            let mut found_idx = None;
            for i in 0..self.route_splits.len() {
                if self.route_splits[i].zone_name.trim().eq_ignore_ascii_case(zone_name.trim()) {
                    found_idx = Some(i);
                    break;
                }
            }

            if let Some(idx) = found_idx {
                self.active_split_index = Some(idx);
                if !self.visited_split_order.contains(&idx) {
                    self.visited_split_order.push(idx);
                }
            } else {
                // ДОБАВЛЯЕМ НОВУЮ СРАЗУ ПОСЛЕ ТЕКУЩЕЙ (БЕЗ ДУБЛИКАТОВ)
                let insert_pos = self.active_split_index.map(|idx| idx + 1).unwrap_or(self.route_splits.len());
                let ref_elapsed = if insert_pos > 0 && insert_pos <= self.route_splits.len() { 
                    self.route_splits[insert_pos - 1].elapsed_ms 
                } else { 0 };
                
                self.route_splits.insert(insert_pos, Split { zone_name: zone_name.clone(), elapsed_ms: ref_elapsed });
                self.actual_durations.insert(insert_pos, None);
                self.active_split_index = Some(insert_pos);

                for order_idx in &mut self.visited_split_order {
                    if *order_idx >= insert_pos {
                        *order_idx += 1;
                    }
                }
                self.visited_split_order.push(insert_pos);
            }
        } else {
            self.active_split_index = None;
        }
    }

    pub fn reorder_splits(&mut self, new_indices: Vec<usize>) -> Result<(), String> {
        if new_indices.len() != self.route_splits.len() {
            return Err("Invalid indices length".to_string());
        }

        let mut seen = std::collections::HashSet::new();
        for &idx in &new_indices {
            if idx >= self.route_splits.len() {
                return Err("Index out of bounds".to_string());
            }
            if !seen.insert(idx) {
                return Err("Duplicate index".to_string());
            }
        }

        let mut new_route_splits = Vec::with_capacity(self.route_splits.len());
        let mut new_actual_durations = Vec::with_capacity(self.actual_durations.len());

        for &idx in &new_indices {
            new_route_splits.push(self.route_splits[idx].clone());
            new_actual_durations.push(self.actual_durations[idx]);
        }

        if let Some(active_idx) = self.active_split_index {
            if let Some(new_idx) = new_indices.iter().position(|&x| x == active_idx) {
                self.active_split_index = Some(new_idx);
            } else {
                self.active_split_index = None;
            }
        }

        let mut new_visited_order = Vec::new();
        for &old_idx in &self.visited_split_order {
            if let Some(new_idx) = new_indices.iter().position(|&x| x == old_idx) {
                new_visited_order.push(new_idx);
            }
        }
        self.visited_split_order = new_visited_order;

        let mut old_durations = Vec::with_capacity(self.route_splits.len());
        for i in 0..self.route_splits.len() {
            let ref_entry = if i == 0 { 0 } else { self.route_splits[i - 1].elapsed_ms };
            let ref_exit = self.route_splits[i].elapsed_ms;
            old_durations.push(ref_exit - ref_entry);
        }

        self.route_splits = new_route_splits;
        self.actual_durations = new_actual_durations;

        let mut cumulative_elapsed = 0;
        for (new_pos, &old_idx) in new_indices.iter().enumerate() {
            let duration = old_durations[old_idx];
            cumulative_elapsed += duration;
            self.route_splits[new_pos].elapsed_ms = cumulative_elapsed;
        }

        Ok(())
    }

    pub fn export_route<P: AsRef<Path>>(&self, path: P) -> Result<(), std::io::Error> {
        let route = Route {
            name: format!("Route_{}", Utc::now().format("%Y%m%d_%H%M%S")),
            created_at: Utc::now(),
            splits: self.route_splits.clone(),
        };
        let file = std::fs::File::create(path)?;
        serde_json::to_writer_pretty(file, &route)?;
        Ok(())
    }

    pub fn generate_payload(&self) -> FsmStatePayload {
        let mut route_splits = Vec::new();

        for i in 0..self.route_splits.len() {
            let ref_entry = if i == 0 { 0 } else { self.route_splits[i - 1].elapsed_ms };
            let ref_exit = self.route_splits[i].elapsed_ms;
            let ref_duration_ms = ref_exit - ref_entry;

            let mut actual_duration_ms = self.actual_durations.get(i).copied().flatten();
            
            // Если сегмент активен, прибавляем тикающее время к уже накопленному
            if Some(i) == self.active_split_index {
                if let Some(entry_time) = self.last_zone_entry_time {
                    let mut live_dur = Utc::now().signed_duration_since(entry_time).num_milliseconds();
                    if self.is_paused {
                        if let Some(paused_at) = self.paused_at {
                            live_dur = paused_at.signed_duration_since(entry_time).num_milliseconds();
                        }
                    }
                    let existing = actual_duration_ms.unwrap_or(0);
                    actual_duration_ms = Some(existing + live_dur);
                }
            }

            // Muling логика
            let is_muling_skip = self.is_muling 
                && self.route_splits[i].zone_name.trim().eq_ignore_ascii_case("the riverbank") 
                && self.zone_analytics.get(&self.route_splits[i].zone_name).map(|z| z.visits_count).unwrap_or(0) <= 1;

            if is_muling_skip {
                actual_duration_ms = None;
            }

            let delta_ms = if let Some(act) = actual_duration_ms {
                if self.mode == RunMode::Speedrun { Some(act - ref_duration_ms) } else { None }
            } else { None };

            let visit_number = self.visited_split_order.iter().position(|&idx| idx == i).map(|pos| pos + 1);

            route_splits.push(FsmSplit {
                zone_name: self.route_splits[i].zone_name.clone(),
                ref_elapsed_ms: ref_exit,
                ref_duration_ms,
                actual_elapsed_ms: None, 
                actual_duration_ms,
                delta_ms,
                visit_number,
            });
        }

        let mut live_town_time = self.total_town_time_ms;
        if self.is_in_town {
            if let Some(entry) = self.last_town_entry {
                let mut duration = Utc::now().signed_duration_since(entry).num_milliseconds();
                if self.is_paused {
                    if let Some(paused_at) = self.paused_at {
                        duration = paused_at.signed_duration_since(entry).num_milliseconds();
                    }
                }
                if duration > 0 { live_town_time += duration; }
            }
        }

        let current_split_index = self.active_split_index.unwrap_or_else(|| {
            self.actual_durations.iter().position(|d| d.is_none()).unwrap_or(self.route_splits.len())
        });
        
        let current_split_name = self.route_splits.get(current_split_index).map(|s| s.zone_name.clone()).unwrap_or_default();

        FsmStatePayload {
            mode: self.mode,
            total_elapsed_ms: self.total_elapsed_ms,
            total_town_time_ms: live_town_time,
            is_in_town: self.is_in_town,
            current_zone: self.current_zone.clone(),
            current_split_index,
            current_split_name,
            delta_ms: 0,
            route_splits,
            is_paused: self.is_paused,
        }
    }
}