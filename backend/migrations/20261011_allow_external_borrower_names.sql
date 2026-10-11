SET @borrower_name_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'borrowings'
    AND COLUMN_NAME = 'borrower_name'
);

SET @prepare_borrower_name = IF(
  @borrower_name_exists = 0,
  'ALTER TABLE borrowings ADD COLUMN borrower_name VARCHAR(255) NULL AFTER borrower_id',
  'ALTER TABLE borrowings MODIFY borrower_name VARCHAR(255) NULL'
);

PREPARE add_or_update_borrower_name FROM @prepare_borrower_name;
EXECUTE add_or_update_borrower_name;
DEALLOCATE PREPARE add_or_update_borrower_name;

UPDATE borrowings b
LEFT JOIN users u ON u.user_id = b.borrower_id
SET b.borrower_name = COALESCE(NULLIF(TRIM(b.borrower_name), ''), u.full_name, 'Unknown borrower')
WHERE b.borrower_name IS NULL OR TRIM(b.borrower_name) = '';

ALTER TABLE borrowings
  MODIFY borrower_name VARCHAR(255) NOT NULL;

SET @borrower_id_type = (
  SELECT COLUMN_TYPE
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'borrowings'
    AND COLUMN_NAME = 'borrower_id'
);

SET @make_borrower_optional = CONCAT(
  'ALTER TABLE borrowings MODIFY borrower_id ',
  @borrower_id_type,
  ' NULL'
);

PREPARE make_borrower_optional FROM @make_borrower_optional;
EXECUTE make_borrower_optional;
DEALLOCATE PREPARE make_borrower_optional;
