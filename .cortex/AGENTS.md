# Snowflake Postgres CDC Demo - Agent Instructions

This project demonstrates Snowflake Postgres, OpenFlow CDC, SPCS deployment, and Snowflake Intelligence.

## Quick Context

When helping with this project, reference these key learnings:

### Snowflake Postgres Essentials
- Real PostgreSQL (v16-18) managed by Snowflake, not "Postgres-compatible"
- **Network rules are required** - default blocks ALL inbound connections
- IP addresses MUST be in CIDR notation (e.g., `136.55.6.239/32`)
- SSL is required for all connections (`?ssl=true&sslmode=require`)
- Credentials are separate from Snowflake login - save them on instance creation
- Hostname format: `<instance-id>.postgres.snowflake.app`

### OpenFlow CDC Setup (Common Gotchas)
1. **Every source table needs a primary key** for CDC to work
2. **EAI must be attached to runtime AND runtime must be restarted** - changes don't apply until restart
3. **Postgres ingress rules must allow SPCS** - add `0.0.0.0/0` for testing
4. **JDBC driver**: Check "Reference asset" when uploading the JAR
5. **Authentication Strategy**: Use `SNOWFLAKE_MANAGED` (not `SNOWFLAKE_MANAGED_TOKEN`)
6. **Destination Database**: Must be UPPERCASE, no quotes

### Common Errors
| Error | Cause | Fix |
|-------|-------|-----|
| JDBC driver not found | Driver not uploaded properly | Re-upload JAR with "Reference asset" checked |
| SocketTimeoutException | Network blocked | Restart runtime after attaching EAI; open Postgres ingress |
| Cannot CREATE SCHEMA | No current database | Set Destination Database param (UPPERCASE) |
| Controller service stuck ENABLING | Processors still running | Stop all processors, disable service, then re-enable |

## Detailed Documentation

For step-by-step guides, see:
- `setup-skills/openflow-postgres-cdc-setup.md` - Full OpenFlow CDC configuration
- `setup-skills/snowflake-postgres-learnings.md` - Postgres product overview
- `docs/RUNBOOK.md` - Demo presenter guide

## Project Structure

```
app/           - React + Express e-commerce app
setup/         - SQL scripts for Postgres instance & network
semantic_view/ - Cortex Analyst semantic model
docs/          - Runbook and guides
setup-skills/  - Lessons learned (reference docs)
```

## Key SQL Commands

```sql
-- Check Postgres instance status
SHOW POSTGRES INSTANCES;

-- Find network rules
SHOW NETWORK RULES IN ACCOUNT;

-- Verify CDC tables
SELECT * FROM MY_CDC_DATABASE.INFORMATION_SCHEMA.TABLES;
```
