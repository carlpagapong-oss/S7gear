-- S7Gear database schema based on the ERD supplied on 2026-10-26
-- MySQL / MariaDB compatible (e.g. XAMPP)
-- IMPORTANT:
-- 1) This script creates the database/tables if they do not already exist.
-- 2) It does NOT DROP tables or erase existing records.
-- 3) ENUM choices below are reasonable inferred values because the ERD image
--    clips the exact ENUM definitions. Adjust them if your existing schema differs.

CREATE DATABASE IF NOT EXISTS s7gear
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;

USE s7gear;

CREATE TABLE IF NOT EXISTS roles (
    role_id INT NOT NULL AUTO_INCREMENT,
    role_name VARCHAR(50) NOT NULL,
    description VARCHAR(255) NULL,
    PRIMARY KEY (role_id),
    UNIQUE KEY uq_roles_role_name (role_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS users (
    user_id INT NOT NULL AUTO_INCREMENT,
    role_id INT NOT NULL,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(150) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    account_status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    UNIQUE KEY uq_users_username (username),
    UNIQUE KEY uq_users_email (email),
    KEY idx_users_role_id (role_id),
    CONSTRAINT fk_users_roles
      FOREIGN KEY (role_id) REFERENCES roles (role_id)
      ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS tool_categories (
    category_id INT NOT NULL AUTO_INCREMENT,
    category_name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NULL,
    PRIMARY KEY (category_id),
    UNIQUE KEY uq_tool_categories_category_name (category_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS tools (
    tool_id INT NOT NULL AUTO_INCREMENT,
    tool_code VARCHAR(50) NOT NULL,
    category_id INT NOT NULL,
    tool_type VARCHAR(100) NOT NULL,
    brand VARCHAR(100) NULL,
    model VARCHAR(100) NULL,
    power_type ENUM('corded', 'cordless') NOT NULL,
    image_path VARCHAR(500) NULL,
    current_status ENUM('available', 'borrowed', 'under_maintenance', 'retired') NOT NULL DEFAULT 'available',
    current_condition ENUM('new', 'good', 'fair', 'poor', 'damaged') NOT NULL DEFAULT 'new',
    purchase_date DATE NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (tool_id),
    UNIQUE KEY uq_tools_tool_code (tool_code),
    KEY idx_tools_category_id (category_id),
    KEY idx_tools_current_status (current_status),
    CONSTRAINT fk_tools_tool_categories
      FOREIGN KEY (category_id) REFERENCES tool_categories (category_id)
      ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS borrowings (
    borrowing_id INT NOT NULL AUTO_INCREMENT,
    borrowing_name VARCHAR(255) NOT NULL,
    borrower_id INT NOT NULL,
    borrowed_at DATETIME NOT NULL,
    expected_return_at DATETIME NOT NULL,
    status ENUM('pending', 'approved', 'borrowed', 'returned', 'overdue', 'cancelled') NOT NULL DEFAULT 'pending',
    purpose VARCHAR(255) NULL,
    remarks TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (borrowing_id),
    KEY idx_borrowings_borrower_id (borrower_id),
    KEY idx_borrowings_status (status),
    KEY idx_borrowings_expected_return_at (expected_return_at),
    CONSTRAINT fk_borrowings_users
      FOREIGN KEY (borrower_id) REFERENCES users (user_id)
      ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS borrowing_items (
    borrowing_item_id INT NOT NULL AUTO_INCREMENT,
    borrowing_id INT NOT NULL,
    tool_id INT NOT NULL,
    condition_when_borrowed ENUM('new', 'good', 'fair', 'poor', 'damaged') NOT NULL,
    condition_when_returned ENUM('new', 'good', 'fair', 'poor', 'damaged') NULL,
    returned_at DATETIME NULL,
    remarks TEXT NULL,
    PRIMARY KEY (borrowing_item_id),
    KEY idx_borrowing_items_borrowing_id (borrowing_id),
    KEY idx_borrowing_items_tool_id (tool_id),
    KEY idx_borrowing_items_returned_at (returned_at),
    CONSTRAINT fk_borrowing_items_borrowings
      FOREIGN KEY (borrowing_id) REFERENCES borrowings (borrowing_id)
      ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_borrowing_items_tools
      FOREIGN KEY (tool_id) REFERENCES tools (tool_id)
      ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS inspection_schedule (
    inspection_schedule_id BIGINT NOT NULL AUTO_INCREMENT,
    scheduled_date DATE NOT NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (inspection_schedule_id),
    KEY idx_inspection_schedule_scheduled_date (scheduled_date),
    KEY idx_inspection_schedule_created_by (created_by),
    CONSTRAINT fk_inspection_schedule_users
      FOREIGN KEY (created_by) REFERENCES users (user_id)
      ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS safety_inspections (
    inspection_id INT NOT NULL AUTO_INCREMENT,
    tool_id INT NOT NULL,
    inspector_id INT NOT NULL,
    inspection_date DATETIME NOT NULL,
    result ENUM('passed', 'failed', 'needs_attention') NOT NULL,
    condition_found ENUM('new', 'good', 'fair', 'poor', 'damaged') NOT NULL,
    findings TEXT NULL,
    corrective_action TEXT NULL,
    remarks TEXT NULL,
    PRIMARY KEY (inspection_id),
    KEY idx_safety_inspections_tool_id (tool_id),
    KEY idx_safety_inspections_inspector_id (inspector_id),
    KEY idx_safety_inspections_inspection_date (inspection_date),
    CONSTRAINT fk_safety_inspections_tools
      FOREIGN KEY (tool_id) REFERENCES tools (tool_id)
      ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_safety_inspections_inspector
      FOREIGN KEY (inspector_id) REFERENCES users (user_id)
      ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS maintenance_records (
    maintenance_id INT NOT NULL AUTO_INCREMENT,
    tool_id INT NOT NULL,
    maintenance_type VARCHAR(100) NOT NULL,
    description TEXT NULL,
    maintenance_status ENUM('pending', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
    started_at DATETIME NULL,
    completed_at DATETIME NULL,
    parts_replaced TEXT NULL,
    remarks TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (maintenance_id),
    KEY idx_maintenance_records_tool_id (tool_id),
    KEY idx_maintenance_records_status (maintenance_status),
    CONSTRAINT fk_maintenance_records_tools
      FOREIGN KEY (tool_id) REFERENCES tools (tool_id)
      ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Optional starter role records. Uncomment if you want these exact role names.
-- INSERT IGNORE INTO roles (role_name, description) VALUES
-- ('Administrator', 'Manages users and system configuration'),
-- ('Safety Officer', 'Schedules and records safety inspections'),
-- ('Tool Manager', 'Manages tool records and borrowing transactions'),
-- ('Construction Worker', 'Borrows and returns tools');
