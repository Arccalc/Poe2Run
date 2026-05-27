use std::path::PathBuf;
use std::time::Duration;
use tokio::fs::File;
use tokio::io::{AsyncReadExt, AsyncSeekExt, SeekFrom};
use tokio::sync::mpsc;
use chrono::{DateTime, Utc, TimeZone, Local};

pub struct LogParser {
    file_path: PathBuf,
}

impl LogParser {
    pub fn new(file_path: PathBuf) -> Self {
        Self { file_path }
    }

    /// Starts tailing the Client.txt file and sends zone transition events to the channel.
    /// It starts from the current end of the file to ignore past logs, but we can also
    /// configure it to read from the start if needed.
    pub async fn start_tailing(
        self,
        tx: mpsc::Sender<(String, DateTime<Utc>)>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut file = match File::open(&self.file_path).await {
            Ok(f) => f,
            Err(_e) => {
                // If file does not exist, wait for it to appear
                tokio::time::sleep(Duration::from_secs(2)).await;
                File::open(&self.file_path).await?
            }
        };

        // Seek to the end of the file on startup so we only capture new logs
        let mut current_pos = file.seek(SeekFrom::End(0)).await?;
        let mut buffer = vec![0u8; 8192];
        let mut leftover = String::new();

        loop {
            let metadata = match file.metadata().await {
                Ok(m) => m,
                Err(_) => {
                    // Handle file rotation or temporary access loss
                    tokio::time::sleep(Duration::from_millis(500)).await;
                    if let Ok(f) = File::open(&self.file_path).await {
                        file = f;
                        current_pos = file.seek(SeekFrom::End(0)).await.unwrap_or(0);
                    }
                    continue;
                }
            };

            let len = metadata.len();
            if len < current_pos {
                // File was truncated or recreated, reset position to start
                current_pos = file.seek(SeekFrom::Start(0)).await?;
                leftover.clear();
            } else if len > current_pos {
                // Read new bytes
                loop {
                    let bytes_read = file.read(&mut buffer).await?;
                    if bytes_read == 0 {
                        break;
                    }
                    current_pos += bytes_read as u64;

                    // Parse new string content
                    let content = leftover.clone() + &String::from_utf8_lossy(&buffer[..bytes_read]);
                    let mut lines: Vec<&str> = content.split('\n').collect();
                    
                    // The last line might be incomplete, save it for the next read
                    if let Some(last) = lines.pop() {
                        leftover = last.to_string();
                    } else {
                        leftover.clear();
                    }

                    for line in lines {
                        if let Some((zone_name, timestamp)) = Self::parse_line(line) {
                            if let Err(e) = tx.send((zone_name, timestamp)).await {
                                eprintln!("Error sending parsed zone event: {}", e);
                            }
                        }
                    }
                }
            }

            // Sleep briefly to avoid 100% CPU usage
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    }

    /// Parses a single line from Client.txt.
    /// Expected format example (PoE 1):
    /// 2024/11/20 18:23:45 12345678 9a [INFO Client 12345] : You have entered The Forest Ruins.
    /// Expected format example (PoE 2):
    /// 2026/05/22 18:35:48 87566562 7fbd122e [INFO Client 25548] [SCENE] Set Source [Clearfell]
    pub fn parse_line(line: &str) -> Option<(String, DateTime<Utc>)> {
        let timestamp = Self::extract_timestamp(line).unwrap_or_else(Utc::now);

        if let Some(pos) = line.find(" : You have entered ") {
            let zone_name = line[pos + " : You have entered ".len()..].trim().to_string();
            if !zone_name.is_empty() {
                return Some((zone_name, timestamp));
            }
        } else if let Some(pos) = line.find("] [SCENE] Set Source [") {
            let start = pos + "] [SCENE] Set Source [".len();
            if let Some(end_offset) = line[start..].find(']') {
                let zone_name = line[start..start + end_offset].trim().to_string();
                if !zone_name.is_empty() {
                    let name_lower = zone_name.to_lowercase();
                    let is_ignored_act = name_lower.starts_with("act ") || name_lower.starts_with("interlude ");
                    if name_lower != "(null)"
                        && name_lower != "(unknown)"
                        && name_lower != "unknown"
                        && name_lower != "null"
                        && !is_ignored_act
                        && !(zone_name.starts_with('(') && zone_name.ends_with(')'))
                    {
                        return Some((zone_name, timestamp));
                    }
                }
            }
        }
        None
    }

    fn extract_timestamp(line: &str) -> Option<DateTime<Utc>> {
        if line.len() >= 19 {
            let timestamp_str = &line[0..19];
            if let Ok(naive_dt) = chrono::NaiveDateTime::parse_from_str(timestamp_str, "%Y/%m/%d %H:%M:%S") {
                if let Some(local_dt) = Local.from_local_datetime(&naive_dt).earliest() {
                    return Some(local_dt.with_timezone(&Utc));
                }
            }
        }
        None
    }
}

