-- =============================================================================
-- Snowflake Postgres Demo: SPCS Deployment
-- =============================================================================
-- This script creates the infrastructure to deploy the React app on SPCS
-- Run this AFTER creating the Postgres instance (02_create_postgres_instance.sql)
-- =============================================================================

USE ROLE SYSADMIN;
USE DATABASE JACK;
USE SCHEMA DEMO;

-- =============================================================================
-- 1. Image Repository
-- =============================================================================
-- Create a repository to store Docker images

CREATE IMAGE REPOSITORY IF NOT EXISTS IMAGES;

-- Get the repository URL (you'll need this for docker push)
SHOW IMAGE REPOSITORIES LIKE 'IMAGES';
-- Copy the repository_url for your Docker commands

-- =============================================================================
-- 2. Compute Pool
-- =============================================================================
-- Create a compute pool for running the service
-- Note: You may already have a compute pool you want to reuse

CREATE COMPUTE POOL IF NOT EXISTS ECOMMERCE_POOL
    MIN_NODES = 1
    MAX_NODES = 2
    INSTANCE_FAMILY = CPU_X64_S
    AUTO_SUSPEND_SECS = 3600
    AUTO_RESUME = TRUE;

-- Or use an existing pool like STRONG_POOL

-- =============================================================================
-- 3. Network Rule & External Access Integration
-- =============================================================================
-- Allow SPCS to connect to Snowflake Postgres

-- Replace <POSTGRES_HOST> with your actual Postgres hostname
-- Get it from: SHOW POSTGRES INSTANCES;

CREATE OR REPLACE NETWORK RULE SPCS_POSTGRES_EGRESS
    TYPE = HOST_PORT
    MODE = EGRESS
    VALUE_LIST = ('<POSTGRES_HOST>:5432');

CREATE OR REPLACE EXTERNAL ACCESS INTEGRATION SPCS_POSTGRES_EAI
    ALLOWED_NETWORK_RULES = (SPCS_POSTGRES_EGRESS)
    ENABLED = TRUE;

-- =============================================================================
-- 4. Secret for Postgres Credentials
-- =============================================================================
-- Store Postgres credentials securely
-- Replace <USERNAME> and <PASSWORD> with your Postgres credentials

CREATE OR REPLACE SECRET POSTGRES_PASSWORD
    TYPE = PASSWORD
    USERNAME = '<USERNAME>'
    PASSWORD = '<PASSWORD>';

-- =============================================================================
-- 5. Create the Service
-- =============================================================================
-- Replace placeholders:
--   <IMAGE_TAG>: Your image tag (e.g., v1, latest, or git SHA)
--   <POSTGRES_HOST>: Your Postgres hostname
--   <COMPUTE_POOL>: ECOMMERCE_POOL or your existing pool

CREATE SERVICE ECOMMERCE_DEMO_SVC
    IN COMPUTE POOL <COMPUTE_POOL>
    EXTERNAL_ACCESS_INTEGRATIONS = (SPCS_POSTGRES_EAI)
    MIN_INSTANCES = 1
    MAX_INSTANCES = 1
    MIN_READY_INSTANCES = 1
    FROM SPECIFICATION $$
spec:
  containers:
  - name: app
    image: /jack/demo/images/ecommerce-demo:<IMAGE_TAG>
    env:
      PG_HOST: "<POSTGRES_HOST>"
      PG_PORT: "5432"
      PG_DATABASE: "postgres"
      NODE_ENV: "production"
    readinessProbe:
      port: 8080
      path: "/api/health"
    resources:
      requests:
        memory: "0.5Gi"
        cpu: "0.5"
      limits:
        memory: "2Gi"
        cpu: "2"
    secrets:
    - snowflakeSecret:
        objectName: "JACK.DEMO.POSTGRES_PASSWORD"
      secretKeyRef: "username"
      envVarName: "PG_USER"
    - snowflakeSecret:
        objectName: "JACK.DEMO.POSTGRES_PASSWORD"
      secretKeyRef: "password"
      envVarName: "PG_PASSWORD"
  endpoints:
  - name: app
    port: 8080
    public: true
$$;

-- =============================================================================
-- 6. Verify & Get Endpoint
-- =============================================================================

SHOW SERVICES LIKE 'ECOMMERCE_DEMO_SVC';
SHOW ENDPOINTS IN SERVICE ECOMMERCE_DEMO_SVC;

-- Check logs if needed:
-- SELECT SYSTEM$GET_SERVICE_LOGS('ECOMMERCE_DEMO_SVC', 0, 'app', 100);

-- =============================================================================
-- 7. Update Service (for redeployments)
-- =============================================================================
-- Use ALTER SERVICE to update to a new image without downtime

/*
ALTER SERVICE ECOMMERCE_DEMO_SVC
FROM SPECIFICATION $$
spec:
  containers:
  - name: app
    image: /jack/demo/images/ecommerce-demo:<NEW_IMAGE_TAG>
    ... (rest of spec same as above)
$$;
*/
