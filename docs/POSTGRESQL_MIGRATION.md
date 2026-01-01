# PostgreSQL Migration Guide

This document describes the migration path from SQLite (development) to PostgreSQL (production) for the NICU Dashboard.

## Overview

The NICU Dashboard uses:
- **SQLite** for local development (fast setup, no external dependencies)
- **PostgreSQL** for production (scalable, ACID-compliant, HIPAA-ready)

## Prerequisites

### Production Database Requirements

- PostgreSQL 14+ (recommended: 15 or 16)
- SSL/TLS enabled connections
- Sufficient storage for vital signs data (plan for ~100MB per patient per month)
- Regular backup schedule configured

### Recommended PostgreSQL Extensions

```sql
-- Enable UUID support (optional, for future use)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_stat_statements for query monitoring
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
```

### For Time-Series Data (Optional but Recommended)

Consider TimescaleDB for better vital signs data performance:

```sql
-- Install TimescaleDB extension (requires TimescaleDB installation)
CREATE EXTENSION IF NOT EXISTS timescaledb;
```

## Step-by-Step Migration

### Step 1: Update Prisma Schema

Modify `prisma/schema.prisma` to use PostgreSQL:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**Important Schema Differences:**

| SQLite | PostgreSQL | Notes |
|--------|------------|-------|
| `autoincrement()` | `autoincrement()` | Works the same |
| `String` (JSON) | `Json` | Consider using native JSON type |
| No array types | Native arrays | Can optimize some queries |

### Step 2: Configure Environment

Update `.env` or `.env.local`:

```bash
# PostgreSQL connection string
DATABASE_URL="postgresql://user:password@hostname:5432/nicu_dashboard?schema=public&sslmode=require"

# Connection pooling settings
DB_POOL_SIZE=10
DB_CONNECT_TIMEOUT=10000
DB_IDLE_TIMEOUT=60000
```

**Connection String Components:**
- `user`: Database username
- `password`: Database password (URL-encoded if contains special chars)
- `hostname`: Database server hostname
- `5432`: Default PostgreSQL port
- `nicu_dashboard`: Database name
- `sslmode=require`: Enforce TLS (required for HIPAA)

### Step 3: Generate Migration

```bash
# Generate Prisma client for PostgreSQL
npx prisma generate

# Create migration from schema
npx prisma migrate dev --name init_postgresql

# For production, use deploy instead
npx prisma migrate deploy
```

### Step 4: Data Migration (If Needed)

For migrating existing SQLite data to PostgreSQL:

```bash
# Export from SQLite
sqlite3 prisma/dev.db .dump > backup.sql

# Import to PostgreSQL (manual cleanup required)
# The SQL syntax differs - use a migration tool or script
```

Recommended approach for production data migration:

1. Use `prisma db pull` to sync schema
2. Export data using Prisma's built-in export or custom scripts
3. Import using Prisma's seed mechanism

### Step 5: Verify Connection

```bash
# Test database connection
npm run db:check

# Or manually verify
npx prisma db pull
```

## Production Configuration

### Connection Pooling

Configure connection pooling in `lib/prisma.js`:

```javascript
const poolConfig = {
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  connectionLimit: parseInt(process.env.DB_POOL_SIZE || '10'),
};
```

### Recommended Pool Sizes

| Deployment Type | Recommended Pool Size |
|-----------------|----------------------|
| Serverless (Vercel, AWS Lambda) | 2-5 |
| Container (ECS, Kubernetes) | 5-15 |
| Traditional Server | 10-25 |

### SSL/TLS Configuration

For cloud PostgreSQL providers:

```bash
# AWS RDS
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require&sslrootcert=/path/to/rds-ca-cert.pem"

# Supabase
DATABASE_URL="postgresql://postgres:password@host:5432/postgres?sslmode=require"

# Neon
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
```

## Cloud Provider-Specific Notes

### AWS RDS

1. Use RDS Proxy for connection pooling in serverless deployments
2. Enable encryption at rest (default in new instances)
3. Enable Performance Insights for monitoring
4. Configure automated backups (minimum 7-day retention for HIPAA)

```bash
# RDS connection with proxy
DATABASE_URL="postgresql://user:pass@rds-proxy-endpoint:5432/nicu_dashboard"
```

### Supabase

1. Connection pooler is built-in (use port 6543 for pooling)
2. Enable RLS (Row Level Security) for additional protection
3. Use connection pooling mode for serverless

```bash
# Supabase with pooler
DATABASE_URL="postgresql://postgres:password@host:6543/postgres?pgbouncer=true"
```

### Neon

1. Serverless with autoscaling built-in
2. Uses connection pooling by default
3. Supports branching for dev/staging environments

### Azure Database for PostgreSQL

1. Use Flexible Server for production
2. Configure geo-redundant backups
3. Use Private Link for VNet integration

## HIPAA Compliance Checklist

- [ ] TLS encryption for all connections (`sslmode=require`)
- [ ] Encryption at rest enabled
- [ ] Access logging enabled (PostgreSQL `log_connections`, `log_disconnections`)
- [ ] Query logging for audit (be careful with PHI in logs)
- [ ] Network isolation (VPC/VNet with private subnets)
- [ ] Automated backups with point-in-time recovery
- [ ] Access control (least privilege database users)
- [ ] Regular security patches and updates

## Performance Optimization

### Indexes for Common Queries

The schema already includes indexes for common queries. For PostgreSQL, consider adding:

```sql
-- Partial index for active alarms (very common query)
CREATE INDEX CONCURRENTLY idx_alarms_active
ON alarms (patient_id, triggered_at)
WHERE status = 'active';

-- Covering index for vitals dashboard
CREATE INDEX CONCURRENTLY idx_vitals_dashboard
ON vitals (patient_id, recorded_at DESC)
INCLUDE (heart_rate, spo2, resp_rate, temperature);
```

### Query Monitoring

Enable slow query logging:

```sql
-- In postgresql.conf or via parameter groups
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries > 1 second
SELECT pg_reload_conf();
```

### Vacuum and Maintenance

```sql
-- Analyze tables after migration
ANALYZE;

-- Check for bloated tables
SELECT relname, n_live_tup, n_dead_tup, last_vacuum, last_autovacuum
FROM pg_stat_user_tables;
```

## Rollback Plan

If issues occur during migration:

1. **Keep SQLite backup**: Don't delete the `prisma/dev.db` file
2. **Revert schema**: Change `provider` back to `sqlite` in schema.prisma
3. **Regenerate client**: Run `npx prisma generate`
4. **Restore env**: Update `DATABASE_URL` to SQLite path

## Health Monitoring

The `/api/health` endpoint includes database health checks:

```json
{
  "status": "healthy",
  "database": {
    "status": "connected",
    "responseTime": "12ms",
    "poolSize": 10,
    "activeConnections": 3
  }
}
```

Monitor these metrics in production:
- Connection pool utilization
- Query latency (p50, p95, p99)
- Active connections
- Slow query count

## Support

For production migration assistance:
1. Review cloud provider documentation
2. Test migration in staging environment first
3. Schedule migration during low-traffic window
4. Have rollback plan ready
