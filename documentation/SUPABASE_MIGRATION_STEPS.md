# PesaChama Supabase Migration: Step-by-Step Implementation

## Table of Contents

1. [Pre-Migration Checklist](#pre-migration-checklist)
2. [Week 1: Preparation & Setup](#week-1-preparation--setup)
3. [Week 2: Data Migration](#week-2-data-migration)
4. [Week 3: Application Integration](#week-3-application-integration)
5. [Week 4: Testing & Rollout](#week-4-testing--rollout)
6. [Rollback Procedures](#rollback-procedures)

---

## Pre-Migration Checklist

Before starting the migration, ensure:

```markdown
### Infrastructure

- [ ] Supabase Pro/Enterprise account created
- [ ] Project region selected (closest to users)
- [ ] Database password set to 32+ characters
- [ ] Daily backups enabled
- [ ] Network security configured

### Team

- [ ] Database administrator assigned
- [ ] 4-6 developers allocated
- [ ] DevOps engineer ready
- [ ] Testing coordinator assigned
- [ ] Communication plan established

### Verification

- [ ] All existing services documented
- [ ] Data backup taken (current system)
- [ ] Test environment available
- [ ] Rollback plan documented
- [ ] Stakeholders notified

### Documentation

- [ ] Current database schema documented
- [ ] API endpoints listed
- [ ] Dependencies mapped
- [ ] Integration points identified
- [ ] Risk assessment completed
```

---

## Week 1: Preparation & Setup

### Day 1: Supabase Project Creation

```bash
# 1. Create Supabase project
# Visit: https://supabase.com/dashboard
# Select: New Project > PesaChama > Create database

# 2. Get credentials
export SUPABASE_URL="https://xxxx.supabase.co"
export SUPABASE_SERVICE_KEY="eyJhbGc..."
export SUPABASE_ANON_KEY="eyJhbGc..."
export DATABASE_URL="postgresql://postgres:password@xxxx.db.supabase.co:5432/postgres"

# 3. Install Supabase CLI
npm install -g supabase
supabase login

# 4. Link local project
supabase link --project-ref xxxx

# 5. Enable extensions
supabase db enable-extension uuid-ossp
supabase db enable-extension pgcrypto
supabase db enable-extension jwt
supabase db enable-extension http
supabase db enable-extension pg_trgm
supabase db enable-extension vector
```

### Day 2: Schema Deployment

```bash
# 1. Create migration file
supabase migration new create_pesachama_schema

# 2. Add schema SQL (see SUPABASE_INTEGRATION_GUIDE.md section 2.2)

# 3. Deploy to local
supabase migration up

# 4. Deploy to staging
supabase db push --linked

# 5. Verify in Supabase Dashboard
# Go to: SQL Editor > Confirm all tables exist
```

**Schema Verification Script:**

```sql
-- Run in Supabase SQL Editor
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Should return:
-- users
-- chamas
-- chama_members
-- transactions
-- disbursement_requests
-- meetings
-- ussd_sessions
-- notifications
-- audit_logs
```

### Day 3-4: Authentication Setup

```bash
# 1. Configure email templates
# Go to: Authentication > Email Templates
# Update sender name, templates, links

# 2. Enable authentication methods
# Go to: Authentication > Providers
# Enable: Email/Password, Google OAuth

# 3. Create test users
supabase db query
INSERT INTO auth.users (email, password, email_confirmed_at, created_at)
VALUES 
  ('admin@pesachama.local', crypt('password123', gen_salt('bf')), now(), now()),
  ('user@pesachama.local', crypt('password123', gen_salt('bf')), now(), now());

# 4. Create test profiles
INSERT INTO public.users (id, email, phone, first_name, last_name)
SELECT id, email, '+254712345678', 'Test', 'User'
FROM auth.users
WHERE email LIKE '%@pesachama.local%';
```

### Day 5: Storage & RLS Configuration

```bash
# 1. Create storage buckets
supabase storage buckets create avatars --public
supabase storage buckets create documents --private
supabase storage buckets create recordings --private

# 2. Enable Row-Level Security (RLS)
psql $DATABASE_URL << 'EOF'
-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chamas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chama_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create policies (see SUPABASE_INTEGRATION_GUIDE.md section 8.1)
EOF

# 3. Configure storage policies
# Go to: Storage > Policies > Add RLS Policy
# Bucket: avatars - Public read, authenticated write
# Bucket: documents - Authenticated only
# Bucket: recordings - Authenticated only
```

---

## Week 2: Data Migration

### Day 1: Backup & Preparation

```bash
# 1. Backup current PostgreSQL database
pg_dump -U postgres -h localhost pesachama_prod > backup_$(date +%Y%m%d).sql

# 2. Verify backup
psql -U postgres < backup_$(date +%Y%m%d).sql

# 3. Create temporary migration user in old database
psql -U postgres -h localhost pesachama_prod << 'EOF'
CREATE USER migration_user WITH PASSWORD 'MigrationPassword123!';
GRANT CONNECT ON DATABASE pesachama_prod TO migration_user;
GRANT USAGE ON SCHEMA public TO migration_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO migration_user;
EOF

# 4. Set up replication
# In old database:
ALTER SYSTEM SET wal_level = logical;
SELECT pg_reload_conf();
```

### Day 2: Initial Data Load

```bash
# 1. Export data from old database
pg_dump -U migration_user -h old.database.local \
  --data-only \
  --no-privileges \
  --disable-triggers \
  pesachama_prod > data_export.sql

# 2. Clean credentials/sensitive data
# Remove password_hash, auth tokens, etc. from dump
sed -i 's/password_hash.*/password_hash = NULL,/g' data_export.sql

# 3. Load into Supabase
psql $DATABASE_URL < data_export.sql

# 4. Verify row counts
psql $DATABASE_URL << 'EOF'
SELECT 
  tablename,
  count(*) as rows
FROM (
  SELECT tablename FROM pg_tables WHERE schemaname = 'public'
) t
JOIN pg_catalog.pg_class c ON c.relname = tablename
ORDER BY rows DESC;
EOF
```

### Day 3: Data Validation

```bash
# 1. Compare row counts
# Old DB
psql -U postgres -h old.database.local pesachama_prod << 'EOF'
SELECT 'users' as table_name, count(*) as count FROM users
UNION ALL
SELECT 'chamas', count(*) FROM chamas
UNION ALL
SELECT 'transactions', count(*) FROM transactions;
EOF

# Supabase
psql $DATABASE_URL << 'EOF'
SELECT 'users' as table_name, count(*) as count FROM users
UNION ALL
SELECT 'chamas', count(*) FROM chamas
UNION ALL
SELECT 'transactions', count(*) FROM transactions;
EOF

# 2. Verify referential integrity
psql $DATABASE_URL << 'EOF'
-- Check for orphaned records
SELECT 'Orphaned chama_members' as issue, count(*)
FROM chama_members cm
WHERE NOT EXISTS (SELECT 1 FROM chamas c WHERE c.id = cm.chama_id);

SELECT 'Orphaned transactions' as issue, count(*)
FROM transactions t
WHERE NOT EXISTS (SELECT 1 FROM chamas c WHERE c.id = t.chama_id);
EOF

# 3. Validate data integrity
bash test_data_integrity.sh  # See below
```

**Data Integrity Test Script:**

```bash
#!/bin/bash
# test_data_integrity.sh

psql $DATABASE_URL << 'EOF'
-- Test 1: Users have valid emails
SELECT COUNT(*) as invalid_emails
FROM users
WHERE email NOT ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$';

-- Test 2: All transactions have valid amounts
SELECT COUNT(*) as invalid_amounts
FROM transactions
WHERE amount <= 0;

-- Test 3: No duplicate unique constraints violated
SELECT 'users_email', COUNT(*)
FROM (SELECT email FROM users WHERE deleted_at IS NULL GROUP BY email HAVING COUNT(*) > 1) t
UNION ALL
SELECT 'users_phone', COUNT(*)
FROM (SELECT phone FROM users WHERE deleted_at IS NULL GROUP BY phone HAVING COUNT(*) > 1) t;

-- Test 4: Dates are chronological
SELECT COUNT(*) as chrono_errors
FROM transactions
WHERE updated_at < created_at;

-- Test 5: Foreign keys are valid
SELECT COUNT(*) as orphaned_members
FROM chama_members
WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = user_id)
   OR NOT EXISTS (SELECT 1 FROM chamas WHERE id = chama_id);

EOF
```

### Day 4-5: Test Environment Validation

```bash
# 1. Spin up test environment
docker-compose -f docker-compose.test.yml up -d

# 2. Update environment variables
cp .env.example .env.test
cat >> .env.test << 'EOF'
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...
DATABASE_URL=postgresql://postgres:password@xxxx.db.supabase.co:5432/postgres
EOF

# 3. Run full test suite
npm run test:integration
npm run test:api
npm run test:e2e

# 4. Run load test
npm run test:load -- --users=100 --duration=10m

# 5. Security scan
npm run test:security
```

---

## Week 3: Application Integration

### Day 1: Backend API Update

```typescript
// backend/src/index.ts
import { createClient } from "@supabase/supabase-js";

// Remove old PostgreSQL connection
// Remove: import { Pool } from 'pg';
// Remove: const pool = new Pool({ connectionString });

// Add Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Update all database queries to use Supabase
// Example: Old vs New

// OLD:
// const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
// const user = result.rows[0];

// NEW:
const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();
```

**Migration Checklist:**

```typescript
// 1. Replace all queries with Supabase calls
- [ ] Auth routes
- [ ] User routes
- [ ] Chama routes
- [ ] Transaction routes
- [ ] Meeting routes
- [ ] Admin routes

// 2. Update error handling
- [ ] Add error.code checks
- [ ] Log all errors properly
- [ ] Return proper HTTP status codes

// 3. Update middleware
- [ ] Auth middleware (see SUPABASE_INTEGRATION_GUIDE.md)
- [ ] Error handler
- [ ] Logging

// 4. Test all endpoints
- [ ] POST /auth/register
- [ ] POST /auth/login
- [ ] GET /users/:id
- [ ] POST /chamas
- [ ] POST /transactions
```

### Day 2: Flutter App Integration

```dart
// flutter_app/lib/main.dart
import 'package:supabase_flutter/supabase_flutter.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  await Supabase.initialize(
    url: 'https://xxxx.supabase.co',
    anonKey: 'eyJhbGc...',
  );
  
  runApp(const MyApp());
}

// Update all database calls
// OLD:
// final response = await _httpClient.get('/api/users/$userId');
// final user = User.fromJson(response);

// NEW:
final { data: user, error } = await Supabase.instance.client
  .from('users')
  .select()
  .eq('id', userId)
  .single();
```

**App Migration Checklist:**

```dart
// 1. Update dependencies
- [ ] Add supabase_flutter package
- [ ] Remove old HTTP client
- [ ] Update version numbers

// 2. Update auth flow
- [ ] Login screen
- [ ] Registration screen
- [ ] Password reset
- [ ] Token refresh logic

// 3. Update data fetching
- [ ] Dashboard screens
- [ ] List screens
- [ ] Detail screens
- [ ] Form submissions

// 4. Add real-time subscriptions
- [ ] Transaction updates
- [ ] Member updates
- [ ] Meeting updates
```

### Day 3: USSD System Integration

```typescript
// backend/src/services/ussd-service-supabase.ts
import { supabase } from "../config/supabase";

class USSDService {
    async handleUSSDRequest(
        phoneNumber: string,
        input: string,
    ): Promise<string> {
        // Get or create USSD session
        const { data: session } = await supabase
            .from("ussd_sessions")
            .select("*")
            .eq("phone_number", phoneNumber)
            .eq("status", "active")
            .single();

        if (!session) {
            // Create new session
            const { data: newSession } = await supabase
                .from("ussd_sessions")
                .insert({
                    phone_number: phoneNumber,
                    current_menu: "home",
                    session_data: {},
                })
                .select()
                .single();

            return this.getMenuResponse("home", newSession);
        }

        // Handle input and navigate
        const nextMenu = this.getNextMenu(session.current_menu, input);

        // Update session
        await supabase
            .from("ussd_sessions")
            .update({
                current_menu: nextMenu,
                last_activity_at: new Date(),
            })
            .eq("id", session.id);

        return this.getMenuResponse(nextMenu, session);
    }
}
```

### Day 4: M-Pesa Integration Update

```typescript
// backend/src/services/mpesa-service-supabase.ts
import { supabase } from "../config/supabase";

class MpesaService {
    async handleCallback(mpesaData: any): Promise<void> {
        try {
            // Validate signature
            if (!this.validateSignature(mpesaData)) {
                throw new Error("Invalid M-Pesa signature");
            }

            // Create transaction
            const { data: transaction, error } = await supabase
                .from("transactions")
                .insert({
                    chama_id: mpesaData.chama_id,
                    user_id: mpesaData.user_id,
                    type: "contribution",
                    amount: mpesaData.amount,
                    status: "completed",
                    payment_method: "mpesa",
                    reference: mpesaData.CheckoutRequestID,
                    mpesa_transaction_id: mpesaData.MpesaReceiptNumber,
                    metadata: mpesaData,
                })
                .select()
                .single();

            if (error) throw error;

            // Update chama balance
            const { data: chama } = await supabase
                .from("chamas")
                .select("balance")
                .eq("id", mpesaData.chama_id)
                .single();

            await supabase
                .from("chamas")
                .update({ balance: chama.balance + mpesaData.amount })
                .eq("id", mpesaData.chama_id);

            // Send notification
            await this.sendNotification({
                user_id: mpesaData.user_id,
                type: "transaction",
                title: "Contribution Received",
                body: `KES ${mpesaData.amount} received`,
                data: { transaction_id: transaction.id },
            });
        } catch (error) {
            console.error("M-Pesa callback error:", error);
            await this.logError(error);
        }
    }
}
```

### Day 5: Environment Configuration

```bash
# 1. Update backend .env
cat > backend/.env << 'EOF'
# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...
SUPABASE_ANON_KEY=eyJhbGc...
DATABASE_URL=postgresql://postgres:password@xxxx.db.supabase.co:5432/postgres

# App Configuration
NODE_ENV=production
API_PORT=3000
LOG_LEVEL=info

# M-Pesa
MPESA_CONSUMER_KEY=xxx
MPESA_CONSUMER_SECRET=xxx
MPESA_BUSINESS_SHORTCODE=xxx

# Agora Video
AGORA_APP_ID=xxx
AGORA_APP_CERTIFICATE=xxx

# Firebase
FIREBASE_CONFIG={"projectId":"xxx"...}

# Redis
REDIS_URL=redis://localhost:6379
EOF

# 2. Update Flutter config
cat > flutter_app/lib/config/env.dart << 'EOF'
class Environment {
  static const String SUPABASE_URL = 'https://xxxx.supabase.co';
  static const String SUPABASE_ANON_KEY = 'eyJhbGc...';
  static const String API_URL = 'https://api.pesachama.app';
  static const String AGORA_APP_ID = 'xxx';
}
EOF

# 3. Verify all configs
grep -r "SUPABASE_URL" . --include="*.ts" --include="*.dart"
```

---

## Week 4: Testing & Rollout

### Day 1: Comprehensive Testing

```bash
# 1. Run all tests
npm run test:unit
npm run test:integration
npm run test:e2e

# 2. Performance testing
npm run test:performance -- \
  --baseline=old_performance.json \
  --compare

# 3. Security testing
npm run test:security
npm audit
snyk test

# 4. Load testing
k6 run load-test.js --vus=100 --duration=10m

# 5. User acceptance testing
# - Have 10 users test all features
# - Collect feedback
# - Fix critical issues
```

### Day 2: Staging Deployment

```bash
# 1. Deploy to staging
git checkout -b staging-supabase
git push origin staging-supabase

# 2. Deploy backend
docker build -t pesachama-api:supabase .
docker push registry.example.com/pesachama-api:supabase
kubectl set image deployment/pesachama-api \
  api=registry.example.com/pesachama-api:supabase

# 3. Deploy Flutter app to beta
flutter build apk --release --flavor staging
# Upload to Firebase App Distribution
firebase app:distribute \
  staging.apk \
  --app=1:123456789:android:xyz \
  --groups=beta-testers

# 4. Smoke tests
bash run_smoke_tests.sh

# 5. Monitor
# Watch: Error rates, response times, database performance
# Alert on: Errors > 0.1%, Response time > 500ms
```

### Day 3: Production Preparation

```bash
# 1. Final backup of old system
pg_dump -U postgres -h old.database.local pesachama_prod | \
  gzip > backup_final_$(date +%Y%m%d_%H%M%S).sql.gz

# 2. Create rollback plan
cat > ROLLBACK_PLAN.md << 'EOF'
## Rollback Procedure

### Conditions for Rollback
- Error rate > 5% for >5 minutes
- Response time > 2000ms p95 for >10 minutes
- Data corruption detected
- Security breach
- Cascading failures

### Step 1: Notify Stakeholders (1 min)
- Send notification to team leads
- Post in #incident channel
- Start war room call

### Step 2: Revert Application (5 min)
- Roll back to previous API version
- Revert Flutter app on app stores
- Clear CDN cache

### Step 3: Restore Database (30 min)
- Stop all write operations
- Restore from backup
- Verify data integrity

### Step 4: Verify (10 min)
- Run smoke tests
- Check system health
- Monitor metrics

### Step 5: Post-Incident (ongoing)
- Collect logs/metrics
- Conduct root cause analysis
- Document lessons learned
EOF

# 3. Communication plan
cat > COMMS_PLAN.md << 'EOF'
## Pre-Migration Communication
- 1 week before: Email to all users
- 2 days before: In-app notification
- 1 hour before: Status page update

## During Migration
- Every 15 mins: Team update
- Every 30 mins: Public status update
- Immediate: Critical issue notifications

## Post-Migration
- Confirmation: System fully operational
- Thank you: Acknowledge user patience
- Follow-up: Customer survey
EOF

# 4. Create detailed checklist
cat > PRODUCTION_DEPLOY_CHECKLIST.md << 'EOF'
## Pre-Deployment Verification
- [ ] All tests green
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] Backup verified
- [ ] Rollback plan tested
- [ ] Team briefing completed
- [ ] Status page ready
- [ ] Communication plan finalized

## Deployment Steps
- [ ] Execute database migration
- [ ] Deploy API to production
- [ ] Deploy Flutter app (staged rollout)
- [ ] Verify endpoints responding
- [ ] Check error rate < 0.1%
- [ ] Verify M-Pesa callbacks working
- [ ] Test USSD flows
- [ ] Monitor real user data

## Post-Deployment
- [ ] Monitor for 4 hours
- [ ] Check error logs
- [ ] Verify all features working
- [ ] Get user confirmation
- [ ] Document any issues
- [ ] Celebrate success!
EOF
```

### Day 4: Production Deployment

```bash
# 1. Start with database
# - Ensure zero downtime by dual-write strategy
# - Keep old DB active for 24 hours as fallback

# 2. Stage traffic gradually
# - 5% → 25% → 50% → 100% over 2 hours

# 3. Monitor metrics
watch -n 5 kubectl get pods
watch -n 5 kubectl logs -f deployment/pesachama-api

# 4. Real-time monitoring
# - Error Dashboard: Sentry
# - Performance: DataDog
# - Database: Supabase Dashboard
# - User Experience: LogRocket

# 5. Execute deployment
bash deploy_to_production.sh

# 6. Verify each stage
bash smoke_tests.sh
bash integration_tests.sh
bash user_acceptance_tests.sh
```

### Day 5: Post-Deployment Activities

```bash
# 1. Monitor (24/7 for 7 days)
# Set alerts:
# - API errors > 0.1%
# - Response time p95 > 500ms
# - Database CPU > 80%
# - Storage usage > 70%

# 2. Verify all systems
bash verify_all_systems.sh

# 3. Decommission old database
# - After 48 hours of stable operation
# - Keep backup for 30 days
# - Document any lessons learned

# 4. User communication
# - Send "migration complete" email
# - Update status page
# - Close incident ticket

# 5. Team retrospective
# - Schedule for day 7
# - Discuss what went well
# - Identify improvements
# - Update documentation
```

---

## Rollback Procedures

### Immediate Rollback (< 10 minutes)

```bash
#!/bin/bash
# quick_rollback.sh

echo "⚠️  Starting emergency rollback..."

# 1. Revert API version
kubectl rollout undo deployment/pesachama-api
kubectl rollout status deployment/pesachama-api

# 2. Clear CDN cache
cloudflare --zone-id=xxx cache purge --files="*"

# 3. Notify team
slack-cli send -c incident-response \
  "🔄 Rollback initiated. API reverted to previous version."

# 4. Verify
bash smoke_tests.sh

echo "✅ Rollback complete. Verifying system..."
```

### Full Rollback (Database)

```bash
#!/bin/bash
# full_rollback.sh

echo "🔴 Starting full system rollback..."

# 1. Stop all writes
kubectl exec -it deployment/pesachama-api -- \
  psql -c "ALTER DATABASE pesachama SET default_transaction_read_only = on;"

# 2. Restore from backup
echo "📥 Restoring from backup..."
psql -h old.database.local -U postgres < backup_final.sql.gz

# 3. Verify data integrity
bash test_data_integrity.sh

# 4. Revert application
kubectl rollout undo deployment/pesachama-api
kubectl rollout status deployment/pesachama-api

# 5. Re-enable writes
kubectl exec -it deployment/pesachama-api -- \
  psql -c "ALTER DATABASE pesachama SET default_transaction_read_only = off;"

# 6. Run smoke tests
bash smoke_tests.sh

echo "✅ Full rollback complete"
```

---

## Success Metrics

After migration, verify:

```markdown
### Performance

- API response time: < 500ms p95 ✓
- Database query time: < 100ms median ✓
- Error rate: < 0.1% ✓

### Reliability

- Uptime: > 99.9% ✓
- Zero data loss ✓
- No duplicate transactions ✓

### Security

- All RLS policies enforced ✓
- Audit logs complete ✓
- No unauthorized access ✓

### User Experience

- Zero user-visible outages ✓
- All features working ✓
- Notifications delivered ✓
```

---

## Conclusion

This step-by-step guide ensures a smooth, zero-downtime migration to Supabase.
Key success factors:

1. **Preparation** - Thorough testing before cutover
2. **Validation** - Data integrity checks at each step
3. **Monitoring** - Real-time visibility throughout
4. **Communication** - Clear updates to all stakeholders
5. **Rollback** - Quick recovery if needed

Good luck with your migration! 🚀
