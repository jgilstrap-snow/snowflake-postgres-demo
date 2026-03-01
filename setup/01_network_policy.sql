-- =============================================================================
-- Snowflake Postgres Demo: Network Policy Setup
-- =============================================================================
-- This script creates the network rules and policy required to connect to
-- Snowflake Postgres from external clients (DBeaver, React app, etc.)
-- =============================================================================

USE ROLE ACCOUNTADMIN;

-- Grant permission to create Postgres instances
GRANT CREATE POSTGRES INSTANCE ON ACCOUNT TO ROLE SYSADMIN;

USE ROLE SYSADMIN;

-- Create database and schema for network objects
CREATE DATABASE IF NOT EXISTS POSTGRES_DEMO_DB;
CREATE SCHEMA IF NOT EXISTS POSTGRES_DEMO_DB.NETWORK;

USE POSTGRES_DEMO_DB.NETWORK;

-- =============================================================================
-- Network Rules
-- =============================================================================
-- Replace the IP addresses below with your actual IPs:
--   - Your home/office IP (for DBeaver, local React app)
--   - Any other IPs that need access
--
-- IMPORTANT: Use CIDR notation (e.g., 136.55.6.239/32 for a single IP)
-- =============================================================================

CREATE OR REPLACE NETWORK RULE POSTGRES_INGRESS_RULE
    TYPE = IPV4
    MODE = POSTGRES_INGRESS
    VALUE_LIST = (
        '136.55.6.239/32'  -- Replace with your IP
        -- Add more IPs as needed, e.g.:
        -- '10.0.0.0/8'    -- Internal network range
    );

CREATE OR REPLACE NETWORK RULE POSTGRES_EGRESS_RULE
    TYPE = IPV4
    MODE = POSTGRES_EGRESS
    VALUE_LIST = (
        '136.55.6.239/32'  -- Replace with your IP
    );

-- =============================================================================
-- Network Policy
-- =============================================================================

CREATE OR REPLACE NETWORK POLICY POSTGRES_DEMO_POLICY
    ALLOWED_NETWORK_RULE_LIST = (
        POSTGRES_INGRESS_RULE,
        POSTGRES_EGRESS_RULE
    );

-- Verify
SHOW NETWORK RULES;
SHOW NETWORK POLICIES;
