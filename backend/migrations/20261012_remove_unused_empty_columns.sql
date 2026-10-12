ALTER TABLE borrowings
  DROP FOREIGN KEY fk_borrowings_processed_by,
  DROP COLUMN processed_by;

ALTER TABLE maintenance_records
  DROP FOREIGN KEY fk_maintenance_reported_by,
  DROP COLUMN reported_by,
  DROP COLUMN cost;

ALTER TABLE safety_inspections
  DROP COLUMN next_inspection_date;

ALTER TABLE tools
  DROP COLUMN archived_at;
