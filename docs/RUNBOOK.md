# Snowflake Postgres Demo — Presenter Runbook

**Duration**: 15-30 minutes  
**Audience**: Customers with Postgres experience, unaware of Snowflake Postgres

---

## Pre-Demo Checklist

- [ ] Snowflake Postgres instance is ACTIVE
- [ ] Network policy includes your demo IP
- [ ] DBeaver connected and tested
- [ ] React app environment configured (`.env` file)
- [ ] Both terminals ready (server + frontend)
- [ ] Browser open to Snowsight

---

## Demo Script

### Opening (1 min)

> "Today I'm going to show you Snowflake Postgres — a fully managed PostgreSQL service running inside Snowflake. If you're already using Postgres, you can lift-and-shift your apps with zero code changes. Let me show you how easy it is."

---

### Part 1: Create Postgres Instance in Snowsight (2 min)

**Navigate**: Snowsight → Data → Postgres

**Talk Track**:
> "Creating a Postgres instance is just a few clicks. I'll select my compute size, storage, and network policy."

**Show**:
1. Click **+ Create**
2. Walk through the options:
   - Instance name: `ECOMMERCE_DEMO`
   - Compute: `STANDARD_M`
   - Storage: `10 GB`
   - Postgres version: `17`
   - Network policy: Select your pre-created policy
3. Click **Create**

> "Notice I get connection credentials immediately — hostname, username, and password. The instance spins up in about 2 minutes."

**If instance already exists**: Show `DESCRIBE POSTGRES SERVICE ECOMMERCE_DEMO;`

---

### Part 2: Network Policy (2 min)

**Navigate**: Show the network rule in Snowsight or run SQL

**Talk Track**:
> "Snowflake Postgres is secure by default — no inbound connections allowed until you explicitly allow them. Here's my network policy with my IP address in CIDR notation."

**Show**:
```sql
SHOW NETWORK RULES IN SCHEMA POSTGRES_DEMO_DB.NETWORK;
```

> "This is the same security model you know from Snowflake — network policies, role-based access, all managed in one place."

---

### Part 3: Connect with DBeaver (2 min)

**Talk Track**:
> "Now let's connect using DBeaver — a standard Postgres client. No special drivers, no Snowflake-specific configuration."

**Show**:
1. Open DBeaver
2. Show connection properties:
   - Host: `xxx.postgres.snowflake.app`
   - Port: `5432`
   - User: `app_user`
3. Test connection ✓
4. Browse tables: `customers`, `products`, `orders`

> "It's real Postgres. Your existing tools, ORMs, and applications just work."

---

### Part 4: Schema & Seed Data (2 min)

**Talk Track**:
> "I've set up a simple e-commerce schema — customers, products, orders, order items. Standard relational model."

**Show in DBeaver**:
```sql
SELECT * FROM products;
SELECT * FROM customers;
SELECT COUNT(*) FROM orders;
```

> "This is the same schema you'd use in any Postgres app. Nothing Snowflake-specific."

---

### Part 5: React Application (5-10 min)

**Start the app** (if not already running):
```bash
# Terminal 1
npm run server

# Terminal 2  
npm run dev
```

**Navigate**: Browser to `http://localhost:5173`

**Talk Track**:
> "Here's a React e-commerce app connected to our Snowflake Postgres instance. Standard Node.js backend using the `pg` driver."

#### Dashboard Tab
> "We can see our real-time stats — customers, products, orders, total revenue."

#### Traffic Simulator
**Click**: 50 Operations

> "Let's simulate some load. This is creating customers and updating inventory concurrently."

**Point out**: Operation log shows real-time database activity

> "Snowflake Postgres includes connection pooling via PgBouncer built-in — handles these concurrent operations efficiently."

#### Customers Tab
**Click**: + Add Customer

> "Creating a new customer. This is a simple INSERT — nothing special."

**Show**: New row appears immediately

**Click**: Delete on a customer

> "And delete works as expected."

#### Products Tab
**Click**: + Add Product

> "Adding products with auto-generated SKUs and random pricing."

#### Orders Tab
**Click**: + Create Order

> "This is a transaction — it inserts the order, creates line items, and decrements inventory atomically. If anything fails, it rolls back."

**Change status** on an order: pending → shipped → completed

> "Status updates, inventory management — all standard Postgres operations."

---

### Part 6: Show in DBeaver (1 min)

**Switch to DBeaver**

```sql
SELECT * FROM customers ORDER BY id DESC LIMIT 5;
SELECT * FROM orders ORDER BY id DESC LIMIT 5;
```

> "Everything we did in the app is here in the database. You can query it, report on it, or — because it's in Snowflake — eventually connect it to your analytics pipeline."

---

### Closing (1 min)

**Key Points**:

1. **Zero migration effort** — Your Postgres apps work unchanged
2. **Enterprise managed** — Backups, patching, scaling handled by Snowflake
3. **Unified security** — Network policies, same governance as your data warehouse
4. **One bill, one platform** — Postgres alongside your analytics data

> "Questions?"

---

## Troubleshooting During Demo

| Issue | Quick Fix |
|-------|-----------|
| Connection timeout | Verify IP in network policy, check instance is ACTIVE |
| Auth failed | Use `snowflake_admin` to reset password |
| App won't start | Check `.env` file has correct credentials |
| Slow response | Normal for first connection (cold start) |

---

## Backup Demo Flow

If live demo fails, show:

1. **Screenshots** of Snowsight Postgres creation
2. **SQL scripts** explaining what each does
3. **Code walkthrough** of the React app and API

---

## Q&A Prep

**Q: How is this different from RDS/Cloud SQL?**
> "It's Postgres managed alongside your Snowflake data. One platform, one security model, one bill. No separate cloud service to manage."

**Q: Can I migrate my existing Postgres?**
> "Yes — standard pg_dump/pg_restore works. It's real Postgres."

**Q: What about extensions?**
> "Common extensions like pg_vector and PostGIS are supported."

**Q: Pricing?**
> "Pay for compute family size and storage. Check docs for current rates."

**Q: HA/DR?**
> "High availability option available. Point-in-time recovery included."
