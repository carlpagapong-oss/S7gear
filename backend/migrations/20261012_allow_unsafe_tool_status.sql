ALTER TABLE tools
  MODIFY COLUMN current_status
    ENUM(
      'Available',
      'Borrowed',
      'Under Inspection',
      'Under Maintenance',
      'Unavailable',
      'Unsafe'
    ) NOT NULL DEFAULT 'Available';
