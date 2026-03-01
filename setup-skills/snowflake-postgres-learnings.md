# Snowflake Postgres Learnings

## Product Overview
- Snowflake Postgres is a fully managed PostgreSQL service running inside Snowflake (GA Feb 24, 2026)
- Real Postgres (versions 16-18), not "Postgres-compatible" — standard pg drivers/tools work unchanged
- Available on AWS and Azure regions

## Network Configuration
- By default, NO inbound connections allowed
- Must create network rules with `MODE = POSTGRES_INGRESS` and `MODE = POSTGRES_EGRESS`
- **CRITICAL**: IP addresses must be in CIDR notation (e.g., `136.55.6.239/32` for single IP)
- Network rules go in a NETWORK POLICY, which is attached to the Postgres instance at creation

## Instance Creation
```sql
CREATE POSTGRES INSTANCE my_instance
    COMPUTE_FAMILY = STANDARD_M
    STORAGE_SIZE_GB = 10
    POSTGRES_VERSION = 17
    HIGH_AVAILABILITY = FALSE
    NETWORK_POLICY = my_policy;
```
- Output includes `snowflake_admin` and `application` passwords — save immediately
- Hostname format: `<instance-id>.postgres.snowflake.app`
- Takes 2-5 minutes to become ACTIVE

## Authentication
- Separate credentials from main Snowflake login
- If auth fails, may need to regenerate username/credentials
- SSL required for connections

## Connection String Pattern
```
postgresql://user:password@<instance-id>.postgres.snowflake.app:5432/database?sslmode=require
```

## Key Value Props
1. Unified platform — manage Postgres alongside Snowflake data
2. Zero migration — standard Postgres protocol
3. Enterprise security — inherits Snowflake network policies, encryption
4. Managed service — automated backups, patching, PITR included
5. Connection pooling via PgBouncer built-in

## Extensions Supported
- pg_vector (for embeddings/RAG)
- PostGIS (geospatial)
- Standard ecosystem extensions
