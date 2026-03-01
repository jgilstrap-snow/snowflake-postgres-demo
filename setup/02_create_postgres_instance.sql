-- =============================================================================
-- Snowflake Postgres Demo: Create Postgres Instance
-- =============================================================================
-- This script creates a Snowflake Postgres instance for the demo.
-- =============================================================================

USE ROLE SYSADMIN;

-- =============================================================================
-- Create Postgres Instance
-- =============================================================================
-- IMPORTANT: Save the output credentials! They contain:
--   - "application" password (for app user)
--   - "snowflake_admin" password (for admin user)
--   - hostname (for connection string)
-- =============================================================================

CREATE POSTGRES INSTANCE ECOMMERCE_DEMO
    COMPUTE_FAMILY = STANDARD_M
    STORAGE_SIZE_GB = 10
    AUTHENTICATION_AUTHORITY = POSTGRES
    POSTGRES_VERSION = 17
    HIGH_AVAILABILITY = FALSE
    NETWORK_POLICY = POSTGRES_DEMO_DB.NETWORK.POSTGRES_DEMO_POLICY
    COMMENT = 'E-commerce demo - Snowflake Postgres 17';

-- =============================================================================
-- Check Instance Status
-- =============================================================================
-- Wait for the instance to become ACTIVE (typically 2-5 minutes)

SHOW POSTGRES SERVICES;

DESCRIBE POSTGRES SERVICE ECOMMERCE_DEMO;

-- =============================================================================
-- Connection Details
-- =============================================================================
-- Once ACTIVE, connect using:
--   Host: <hostname from CREATE output>.postgres.snowflake.app
--   Port: 5432
--   Database: postgres (default) or create your own
--   User: snowflake_admin (for setup) or application (for apps)
--   Password: <from CREATE output>
--   SSL: Required
-- =============================================================================
