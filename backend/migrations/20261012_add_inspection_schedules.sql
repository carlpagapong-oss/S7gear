CREATE TABLE IF NOT EXISTS inspection_schedules (
  inspection_schedule_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  scheduled_date DATE NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (inspection_schedule_id),
  KEY idx_inspection_schedules_date (scheduled_date, inspection_schedule_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
