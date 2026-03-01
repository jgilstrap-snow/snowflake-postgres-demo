# Snowflake Postgres CDC Demo

A full-stack e-commerce application demonstrating **Snowflake Postgres**, **OpenFlow CDC replication**, **SPCS deployment**, and **Snowflake Intelligence** with semantic views.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React App     │────▶│   Postgres DB   │────▶│   OpenFlow CDC  │
│   (SPCS)        │     │   (Snowflake)   │     │   Replication   │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Snowflake     │◀────│  Unified View   │◀────│  CDC Tables     │
│   Intelligence  │     │  (Analytics)    │     │  (ECOMMERCE_CDC)│
│   Agent         │     └─────────────────┘     └─────────────────┘
└─────────────────┘              │
         │                       ▼
         │              ┌─────────────────┐
         └─────────────▶│  Semantic View  │
                        │  (Cortex)       │
                        └─────────────────┘
```

---

## What's Included

### 1. Postgres Database Setup
- **Snowflake-managed Postgres instance** with SSL connectivity
- Database schema with 4 tables:
  - `customers` (id, email, first_name, last_name, created_at, updated_at)
  - `products` (id, sku, name, description, price, inventory_count)
  - `orders` (id, customer_id, status, total_amount, created_at, updated_at)
  - `order_items` (id, order_id, product_id, quantity, unit_price)

### 2. OpenFlow CDC Replication
- **Change Data Capture** from Postgres to Snowflake using OpenFlow (NiFi-based)
- Continuous replication of all 4 tables to `ECOMMERCE_CDC` database
- CDC metadata columns (`_OPENFLOW_*`) for tracking changes
- Captures INSERTs, UPDATEs, and DELETEs in real-time

### 3. React E-Commerce App
- **React + TypeScript + Vite** frontend featuring:
  - Dashboard with KPI tiles (Customers, Products, Orders, Revenue)
  - **Live Traffic Simulator** with Light (2 ops/sec), Heavy (15 ops/sec), and Ramp Up (2→50 ops/sec) modes
  - Real-time latency chart using **Recharts** (color-coded: INSERT=green, SELECT=blue, UPDATE=yellow)
  - Recent operations list with success/failure indicators
  - CRUD interfaces for Customers, Products, and Orders
  - Database health **Monitor** tab showing connection pool, cache hit ratio, transaction stats
- **Express.js backend** with:
  - RESTful API endpoints for all CRUD operations
  - `/api/simulate/burst` endpoint for traffic generation
  - `/api/monitor` endpoint for Postgres health metrics
  - Realistic data generation with VIP customer bias and product category weighting

### 4. SPCS Deployment
- **Multi-stage Dockerfile** for optimized container builds
- Deployed to **Snowpark Container Services** (SPCS)
- Network rules and external access integration for Postgres egress
- Snowflake **secrets** for secure credential management
- Public HTTPS endpoint via Snowflake ingress

### 5. Unified View in Snowflake
- Analytics-ready view joining CDC-replicated tables
- Combines orders, customers, order_items, and products
- Powers dashboards and reporting on replicated data

### 6. Semantic View for Cortex Analyst
- YAML-based semantic model defining:
  - **Dimensions**: order_id, customer_name, customer_email, product_name, order_status
  - **Measures**: total_amount, quantity, unit_price, revenue aggregations
  - **Time dimensions**: order_date with date hierarchy
- Enables natural language queries via Cortex Analyst

### 7. Snowflake Intelligence Agent
- Cortex Agent configured with the semantic view
- Natural language query capabilities for:
  - "What were total sales last week?"
  - "Who are the top 5 customers by revenue?"
  - "Show me orders by status"

---

## Lessons Learned (Cortex Code Users)

This repo includes lessons learned from building this demo. If you're using **Cortex Code**, the `.cortex/AGENTS.md` file is automatically loaded into context with key gotchas and tips.

Detailed guides are in `setup-skills/`:
- `openflow-postgres-cdc-setup.md` - Step-by-step CDC configuration with troubleshooting
- `snowflake-postgres-learnings.md` - Snowflake Postgres product overview

---

## Quick Start

### Prerequisites
- Snowflake account with SYSADMIN access
- Node.js 18+
- Docker (for SPCS deployment)

### Local Development

```bash
cd app

# Configure environment
cp .env.example .env
# Edit .env with your Postgres credentials:
# PG_HOST=<your-postgres-host>.postgres.snowflake.app
# PG_PORT=5432
# PG_DATABASE=postgres
# PG_USER=<username>
# PG_PASSWORD=<password>

# Install dependencies
npm install

# Start API server (terminal 1)
npm run server

# Start React dev server (terminal 2)
npm run dev
```

Open http://localhost:5173

### SPCS Deployment

```bash
cd app

# Build Docker image
docker build --platform linux/amd64 -t ecommerce-demo .

# Tag for Snowflake registry
docker tag ecommerce-demo <registry>/images/ecommerce-demo:latest

# Push to registry
docker push <registry>/images/ecommerce-demo:latest

# Deploy service (see setup/ for SQL scripts)
```

---

## Project Structure

```
snowflake-postgres-demo/
├── app/
│   ├── server/
│   │   ├── index.cjs            # Express API server
│   │   └── dataGenerator.cjs    # Realistic data generation
│   ├── src/
│   │   ├── App.tsx              # React application
│   │   └── App.css              # Styles
│   ├── Dockerfile               # SPCS container build
│   ├── .env.example             # Environment template
│   └── package.json
├── setup/
│   ├── 01_network_policy.sql    # Network rules for Postgres access
│   ├── 02_create_postgres_instance.sql
│   └── 03_postgres_schema.sql   # Tables and seed data
├── semantic_view/
│   └── ecommerce_orders_semantic.yaml  # Cortex Analyst semantic model
├── docs/
│   ├── RUNBOOK.md               # Presenter guide
│   └── openflow-postgres-cdc-setup.md  # CDC configuration guide
└── README.md
```

---

## Demo Features

### Traffic Simulator
- **Light**: 2 operations/second - gentle steady load
- **Heavy**: 15 operations/second - stress testing
- **Ramp Up**: 2→50 operations/second - gradual increase over time

### Operation Types
- `INSERT_CUSTOMER` - Create new customers with realistic names/emails
- `INSERT_ORDER` - Create orders with VIP customer bias
- `SELECT` - Read queries (counts, aggregations)
- `UPDATE_INVENTORY` - Adjust product stock levels
- `UPDATE_ORDER_STATUS` - Progress orders through fulfillment

### Monitor Dashboard
- Connection pool stats (total, idle, waiting)
- Database connections (active, idle)
- Cache hit ratio
- Transaction stats (commits, rollbacks, inserts, updates, deletes)
- Per-table statistics (row counts, scans)

---

## Key Concepts Demonstrated

| Concept | Technology | Purpose |
|---------|------------|---------|
| Transactional DB | Snowflake Postgres | OLTP workloads, CRUD operations |
| Change Data Capture | OpenFlow | Real-time replication to Snowflake |
| Container Hosting | SPCS | Run web apps in Snowflake |
| Unified Analytics | Snowflake Views | Join replicated data for reporting |
| Natural Language | Semantic Views | Enable Cortex Analyst queries |
| AI Assistant | Cortex Agent | Conversational data access |

---

## Troubleshooting

### Connection Timeout
- Verify IP allowlist in network policy (CIDR: `x.x.x.x/32`)
- Check Postgres instance status is ACTIVE

### Authentication Failed
- Confirm username/password are correct
- Check if connecting from allowed IP range

### SPCS Service Pending
- Check logs: `SELECT SYSTEM$GET_SERVICE_LOGS('service_name', 0, 'app', 100)`
- Verify external access integration is attached
- Ensure secrets are properly configured

### CDC Not Replicating
- Check OpenFlow connector status in Snowsight
- Verify source tables have primary keys
- Check for replication lag in connector metrics

---

## Resources

- [Snowflake Postgres Documentation](https://docs.snowflake.com/en/user-guide/snowflake-postgres/about)
- [OpenFlow Documentation](https://docs.snowflake.com/en/user-guide/data-load/openflow)
- [Snowpark Container Services](https://docs.snowflake.com/en/developer-guide/snowpark-container-services/overview)
- [Cortex Analyst Semantic Views](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst)

---

## License

MIT
