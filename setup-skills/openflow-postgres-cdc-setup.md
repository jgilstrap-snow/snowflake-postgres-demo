# Openflow PostgreSQL CDC Setup Guide

> Lessons learned from deploying Openflow to replicate Snowflake Postgres data into Snowflake tables using CDC.

## Overview

This guide covers setting up Openflow (Snowflake's NiFi-based data integration tool) to perform Change Data Capture (CDC) from Snowflake Postgres to Snowflake tables.

**Target setup time:** 5-10 minutes (once you know the gotchas)

## Prerequisites

- Snowflake account with ACCOUNTADMIN access
- Openflow deployment and runtime already created (SPCS type)
- Snowflake Postgres instance running
- PostgreSQL JDBC driver JAR file downloaded from https://jdbc.postgresql.org/download/

## Architecture

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  Snowflake Postgres │────▶│  Openflow Runtime   │────▶│  Snowflake Tables   │
│  (Source)           │ CDC │  (SPCS)             │     │  (Destination)      │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

## Step 1: Create PostgreSQL Publication (2 min)

Connect to your Snowflake Postgres and create a publication for the tables you want to replicate:

```sql
-- Connect via psql, DBeaver, or Node.js
CREATE PUBLICATION my_publication WITH (publish_via_partition_root = true);
ALTER PUBLICATION my_publication ADD TABLE customers, products, orders, order_items;
```

**Key point:** Every table must have a primary key for CDC to work.

## Step 2: Create Snowflake Destination Infrastructure (2 min)

```sql
USE ROLE ACCOUNTADMIN;

-- Create destination database
CREATE DATABASE IF NOT EXISTS MY_CDC_DATABASE;

-- Grant permissions to SYSADMIN (or your Openflow runtime role)
GRANT USAGE ON DATABASE MY_CDC_DATABASE TO ROLE SYSADMIN;
GRANT CREATE SCHEMA ON DATABASE MY_CDC_DATABASE TO ROLE SYSADMIN;
GRANT ALL ON DATABASE MY_CDC_DATABASE TO ROLE SYSADMIN;
```

## Step 3: Create External Access Integration for SPCS (2 min)

SPCS deployments need an EAI to connect to external services (including Snowflake Postgres):

```sql
USE ROLE ACCOUNTADMIN;

-- Create network rule for your Postgres host
CREATE OR REPLACE NETWORK RULE my_postgres_network_rule
  TYPE = HOST_PORT
  MODE = EGRESS
  VALUE_LIST = ('your-postgres-host.snowflake.app:5432');

-- Create External Access Integration
CREATE OR REPLACE EXTERNAL ACCESS INTEGRATION my_postgres_eai
  ALLOWED_NETWORK_RULES = (my_postgres_network_rule)
  ENABLED = TRUE
  COMMENT = 'EAI for Openflow PostgreSQL CDC';

-- Grant to your runtime role
GRANT USAGE ON INTEGRATION my_postgres_eai TO ROLE SYSADMIN;
```

## Step 4: Configure Snowflake Postgres Ingress Rules (CRITICAL)

**This is the #1 gotcha!** Snowflake Postgres blocks all incoming connections by default. You must allow SPCS to connect:

```sql
USE ROLE ACCOUNTADMIN;

-- Option 1: Open to all (for testing only)
ALTER NETWORK RULE your_postgres_ingress_rule SET VALUE_LIST = ('0.0.0.0/0');

-- Option 2: If you know your SPCS IP range, use that instead
```

**How to find your existing Postgres ingress rule:**
```sql
SHOW NETWORK RULES IN ACCOUNT;
-- Look for rules with MODE = POSTGRES_INGRESS
```

## Step 5: Attach EAI to Openflow Runtime (1 min)

1. Go to **Openflow Control Plane**
2. Find your runtime → click **"..."** menu
3. Select **"External access integrations"**
4. Select your EAI from dropdown
5. Click **Save**
6. **RESTART the runtime** (critical - changes don't apply until restart)

## Step 6: Install PostgreSQL Connector (2 min)

1. Go to **Openflow** → **View more connectors**
2. Find **PostgreSQL** → click **Add to runtime**
3. Select your runtime → click **Add**
4. Authenticate when prompted

## Step 7: Configure Connector Parameters

### PostgreSQL Source Parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| PostgreSQL Connection URL | `jdbc:postgresql://your-host:5432/postgres?ssl=true&sslmode=require` | **SSL is required for Snowflake Postgres!** |
| PostgreSQL JDBC Driver | Upload JAR file | Check "Reference asset" and upload the driver |
| PostgreSQL Username | `snowflake_admin` | Or your user |
| PostgreSQL Password | Your password | |
| Publication Name | `my_publication` | The publication you created in Step 1 |

### PostgreSQL Destination Parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| Destination Database | `MY_CDC_DATABASE` | **UPPERCASE, no quotes** |
| Snowflake Authentication Strategy | `SNOWFLAKE_MANAGED` | Not `SNOWFLAKE_MANAGED_TOKEN` |
| Snowflake Role | `SYSADMIN` | Must have permissions on destination DB |
| Snowflake Warehouse | `YOUR_WAREHOUSE` | |

### PostgreSQL Ingestion Parameters

| Parameter | Value |
|-----------|-------|
| Included Table Names | `public.customers, public.products, public.orders, public.order_items` |

## Step 8: Start the Flow

1. Right-click canvas → **Enable all Controller Services**
2. Right-click PostgreSQL process group → **Start**

## Common Errors & Solutions

### Error: "JDBC driver class 'org.postgresql.Driver' not found"

**Cause:** JDBC driver not uploaded or not linked properly.

**Solution:**
1. Stop the flow
2. Disable PostgreSQL Connection Pool controller service
3. Go to Parameters → PostgreSQL Source Parameters
4. Click on PostgreSQL JDBC Driver
5. Check "Reference asset" → Upload the JAR
6. Ensure the value field shows the uploaded file
7. Apply & Save
8. Re-enable controller service and start flow

### Error: "SocketTimeoutException: Connect timed out"

**Cause:** Network connectivity blocked. Either:
- EAI not attached to runtime
- EAI attached but runtime not restarted
- Snowflake Postgres ingress rules blocking SPCS

**Solution:**
1. Verify EAI is attached in Openflow UI
2. **Restart the runtime** (not just the flow!)
3. Add `0.0.0.0/0` to your Postgres ingress rule (for testing)

### Error: "Cannot perform CREATE SCHEMA. This session does not have a current database"

**Cause:** Destination Database parameter is empty or role lacks permissions.

**Solution:**
1. Verify Destination Database is set to your database name (UPPERCASE)
2. Grant permissions:
```sql
GRANT USAGE ON DATABASE MY_CDC_DATABASE TO ROLE SYSADMIN;
GRANT CREATE SCHEMA ON DATABASE MY_CDC_DATABASE TO ROLE SYSADMIN;
GRANT ALL ON DATABASE MY_CDC_DATABASE TO ROLE SYSADMIN;
```
3. Restart the flow

### Error: "Authentication Strategy 'SNOWFLAKE_MANAGED_TOKEN' is invalid"

**Cause:** Wrong value for authentication strategy.

**Solution:** Use `SNOWFLAKE_MANAGED` (not `SNOWFLAKE_MANAGED_TOKEN`)

### Controller Service stuck in "ENABLING" state

**Solution:**
1. Stop all processors using that service
2. Disable the controller service
3. Wait for DISABLED status
4. Make your parameter changes
5. Re-enable and restart

## Verification

Once running, verify data is flowing:

```sql
-- Check schemas created
SELECT SCHEMA_NAME FROM MY_CDC_DATABASE.INFORMATION_SCHEMA.SCHEMATA;

-- Check tables created
USE DATABASE MY_CDC_DATABASE;
USE SCHEMA "public";
SHOW TABLES;

-- Check row counts
SELECT COUNT(*) FROM MY_CDC_DATABASE."public".customers;
```

You should see:
- Your source tables replicated
- Journal tables (`*_JOURNAL_*`) for CDC tracking

## Quick Reference: Required SQL Commands

```sql
-- All commands in one block for easy copy-paste

USE ROLE ACCOUNTADMIN;

-- 1. Destination database
CREATE DATABASE IF NOT EXISTS MY_CDC_DATABASE;
GRANT ALL ON DATABASE MY_CDC_DATABASE TO ROLE SYSADMIN;

-- 2. Network rule for EAI
CREATE OR REPLACE NETWORK RULE my_postgres_network_rule
  TYPE = HOST_PORT
  MODE = EGRESS
  VALUE_LIST = ('your-postgres-host.snowflake.app:5432');

-- 3. External Access Integration
CREATE OR REPLACE EXTERNAL ACCESS INTEGRATION my_postgres_eai
  ALLOWED_NETWORK_RULES = (my_postgres_network_rule)
  ENABLED = TRUE;

GRANT USAGE ON INTEGRATION my_postgres_eai TO ROLE SYSADMIN;

-- 4. Open Postgres ingress (find your rule name first with SHOW NETWORK RULES)
ALTER NETWORK RULE your_postgres_ingress_rule SET VALUE_LIST = ('0.0.0.0/0');
```

## Checklist

- [ ] PostgreSQL publication created with tables added
- [ ] Destination database created with SYSADMIN permissions
- [ ] Network rule created for Postgres host:port
- [ ] External Access Integration created and granted to SYSADMIN
- [ ] **EAI attached to runtime in Openflow UI**
- [ ] **Runtime restarted after attaching EAI**
- [ ] **Postgres ingress rule allows SPCS connections**
- [ ] JDBC driver uploaded with "Reference asset" checked
- [ ] Connection URL includes `?ssl=true&sslmode=require`
- [ ] Authentication Strategy set to `SNOWFLAKE_MANAGED`
- [ ] Destination Database set (UPPERCASE)
- [ ] Controller services enabled
- [ ] Flow started

## Time Breakdown (Target: 5-10 min)

| Step | Time |
|------|------|
| Create publication | 1 min |
| Create destination DB & grants | 1 min |
| Create EAI & network rules | 2 min |
| Open Postgres ingress | 1 min |
| Attach EAI & restart runtime | 1 min |
| Install connector & configure | 3 min |
| Start flow & verify | 1 min |
| **Total** | **~10 min** |

---

*Document created from lessons learned on 2026-02-28*
