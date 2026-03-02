# GitHub Actions Secrets Setup

To use the CI/CD workflow, configure these secrets in your GitHub repository:

**Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `SNOWFLAKE_ACCOUNT` | Account identifier | `sfsenorthamerica-myaccount` |
| `SNOWFLAKE_USER` | Service account username | `DEPLOY_USER` |
| `SNOWFLAKE_PASSWORD` | Service account password | (your password) |
| `SNOWFLAKE_REGISTRY` | Image registry URL | `sfsenorthamerica-myaccount.registry.snowflakecomputing.com/jack/demo/images` |
| `PG_HOST` | Postgres hostname | `abc123.postgres.snowflake.app` |

## Recommended: Create a Service Account

For CI/CD, create a dedicated user with minimal permissions:

```sql
USE ROLE SECURITYADMIN;
CREATE USER DEPLOY_USER
    PASSWORD = '<secure-password>'
    DEFAULT_ROLE = SYSADMIN
    MUST_CHANGE_PASSWORD = FALSE;

GRANT ROLE SYSADMIN TO USER DEPLOY_USER;

USE ROLE SYSADMIN;
GRANT USAGE ON DATABASE JACK TO ROLE SYSADMIN;
GRANT USAGE ON SCHEMA JACK.DEMO TO ROLE SYSADMIN;
GRANT READ ON IMAGE REPOSITORY JACK.DEMO.IMAGES TO ROLE SYSADMIN;
GRANT WRITE ON IMAGE REPOSITORY JACK.DEMO.IMAGES TO ROLE SYSADMIN;
```

## Workflow Triggers

The workflow runs automatically when:
- Code is pushed to `main` branch
- Changes are made to `app/**` files

You can also trigger manually via **Actions → Build and Deploy to SPCS → Run workflow**
