# Snowflake Postgres Demo: E-commerce CRUD Application

Build a full-stack e-commerce application powered by **Snowflake Postgres** — PostgreSQL running as a fully managed service inside Snowflake.

![Demo Screenshot](docs/screenshot.png)

## What You'll Learn

- Create a Snowflake Postgres instance from Snowsight
- Configure network policies for external access
- Connect using standard Postgres tools (DBeaver, psql)
- Build a React application that performs CRUD operations
- Simulate high-concurrency workloads

## Prerequisites

- Snowflake account (Standard edition or higher)
- ACCOUNTADMIN or SYSADMIN role access
- Node.js 18+ installed locally
- A Postgres client (DBeaver, pgAdmin, or psql)

## Demo Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Local Machine                       │
│  ┌──────────────┐       ┌──────────────────────────────┐    │
│  │  React App   │──────▶│  Express API Server          │    │
│  │  (Vite)      │       │  (localhost:3001)            │    │
│  │  :5173       │       └──────────────┬───────────────┘    │
│  └──────────────┘                      │                    │
└────────────────────────────────────────┼────────────────────┘
                                         │ pg driver (SSL)
                                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Snowflake Platform                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Snowflake Postgres Instance              │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  ecommerce database                            │  │   │
│  │  │  ├── customers                                 │  │   │
│  │  │  ├── products                                  │  │   │
│  │  │  ├── orders                                    │  │   │
│  │  │  └── order_items                               │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Step 1: Set Up Snowflake Postgres (5 min)

1. **Create Network Policy** — Run `setup/01_network_policy.sql` in Snowsight
   - Update the IP addresses with your home/office IP
   - Use CIDR notation (e.g., `136.55.6.239/32` for a single IP)

2. **Create Postgres Instance** — Run `setup/02_create_postgres_instance.sql`
   - **Save the credentials** from the output (hostname, passwords)
   - Wait 2-5 minutes for the instance to become ACTIVE

3. **Create Schema & Seed Data** — Connect to your Postgres instance and run `setup/03_postgres_schema.sql`

### Step 2: Connect DBeaver (2 min)

1. Create a new PostgreSQL connection:
   - **Host**: `<your-instance-id>.postgres.snowflake.app`
   - **Port**: `5432`
   - **Database**: `ecommerce`
   - **User**: `app_user`
   - **Password**: From Step 1
   - **SSL**: Required (Driver properties → `ssl` = `true`)

2. Test the connection and verify tables exist

### Step 3: Run the React App (3 min)

```bash
cd app

# Copy and configure environment
cp .env.example .env
# Edit .env with your Postgres connection details

# Install dependencies
npm install

# Start the API server (in one terminal)
npm run server

# Start the React dev server (in another terminal)
npm run dev
```

Open http://localhost:5173 in your browser.

## Demo Walkthrough

### Dashboard
- View real-time stats (customers, products, orders, revenue)
- Use the **Traffic Simulator** to generate concurrent database operations
- Watch the **Operation Log** for real-time activity

### Customers Tab
- Create new customers with auto-generated data
- Delete customers
- See immediate reflection in stats

### Products Tab
- Add products with random pricing and inventory
- Manage inventory levels
- Delete products

### Orders Tab
- Create orders (randomly assigns customer and product)
- Update order status (pending → shipped → completed)
- Watch inventory decrement on order creation

## Project Structure

```
snowflake-postgres-demo/
├── setup/
│   ├── 01_network_policy.sql      # Network rules for Postgres access
│   ├── 02_create_postgres_instance.sql  # Instance creation
│   └── 03_postgres_schema.sql     # Tables and seed data
├── app/
│   ├── server/
│   │   └── index.js               # Express API server
│   ├── src/
│   │   ├── App.tsx                # React application
│   │   └── App.css                # Styles
│   ├── .env.example               # Environment template
│   └── package.json
├── docs/
│   └── RUNBOOK.md                 # Presenter guide
└── README.md
```

## Key Talking Points

### Why Snowflake Postgres?

1. **Unified Platform** — Manage Postgres alongside your data warehouse, no separate infrastructure
2. **Zero Migration** — Standard Postgres protocol, works with existing tools and ORMs
3. **Enterprise Security** — Inherits Snowflake's security model, network policies, encryption
4. **Managed Service** — No patching, backups handled automatically, scales on demand

### What This Demo Shows

- **Postgres Compatibility**: Standard `pg` driver connects without modification
- **CRUD Operations**: Full create, read, update, delete functionality
- **Transactions**: Order creation uses transactions with rollback on failure
- **Concurrency**: Traffic simulator demonstrates handling multiple simultaneous operations
- **Real-time Updates**: UI reflects database changes immediately

## Troubleshooting

### Connection Timeout
- Verify your IP is in the network policy (CIDR notation: `x.x.x.x/32`)
- Check that the Postgres instance is ACTIVE: `SHOW POSTGRES SERVICES;`

### Authentication Failed
- Regenerate credentials if needed
- Ensure you're using the correct user (`app_user` for the app, `snowflake_admin` for setup)

### SSL Errors
- Ensure `ssl: { rejectUnauthorized: false }` in the connection config
- DBeaver: Set `ssl=true` in driver properties

## Resources

- [Snowflake Postgres Documentation](https://docs.snowflake.com/en/user-guide/snowflake-postgres/about)
- [Snowflake Postgres Networking](https://docs.snowflake.com/en/user-guide/snowflake-postgres/postgres-network)
- [Node.js pg Driver](https://node-postgres.com/)

## License

MIT
