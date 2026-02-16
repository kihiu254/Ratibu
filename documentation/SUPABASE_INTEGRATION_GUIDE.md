# PesaChama Supabase Integration Guide

## Executive Summary

This comprehensive guide documents the complete integration of Supabase into the
PesaChama digital banking platform. Supabase provides a managed PostgreSQL
database, built-in authentication, real-time subscriptions, storage solutions,
and vector search capabilities—allowing us to replace our custom backend
authentication with a production-grade BaaS platform while maintaining full
control over the database.

**Key Benefits:**

- Managed PostgreSQL with automatic backups and scaling
- Built-in authentication (email, OAuth, biometric support)
- Real-time subscriptions for live updates
- Edge functions for serverless computing
- Storage for profile images and documents
- Row-Level Security (RLS) for data privacy
- Instant API generation from database schema

**Migration Timeline:** 2-3 weeks **Team Allocation:** 4-6 developers **Zero
Downtime Migration:** Yes, using replica-based approach

---

## Table of Contents

1. [1. Supabase Setup & Configuration](#1-supabase-setup--configuration)
2. [2. Database Schema Migration](#2-database-schema-migration)
3. [3. Authentication Integration](#3-authentication-integration)
4. [4. Storage Solutions](#4-storage-solutions)
5. [5. Real-time Features](#5-real-time-features)
6. [6. Backend API Migration](#6-backend-api-migration)
7. [7. Flutter App Integration](#7-flutter-app-integration)
8. [8. Security & Row-Level Security](#8-security--row-level-security)
9. [9. Performance Optimization](#9-performance-optimization)
10. [10. Testing & Validation](#10-testing--validation)
11. [11. Deployment Strategy](#11-deployment-strategy)
12. [12. Troubleshooting & Best Practices](#12-troubleshooting--best-practices)

---

## 1. Supabase Setup & Configuration

### 1.1 Initial Project Creation

#### Step 1: Create Supabase Account

```bash
# Visit https://supabase.com and sign up
# Create a new project with these settings:
# - Region: Choose closest to users (e.g., eu-west-1 for Europe, us-east-1 for US)
# - Plan: Pro or Enterprise for production
# - Database: PostgreSQL 14+
```

#### Step 2: Obtain Credentials

The Supabase project gives you:

- **Project URL**: `https://<project-ref>.supabase.co`
- **Anon Key**: Public key for client-side authentication
- **Service Role Key**: Private key for server-side operations (protect
  carefully)
- **Database Connection String**:
  `postgresql://postgres:<password>@<project-ref>.db.supabase.co:5432/postgres`

#### Step 3: Configure Environment Variables

**Backend `.env`:**

```env
# Supabase Configuration
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SUPABASE_ANON_KEY=eyJhbGc...
DATABASE_URL=postgresql://postgres:password@xxxx.db.supabase.co:5432/postgres
POSTGRES_PASSWORD=<your-database-password>

# Frontend Configuration (Flutter)
SUPABASE_PROJECT_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
```

**Flutter Configuration (`lib/config/supabase_config.dart`):**

```dart
const String SUPABASE_URL = 'https://xxxx.supabase.co';
const String SUPABASE_ANON_KEY = 'eyJhbGc...';
```

### 1.2 Supabase Project Structure

```
Supabase Project
├── Authentication (Email, Google, GitHub OAuth)
├── Database (PostgreSQL 14+)
│   ├── Public Schema
│   ├── Private Schema
│   └── Views & Functions
├── Storage Buckets
│   ├── avatars (profile pictures)
│   ├── documents (KYC/AML docs)
│   └── recordings (meeting recordings)
├── Edge Functions
│   ├── M-Pesa Callbacks
│   ├── USSD Handlers
│   └── Notifications
├── Realtime Configuration
└── Vector Search (pgvector)
```

### 1.3 Network Security Setup

#### IP Whitelisting

```sql
-- Whitelist approved IP addresses
-- In Supabase Dashboard: Database > Network

-- Approved IPs:
-- 1. Backend servers: 10.0.0.0/8 (internal)
-- 2. M-Pesa gateway: 196.201.212.0/24
-- 3. Africa's Talking: 105.163.0.0/16
-- 4. Agora: 203.107.34.0/24
```

#### SSL/TLS Connection

```bash
# Always enforce SSL for connections
# Connection string includes: sslmode=require
postgresql://postgres:password@host:5432/postgres?sslmode=require
```

---

## 2. Database Schema Migration

### 2.1 Supabase-Optimized Schema

The existing PostgreSQL schema is fully compatible with Supabase. Key
optimizations:

#### Enable Required Extensions

```sql
-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "jwt";
CREATE EXTENSION IF NOT EXISTS "http";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";
```

### 2.2 Complete Database Schema

#### 2.2.1 Users Table (Enhanced)

```sql
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    
    -- Authentication
    password_hash VARCHAR(255),
    biometric_enabled BOOLEAN DEFAULT FALSE,
    biometric_data BYTEA, -- Fingerprint/face template
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    
    -- Profile
    profile_image_url TEXT,
    bio TEXT,
    date_of_birth DATE,
    national_id VARCHAR(50) UNIQUE,
    
    -- Verification & Status
    phone_verified BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
    kyc_status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
    kyc_documents JSONB, -- Document URLs and verification dates
    
    -- Tracking
    last_login_at TIMESTAMP WITH TIME ZONE,
    account_status VARCHAR(50) DEFAULT 'active', -- active, suspended, closed
    suspension_reason TEXT,
    
    -- Metadata
    device_tokens TEXT[], -- For push notifications
    preferred_language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
    CONSTRAINT valid_phone CHECK (phone ~* '^\+?[1-9]\d{1,14}$')
);

-- Create index for faster lookups
CREATE INDEX idx_users_email ON public.users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_phone ON public.users(phone) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_created_at ON public.users(created_at);
CREATE INDEX idx_users_account_status ON public.users(account_status);
```

#### 2.2.2 Chamas Table

```sql
CREATE TABLE IF NOT EXISTS public.chamas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES public.users(id),
    
    -- Financial Settings
    balance DECIMAL(15, 2) DEFAULT 0,
    member_limit INTEGER DEFAULT 50,
    contribution_frequency VARCHAR(50), -- daily, weekly, monthly
    contribution_amount DECIMAL(15, 2),
    min_withdrawal_amount DECIMAL(15, 2) DEFAULT 100,
    max_withdrawal_amount DECIMAL(15, 2) DEFAULT 1000000,
    
    -- Status & Rules
    status VARCHAR(50) DEFAULT 'active', -- active, paused, closed
    rules JSONB, -- Store complex rules
    terms_conditions TEXT,
    
    -- Statistics
    total_members INTEGER DEFAULT 1,
    total_contributed DECIMAL(15, 2) DEFAULT 0,
    total_disbursed DECIMAL(15, 2) DEFAULT 0,
    meeting_count INTEGER DEFAULT 0,
    
    -- Metadata
    logo_url TEXT,
    category VARCHAR(50), -- savings, credit, investment
    registration_number VARCHAR(100),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_chamas_created_by ON public.chamas(created_by);
CREATE INDEX idx_chamas_status ON public.chamas(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_chamas_created_at ON public.chamas(created_at);
```

#### 2.2.3 Chama Members Table

```sql
CREATE TABLE IF NOT EXISTS public.chama_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chama_id UUID NOT NULL REFERENCES public.chamas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id),
    
    -- Role & Status
    role VARCHAR(50) DEFAULT 'member', -- admin, treasurer, member
    status VARCHAR(50) DEFAULT 'active', -- active, suspended, left
    
    -- Financial Tracking
    total_contribution DECIMAL(15, 2) DEFAULT 0,
    total_withdrawn DECIMAL(15, 2) DEFAULT 0,
    contribution_count INTEGER DEFAULT 0,
    
    -- Metadata
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE,
    reason_for_leaving TEXT,
    
    -- Constraints
    UNIQUE(chama_id, user_id),
    CONSTRAINT valid_role CHECK (role IN ('admin', 'treasurer', 'member')),
    CONSTRAINT valid_status CHECK (status IN ('active', 'suspended', 'left'))
);

CREATE INDEX idx_chama_members_user_id ON public.chama_members(user_id);
CREATE INDEX idx_chama_members_chama_id ON public.chama_members(chama_id);
CREATE INDEX idx_chama_members_status ON public.chama_members(status);
```

#### 2.2.4 Transactions Table

```sql
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chama_id UUID NOT NULL REFERENCES public.chamas(id),
    user_id UUID NOT NULL REFERENCES public.users(id),
    
    -- Transaction Details
    type VARCHAR(50) NOT NULL, -- contribution, disbursement, fee, penalty, refund
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed, reversed
    
    -- Payment Information
    payment_method VARCHAR(50), -- mpesa, bank, cash, internal
    reference VARCHAR(100), -- M-Pesa receipt number
    mpesa_transaction_id VARCHAR(100),
    
    -- Details
    description TEXT,
    metadata JSONB, -- M-Pesa data, error details, etc.
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('pending', 'completed', 'failed', 'reversed'))
);

CREATE INDEX idx_transactions_chama_id ON public.transactions(chama_id);
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at);
CREATE INDEX idx_transactions_payment_method ON public.transactions(payment_method);
```

#### 2.2.5 Disbursement Requests Table

```sql
CREATE TABLE IF NOT EXISTS public.disbursement_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chama_id UUID NOT NULL REFERENCES public.chamas(id),
    requested_by UUID NOT NULL REFERENCES public.users(id),
    
    -- Request Details
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    
    -- Status & Approval
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, completed
    approved_by UUID REFERENCES public.users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    -- Linked Transaction
    transaction_id UUID REFERENCES public.transactions(id),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_disbursement_requests_chama_id ON public.disbursement_requests(chama_id);
CREATE INDEX idx_disbursement_requests_status ON public.disbursement_requests(status);
```

#### 2.2.6 Meetings Table

```sql
CREATE TABLE IF NOT EXISTS public.meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chama_id UUID NOT NULL REFERENCES public.chamas(id),
    
    -- Meeting Details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER DEFAULT 60 CHECK (duration_minutes > 0),
    
    -- Agora/Video Conference Details
    meeting_link VARCHAR(500),
    agora_channel_name VARCHAR(255),
    agora_channel_token VARCHAR(1000),
    
    -- Recording & Status
    recording_url TEXT,
    recording_saved BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, in-progress, completed, cancelled
    
    -- Attendance
    attendees_count INTEGER DEFAULT 0,
    attendees_list JSONB, -- {user_id, joined_at, left_at}
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_meetings_chama_id ON public.meetings(chama_id);
CREATE INDEX idx_meetings_scheduled_at ON public.meetings(scheduled_at);
CREATE INDEX idx_meetings_status ON public.meetings(status);
```

#### 2.2.7 USSD Sessions Table

```sql
CREATE TABLE IF NOT EXISTS public.ussd_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    
    -- User & Session Info
    phone_number VARCHAR(20) NOT NULL,
    user_id UUID REFERENCES public.users(id),
    
    -- Navigation
    current_menu VARCHAR(100) NOT NULL, -- home, my_account, contributions, etc.
    menu_history TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Session Data
    session_data JSONB, -- Store temporary input data
    status VARCHAR(50) DEFAULT 'active', -- active, completed, timeout
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP + INTERVAL '5 minutes',
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('active', 'completed', 'timeout'))
);

CREATE INDEX idx_ussd_sessions_phone_number ON public.ussd_sessions(phone_number);
CREATE INDEX idx_ussd_sessions_user_id ON public.ussd_sessions(user_id);
CREATE INDEX idx_ussd_sessions_status ON public.ussd_sessions(status);
```

#### 2.2.8 Notifications Table

```sql
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Notification Details
    type VARCHAR(50) NOT NULL, -- transaction, meeting, disbursement, system
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    data JSONB, -- Custom data like transaction_id, meeting_id
    
    -- Status & Channels
    status VARCHAR(50) DEFAULT 'sent', -- sent, delivered, read, failed
    channels TEXT[] DEFAULT ARRAY['push']::TEXT[], -- push, sms, email, in-app
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP + INTERVAL '30 days'
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_status ON public.notifications(status);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at);
```

#### 2.2.9 Audit Logs Table

```sql
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Actor & Action
    user_id UUID REFERENCES public.users(id),
    action VARCHAR(50) NOT NULL, -- create, read, update, delete, login, logout
    resource_type VARCHAR(50) NOT NULL, -- user, chama, transaction, etc.
    resource_id UUID NOT NULL,
    
    -- Changes
    old_values JSONB,
    new_values JSONB,
    
    -- Details
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(50) DEFAULT 'success', -- success, failure
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_action CHECK (action IN ('create', 'read', 'update', 'delete', 'login', 'logout'))
);

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource_type ON public.audit_logs(resource_type);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at);
```

#### 2.2.10 Create Updated_At Trigger

```sql
-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chamas_updated_at BEFORE UPDATE ON public.chamas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_disbursement_requests_updated_at BEFORE UPDATE ON public.disbursement_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON public.meetings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 3. Authentication Integration

### 3.1 Supabase Auth Configuration

#### Enable Authentication Methods

```bash
# In Supabase Dashboard: Authentication > Providers

1. Email/Password (default)
2. Google OAuth
3. GitHub OAuth (for developer testing)
4. Phone (optional, for SMS OTP)
```

#### Email Templates Configuration

```html
<!-- Confirm Email -->
<h2>Confirm your email</h2>
<p>Click the link below to confirm your email address:</p>
<a href="{{ .ConfirmationURL }}">Confirm Email</a>

<!-- Reset Password -->
<h2>Reset your password</h2>
<p>Click the link below to reset your password:</p>
<a href="{{ .RecoveryURL }}">Reset Password</a>
```

### 3.2 Custom JWT Claims

Add custom claims to JWT tokens for role-based access:

```sql
-- Create function to add custom claims
CREATE OR REPLACE FUNCTION public.custom_jwt_claims(user_id UUID)
RETURNS JSONB AS $$
DECLARE
  claims JSONB;
BEGIN
  SELECT jsonb_build_object(
    'user_id', user.id,
    'email', user.email,
    'phone', user.phone,
    'roles', ARRAY(
      SELECT DISTINCT role 
      FROM public.chama_members 
      WHERE user_id = user.id AND status = 'active'
    ),
    'kyc_status', user.kyc_status
  ) INTO claims
  FROM public.users user
  WHERE user.id = user_id;
  
  RETURN claims;
END;
$$ LANGUAGE plpgsql;
```

### 3.3 Backend Auth Integration

Update Express backend to use Supabase Auth:

```typescript
// backend/src/config/supabase.ts
import { createClient } from "@supabase/supabase-js";
import { Database } from "../types/supabase";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service role client (admin operations)
export const supabaseAdmin = createClient<Database>(
    supabaseUrl,
    supabaseServiceKey,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    },
);

// Anon client for public operations
export const supabaseAnon = createClient<Database>(
    supabaseUrl,
    process.env.SUPABASE_ANON_KEY!,
);
```

### 3.4 Update Auth Middleware

```typescript
// backend/src/middleware/auth-supabase.ts
import { NextFunction, Request, Response } from "express";
import { supabaseAdmin } from "../config/supabase";

export const authenticateToken = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.status(401).json({ error: "Missing token" });
        }

        // Verify token with Supabase
        const {
            data: { user },
            error,
        } = await supabaseAdmin.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: "Invalid token" });
        }

        // Attach user to request
        (req as any).user = user;
        next();
    } catch (error) {
        res.status(401).json({ error: "Authentication failed" });
    }
};
```

### 3.5 Auth Routes Update

```typescript
// backend/src/routes/auth-supabase.ts
import express from "express";
import { supabaseAdmin } from "../config/supabase";

const router = express.Router();

// Register
router.post("/register", async (req, res) => {
    const { email, password, firstName, lastName, phone } = req.body;

    try {
        // Create Supabase auth user
        const { data: authData, error: authError } = await supabaseAdmin.auth
            .admin.createUser({
                email,
                password,
                email_confirm: false,
            });

        if (authError) throw authError;

        // Create user profile
        const { error: profileError } = await supabaseAdmin
            .from("users")
            .insert({
                id: authData.user.id,
                email,
                phone,
                first_name: firstName,
                last_name: lastName,
            });

        if (profileError) throw profileError;

        res.json({
            message: "Registration successful. Check your email to confirm.",
        });
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

// Login
router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const { data, error } = await supabaseAdmin.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;

        // Update last_login_at
        await supabaseAdmin
            .from("users")
            .update({ last_login_at: new Date().toISOString() })
            .eq("id", data.user.id);

        res.json({
            user: data.user,
            session: data.session,
        });
    } catch (error) {
        res.status(401).json({ error: (error as Error).message });
    }
});

// Refresh Token
router.post("/refresh", async (req, res) => {
    const { refresh_token } = req.body;

    try {
        const { data, error } = await supabaseAdmin.auth.refreshSession({
            refresh_token,
        });

        if (error) throw error;

        res.json({ session: data.session });
    } catch (error) {
        res.status(401).json({ error: "Token refresh failed" });
    }
});

// Logout
router.post("/logout", async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];

    try {
        await supabaseAdmin.auth.signOut();
        res.json({ message: "Logout successful" });
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

export default router;
```

---

## 4. Storage Solutions

### 4.1 Storage Bucket Configuration

Create storage buckets for different file types:

```sql
-- Avatars Bucket (Public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);

-- Documents Bucket (Private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false);

-- Meeting Recordings (Private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('recordings', 'recordings', false);
```

### 4.2 File Upload Implementation

**Backend Upload Handler:**

```typescript
// backend/src/routes/upload.ts
import express, { Request, Response } from "express";
import multer from "multer";
import { supabaseAdmin } from "../config/supabase";
import { authenticateToken } from "../middleware/auth-supabase";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Upload avatar
router.post(
    "/avatar",
    authenticateToken,
    upload.single("file"),
    async (req: any, res) => {
        try {
            const file = req.file;
            const userId = req.user.id;

            if (!file) {
                return res.status(400).json({ error: "No file uploaded" });
            }

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                return res.status(400).json({ error: "File too large" });
            }

            // Validate file type
            const validMimes = ["image/jpeg", "image/png", "image/webp"];
            if (!validMimes.includes(file.mimetype)) {
                return res.status(400).json({ error: "Invalid file type" });
            }

            // Upload to Supabase Storage
            const fileName = `${userId}-${Date.now()}`;
            const { data, error } = await supabaseAdmin.storage
                .from("avatars")
                .upload(`${userId}/${fileName}`, file.buffer, {
                    contentType: file.mimetype,
                    cacheControl: "3600",
                });

            if (error) throw error;

            // Get public URL
            const { data: urlData } = supabaseAdmin.storage
                .from("avatars")
                .getPublicUrl(`${userId}/${fileName}`);

            // Update user profile
            await supabaseAdmin
                .from("users")
                .update({ profile_image_url: urlData.publicUrl })
                .eq("id", userId);

            res.json({ url: urlData.publicUrl });
        } catch (error) {
            res.status(500).json({ error: (error as Error).message });
        }
    },
);

// Upload document (KYC, etc.)
router.post(
    "/document",
    authenticateToken,
    upload.single("file"),
    async (req: any, res) => {
        try {
            const file = req.file;
            const userId = req.user.id;
            const { documentType } = req.body; // passport, drivers_license, national_id

            if (!file || !documentType) {
                return res.status(400).json({
                    error: "Missing file or documentType",
                });
            }

            // Validate file size (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                return res.status(400).json({ error: "File too large" });
            }

            const fileName = `${userId}-${documentType}-${Date.now()}`;
            const { data, error } = await supabaseAdmin.storage
                .from("documents")
                .upload(`${userId}/${fileName}`, file.buffer, {
                    contentType: file.mimetype,
                });

            if (error) throw error;

            // Store document reference in database
            const { data: user } = await supabaseAdmin
                .from("users")
                .select("kyc_documents")
                .eq("id", userId)
                .single();

            const kyc_documents = user?.kyc_documents || {};
            kyc_documents[documentType] = {
                fileName,
                uploadedAt: new Date().toISOString(),
                status: "pending",
            };

            await supabaseAdmin
                .from("users")
                .update({ kyc_documents })
                .eq("id", userId);

            res.json({ message: "Document uploaded successfully" });
        } catch (error) {
            res.status(500).json({ error: (error as Error).message });
        }
    },
);

export default router;
```

**Flutter Upload Implementation:**

```dart
// flutter_app/lib/services/storage_service.dart
import 'package:supabase_flutter/supabase_flutter.dart';
import 'dart:io';

class StorageService {
  final SupabaseClient supabase = Supabase.instance.client;

  Future<String?> uploadAvatar(File imageFile) async {
    try {
      final userId = supabase.auth.currentUser!.id;
      final fileName = '${userId}-${DateTime.now().millisecondsSinceEpoch}';

      final response = await supabase.storage
          .from('avatars')
          .upload('$userId/$fileName', imageFile);

      final publicUrl = supabase.storage
          .from('avatars')
          .getPublicUrl('$userId/$fileName');

      return publicUrl;
    } catch (e) {
      print('Error uploading avatar: $e');
      return null;
    }
  }

  Future<String?> uploadDocument(File documentFile, String documentType) async {
    try {
      final userId = supabase.auth.currentUser!.id;
      final fileName = '${userId}-${documentType}-${DateTime.now().millisecondsSinceEpoch}';

      await supabase.storage
          .from('documents')
          .upload('$userId/$fileName', documentFile);

      return fileName;
    } catch (e) {
      print('Error uploading document: $e');
      return null;
    }
  }
}
```

---

## 5. Real-time Features

### 5.1 Real-time Subscriptions

Configure Supabase Realtime for live updates:

```typescript
// backend/src/services/realtime-service.ts
import { supabaseAdmin } from "../config/supabase";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export class RealtimeService {
    // Subscribe to transaction updates
    static subscribeToTransactions(
        chamaId: string,
        callback: (data: any) => void,
    ) {
        return supabaseAdmin
            .channel(`transactions:${chamaId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "transactions",
                    filter: `chama_id=eq.${chamaId}`,
                },
                (payload: RealtimePostgresChangesPayload<any>) => {
                    callback(payload);
                },
            )
            .subscribe();
    }

    // Subscribe to member updates
    static subscribeToMembers(chamaId: string, callback: (data: any) => void) {
        return supabaseAdmin
            .channel(`members:${chamaId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "chama_members",
                    filter: `chama_id=eq.${chamaId}`,
                },
                (payload: RealtimePostgresChangesPayload<any>) => {
                    callback(payload);
                },
            )
            .subscribe();
    }
}
```

**Flutter Real-time Integration:**

```dart
// flutter_app/lib/services/realtime_service.dart
import 'package:supabase_flutter/supabase_flutter.dart';

class RealtimeService {
  final SupabaseClient supabase = Supabase.instance.client;

  Stream<List<Transaction>> transactionsStream(String chamaId) {
    return supabase
        .from('transactions')
        .stream(primaryKey: ['id'])
        .eq('chama_id', chamaId)
        .order('created_at', ascending: false)
        .map((List<Map<String, dynamic>> data) =>
            data.map((json) => Transaction.fromJson(json)).toList());
  }

  Stream<List<ChamaMember>> membersStream(String chamaId) {
    return supabase
        .from('chama_members')
        .stream(primaryKey: ['id'])
        .eq('chama_id', chamaId)
        .map((List<Map<String, dynamic>> data) =>
            data.map((json) => ChamaMember.fromJson(json)).toList());
  }
}
```

---

## 6. Backend API Migration

### 6.1 API Simplification with Supabase

With Supabase, we can leverage the auto-generated API for read operations:

```typescript
// Before: Custom endpoint
GET /api/users/:id/chamas

// After: Direct Supabase queries
const { data } = await supabase
  .from('chama_members')
  .select('chamas(*)')
  .eq('user_id', userId);
```

### 6.2 Business Logic in Edge Functions

Move server logic to Supabase Edge Functions:

```typescript
// supabase/functions/process-mpesa-callback/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0";

serve(async (req) => {
    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    const mpesaData = await req.json();
    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    try {
        // Validate M-Pesa signature
        const isValid = validateMpesaSignature(mpesaData);
        if (!isValid) {
            throw new Error("Invalid M-Pesa signature");
        }

        // Create transaction record
        const { data, error } = await supabase
            .from("transactions")
            .insert({
                chama_id: mpesaData.chama_id,
                user_id: mpesaData.user_id,
                type: "contribution",
                amount: mpesaData.amount,
                payment_method: "mpesa",
                reference: mpesaData.CheckoutRequestID,
                mpesa_transaction_id: mpesaData.MpesaReceiptNumber,
                status: "completed",
                metadata: mpesaData,
            });

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

        return new Response(
            JSON.stringify({ success: true, transactionId: data[0].id }),
            { status: 200, headers: { "Content-Type": "application/json" } },
        );
    } catch (error) {
        console.error("Error processing M-Pesa callback:", error);
        return new Response(
            JSON.stringify({ error: (error as Error).message }),
            { status: 400, headers: { "Content-Type": "application/json" } },
        );
    }
});
```

---

## 7. Flutter App Integration

### 7.1 Supabase Configuration in Flutter

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

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Supabase.instance.client.auth.currentSession == null
          ? const LoginScreen()
          : const HomeScreen(),
    );
  }
}
```

### 7.2 Updated Auth Provider

```dart
// flutter_app/lib/providers/auth_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier();
});

class AuthNotifier extends StateNotifier<AuthState> {
  final _supabase = Supabase.instance.client;

  AuthNotifier() : super(const AuthState.initial());

  Future<void> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    required String phone,
  }) async {
    state = const AuthState.loading();
    
    try {
      // Register with Supabase Auth
      final AuthResponse response = await _supabase.auth.signUp(
        email: email,
        password: password,
      );

      // Create user profile
      await _supabase.from('users').insert({
        'id': response.user!.id,
        'email': email,
        'phone': phone,
        'first_name': firstName,
        'last_name': lastName,
      });

      state = const AuthState.unauthenticated();
    } on AuthException catch (e) {
      state = AuthState.error(e.message);
    } catch (e) {
      state = AuthState.error('Registration failed');
    }
  }

  Future<void> login({
    required String email,
    required String password,
  }) async {
    state = const AuthState.loading();
    
    try {
      final AuthResponse response = await _supabase.auth.signInWithPassword(
        email: email,
        password: password,
      );

      state = AuthState.authenticated(response.user!);
    } on AuthException catch (e) {
      state = AuthState.error(e.message);
    } catch (e) {
      state = AuthState.error('Login failed');
    }
  }

  Future<void> logout() async {
    await _supabase.auth.signOut();
    state = const AuthState.unauthenticated();
  }
}

sealed class AuthState {
  const AuthState();
  
  const factory AuthState.initial() = _Initial;
  const factory AuthState.loading() = _Loading;
  const factory AuthState.authenticated(User user) = _Authenticated;
  const factory AuthState.unauthenticated() = _Unauthenticated;
  const factory AuthState.error(String message) = _Error;
}

class _Initial extends AuthState {
  const _Initial();
}

class _Loading extends AuthState {
  const _Loading();
}

class _Authenticated extends AuthState {
  final User user;
  const _Authenticated(this.user);
}

class _Unauthenticated extends AuthState {
  const _Unauthenticated();
}

class _Error extends AuthState {
  final String message;
  const _Error(this.message);
}
```

---

## 8. Security & Row-Level Security

### 8.1 Implement RLS Policies

**Enable RLS on all tables:**

```sql
-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chamas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chama_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their own profile
CREATE POLICY "Users can view own profile"
ON public.users FOR SELECT
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.users FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Users can view chamas they're a member of
CREATE POLICY "Users can view member chamas"
ON public.chamas FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chama_members
    WHERE chama_id = chamas.id
    AND user_id = auth.uid()
  )
  OR created_by = auth.uid()
);

-- Users can view their own transactions
CREATE POLICY "Users can view own transactions"
ON public.transactions FOR SELECT
USING (user_id = auth.uid());

-- Only chama admins/treasurers can approve disbursements
CREATE POLICY "Only admins can approve disbursements"
ON public.disbursement_requests FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.chama_members
    WHERE chama_id = disbursement_requests.chama_id
    AND user_id = auth.uid()
    AND role IN ('admin', 'treasurer')
  )
);
```

### 8.2 Audit Trail

```sql
-- Function to log all changes
CREATE OR REPLACE FUNCTION public.log_audit_trail()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    old_values,
    new_values,
    ip_address
  ) VALUES (
    auth.uid(),
    TG_ARGV[0]::VARCHAR,
    TG_TABLE_NAME,
    CASE
      WHEN TG_OP = 'DELETE' THEN OLD.id
      ELSE NEW.id
    END,
    CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW) ELSE NULL END,
    current_setting('app.client_ip')::INET
  );
  
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply to all sensitive tables
CREATE TRIGGER audit_users
AFTER INSERT OR UPDATE OR DELETE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail('action');

CREATE TRIGGER audit_transactions
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail('action');
```

---

## 9. Performance Optimization

### 9.1 Database Indexing Strategy

```sql
-- Index for common filters
CREATE INDEX idx_users_status ON public.users(account_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_chama_members_status ON public.chama_members(status);

-- Index for joins
CREATE INDEX idx_chama_members_user_chama ON public.chama_members(user_id, chama_id);
CREATE INDEX idx_transactions_user_chama ON public.transactions(user_id, chama_id);

-- Index for date ranges
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at DESC);
CREATE INDEX idx_meetings_scheduled_at ON public.meetings(scheduled_at DESC);

-- Full-text search
CREATE INDEX idx_chamas_search ON public.chamas USING GIN(
  to_tsvector('english', name || ' ' || COALESCE(description, ''))
);

-- Analyze query performance
ANALYZE public.users;
ANALYZE public.chamas;
ANALYZE public.transactions;
```

### 9.2 Connection Pooling

```typescript
// Use PgBouncer with Supabase
DATABASE_URL=postgresql://user:pass@db.supabase.co:6543/postgres?sslmode=require

// Connection pool settings
max_connections: 100
pool_mode: transaction
```

### 9.3 Caching Strategy

```typescript
// backend/src/cache/cache-service.ts
import Redis from "redis";

const redis = Redis.createClient({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || "6379"),
});

export class CacheService {
    // Cache user data (30 minutes)
    static async getUser(userId: string) {
        const cached = await redis.get(`user:${userId}`);
        if (cached) return JSON.parse(cached);

        const { data: user } = await supabase
            .from("users")
            .select("*")
            .eq("id", userId)
            .single();

        await redis.setEx(`user:${userId}`, 1800, JSON.stringify(user));
        return user;
    }

    // Cache chama data (1 hour)
    static async getChama(chamaId: string) {
        const cached = await redis.get(`chama:${chamaId}`);
        if (cached) return JSON.parse(cached);

        const { data: chama } = await supabase
            .from("chamas")
            .select("*")
            .eq("id", chamaId)
            .single();

        await redis.setEx(`chama:${chamaId}`, 3600, JSON.stringify(chama));
        return chama;
    }

    // Invalidate cache on update
    static async invalidateUserCache(userId: string) {
        await redis.del(`user:${userId}`);
    }

    static async invalidateChamaCache(chamaId: string) {
        await redis.del(`chama:${chamaId}`);
    }
}
```

---

## 10. Testing & Validation

### 10.1 Backend Testing

```typescript
// backend/src/tests/supabase-auth.test.ts
import { supabaseAdmin } from "../config/supabase";

describe("Supabase Authentication", () => {
    test("should register new user", async () => {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: "test@example.com",
            password: "TestPassword123!",
            email_confirm: true,
        });

        expect(error).toBeNull();
        expect(data.user).toBeDefined();
        expect(data.user?.email).toBe("test@example.com");
    });

    test("should sign in with credentials", async () => {
        const { data, error } = await supabaseAdmin.auth.signInWithPassword({
            email: "test@example.com",
            password: "TestPassword123!",
        });

        expect(error).toBeNull();
        expect(data.session).toBeDefined();
    });

    test("should refresh token", async () => {
        const session = await getValidSession();
        const { data, error } = await supabaseAdmin.auth.refreshSession({
            refresh_token: session.refresh_token,
        });

        expect(error).toBeNull();
        expect(data.session?.access_token).toBeDefined();
    });
});
```

### 10.2 Integration Testing

```typescript
// backend/src/tests/integration.test.ts
describe("End-to-End Workflows", () => {
    test("should create chama and add members", async () => {
        // Create user
        const userId = await createTestUser("user@test.com");

        // Create chama
        const { data: chama } = await supabaseAdmin
            .from("chamas")
            .insert({
                name: "Test Chama",
                created_by: userId,
                contribution_amount: 1000,
            })
            .select()
            .single();

        // Add member
        const { data: member } = await supabaseAdmin
            .from("chama_members")
            .insert({
                chama_id: chama.id,
                user_id: userId,
                role: "admin",
            })
            .select()
            .single();

        expect(member.chama_id).toBe(chama.id);
        expect(member.role).toBe("admin");
    });

    test("should process transaction", async () => {
        const chamaId = await createTestChama();
        const userId = await createTestUser("user@test.com");

        const { data: transaction } = await supabaseAdmin
            .from("transactions")
            .insert({
                chama_id: chamaId,
                user_id: userId,
                type: "contribution",
                amount: 1000,
                payment_method: "mpesa",
                status: "completed",
            })
            .select()
            .single();

        expect(transaction.status).toBe("completed");
        expect(transaction.amount).toBe(1000);
    });
});
```

### 10.3 Security Testing

```typescript
// Verify RLS is working
test("User should not view other users profiles", async () => {
    const user1Token = await getAuthToken("user1@test.com");
    const user2Id = await createTestUser("user2@test.com");

    const { data, error } = await supabaseAnon
        .from("users")
        .select("*")
        .eq("id", user2Id)
        .setAuth(user1Token);

    // Should return no data due to RLS
    expect(data).toHaveLength(0);
});
```

---

## 11. Deployment Strategy

### 11.1 Data Migration Plan

**Phase 1: Preparation (Week 1)**

```bash
# 1. Create Supabase project
# 2. Set up schema in Supabase
# 3. Configure authentication
# 4. Set up storage buckets
# 5. Enable RLS policies
```

**Phase 2: Migration (Week 2)**

```bash
# 1. Create temporary replication user
# 2. Set up PostgreSQL WAL replication
# 3. Perform initial data dump
# 4. Migrate to Supabase
# 5. Verify data integrity

# Migration script
pg_dump olddb | psql -h supabase.co -U postgres pesachama
```

**Phase 3: Validation (Week 2-3)**

```bash
# 1. Verify all data migrated
# 2. Test application against new database
# 3. Run integration tests
# 4. Perform load testing
# 5. Security audit
```

**Phase 4: Cutover (Week 3)**

```bash
# 1. Switch API to Supabase endpoints
# 2. Monitor error rates
# 3. Keep old database as backup
# 4. Gradual traffic shift if needed
# 5. Full cutover confirmation
```

### 11.2 Deployment Checklist

```markdown
## Pre-Deployment

- [ ] All tests passing (100% coverage on critical paths)
- [ ] Performance benchmarks acceptable
- [ ] Security audit completed
- [ ] RLS policies verified
- [ ] Backup strategy tested
- [ ] Monitoring configured
- [ ] Incident response plan documented

## Deployment

- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] API endpoints tested
- [ ] Flutter app updated
- [ ] USSD system updated
- [ ] M-Pesa integration verified

## Post-Deployment

- [ ] Monitor error rates (<0.1%)
- [ ] Monitor response times (<500ms p95)
- [ ] Verify all features working
- [ ] Check user reports
- [ ] Monitor database performance
- [ ] Review audit logs
```

---

## 12. Troubleshooting & Best Practices

### 12.1 Common Issues

| Issue                         | Cause                       | Solution                                           |
| ----------------------------- | --------------------------- | -------------------------------------------------- |
| **RLS denies all access**     | RLS policies not configured | Create explicit allow policies before enabling RLS |
| **Slow queries**              | Missing indexes             | Add indexes on filtered/joined columns             |
| **Auth fails**                | Expired tokens              | Implement token refresh mechanism                  |
| **Storage permission denied** | RLS on storage              | Configure public/private bucket policies           |
| **Real-time lag**             | High connection count       | Increase max_connections in Database settings      |

### 12.2 Best Practices

#### 1. Security

```typescript
// ✅ DO: Use service key only on backend
const supabaseAdmin = createClient(url, serviceKey);

// ❌ DON'T: Expose service key to frontend
const supabaseClient = createClient(url, serviceKey);
```

#### 2. Performance

```typescript
// ✅ DO: Use select() to limit columns
const { data } = await supabase
    .from("users")
    .select("id, email, first_name")
    .eq("id", userId);

// ❌ DON'T: Fetch all columns
const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId);
```

#### 3. Error Handling

```typescript
// ✅ DO: Handle all error cases
try {
  const { data, error } = await supabase.auth.signInWithPassword(...);
  if (error) {
    // Log specific error
    console.error('Auth error:', error.message);
  }
} catch (e) {
  // Handle unexpected errors
  console.error('Unexpected error:', e);
}

// ❌ DON'T: Ignore errors silently
const { data } = await supabase.auth.signInWithPassword(...);
```

#### 4. Real-time Subscriptions

```dart
// ✅ DO: Unsubscribe when leaving screen
@override
void dispose() {
  subscription?.cancel();
  super.dispose();
}

// ❌ DON'T: Leave subscriptions active
void initState() {
  subscription = supabase.from('transactions').stream(...);
}
```

### 12.3 Monitoring & Alerts

```sql
-- Query to monitor slow queries
SELECT
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements
WHERE mean_time > 100
ORDER BY mean_time DESC;

-- Monitor connection count
SELECT
  datname,
  count(*) as connections
FROM pg_stat_activity
GROUP BY datname;

-- Monitor table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 12.4 Backup & Disaster Recovery

```bash
# Daily backup to Supabase (automated)
# Weekly manual backup to S3

# Restore from backup
pg_restore -h supabase.co -U postgres -d pesachama backup.sql

# Point-in-time recovery
# Contact Supabase support for PITR restore
```

---

## Conclusion

This Supabase integration transforms PesaChama into a modern, scalable platform
with:

✅ **Managed PostgreSQL** - Automated backups, scaling, security ✅ **Built-in
Authentication** - Email, OAuth, MFA support ✅ **Real-time Capabilities** -
Live updates across all clients ✅ **Secure Storage** - File uploads with RLS
protection ✅ **Serverless Computing** - Edge Functions for business logic ✅
**Complete Audit Trail** - Full transaction history ✅ **Compliance Ready** -
KYC/AML framework included

The migration is designed for **zero-downtime** deployment with comprehensive
testing and monitoring to ensure production-grade reliability.
