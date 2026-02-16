# Ratibu Project: Complete Technology Stack Overview

## Executive Summary

Ratibu is a modern digital banking and chama (savings group) management
platform. It leverages a cutting-edge technology stack designed for scalability,
security, and a premium user experience across web and mobile platforms. The
architecture is built around a robust backend-as-a-service (BaaS) model using
Supabase, coupled with high-performance frontend frameworks.

---

## 1. Frontend Web Development

The web application serves as the primary interface for users to access their
dashboards, manage groups, and view analytics.

- **Framework:** **React 18**
  - Leveraging Functional Components and Hooks for modularity.
- **Build Tool:** **Vite**
  - Chosen for its lightning-fast hot module replacement (HMR) and optimized
    build performance.
- **Language:** **TypeScript**
  - Ensures type safety and reduces runtime errors across the codebase.
- **Styling:** **Tailwind CSS 3.4**
  - Utility-first CSS framework for rapid UI development and consistent design
    tokens.
  - **PostCSS** for processing CSS.
- **Animation:** **Framer Motion**
  - Provides production-ready animations and complex gesture support for a
    "premium" feel.
- **Routing:** **React Router DOM 6**
  - Client-side routing for seamless page transitions.
- **Icons:** **Lucide React**
  - Consistent, lightweight icon set.
- **UI Components:** Custom-built component library (Buttons, Inputs, Cards)
  styled with Tailwind CSS, ensuring a unique brand identity.

---

## 2. Mobile App Development

The mobile application is critical for reaching users on the go, providing
access to funds, and enabling mobile money transactions.

- **Framework:** **Flutter (Version 3.x)**
  - Cross-platform development for Android and iOS from a single codebase.
- **Language:** **Dart**
  - Optimized for fast apps on any platform.
- **State Management:** **Riverpod**
  - A compile-safe, scalable state management solution.
- **Backend Integration:** **Supabase Flutter SDK**
  - Direct integration with Supabase Auth, Database, and Realtime features.
- **Navigation:** **GoRouter**
  - Declarative routing package for deep linking and navigation.
- **UI/UX:** Material Design 3 and Cupertino widgets tailored to match the
  Ratibu brand aesthetics.

---

## 3. Backend & Infrastructure (Backend-as-a-Service)

We are transitioning to a robust BaaS architecture to minimize DevOps overhead
and maximize feature velocity.

- **Platform:** **Supabase** (The open-source Firebase alternative).
- **Database:** **PostgreSQL 15+**
  - The world's most advanced open-source relational database.
  - **pgvector** extension for vector operations (future AI features).
  - **PostGIS** extension for location-based features.
- **Authentication:** **Supabase Auth**
  - Built-in support for Email/Password, Phone (SMS), Google, and Apple Sign-in.
  - Enterprise-grade security with JWT (JSON Web Tokens).
- **API Layer:** **Auto-generated REST API** & **GraphQL**
  - Instant APIs generated directly from the database schema.
- **Realtime:** **Supabase Realtime**
  - Websockets for live updates on transactions, chat, and notifications.
- **Storage:** **Supabase Storage**
  - Scalable object storage for user avatars, verification documents (KYC), and
    media.
- **Serverless Logic:** **Supabase Edge Functions**
  - Deno-based runtime for executing custom backend logic (e.g., M-Pesa
    callbacks, scheduled tasks).

---

## 4. Third-Party Integrations

Essential external services that power core business logic.

- **Payments:** **Safaricom Daraja API (M-Pesa)**
  - **STK Push:** For seamless localized collections.
  - **B2C:** for disbursements to mobile wallets.
- **Video Conferencing:** **Agora.io**
  - Real-time video and voice SDKs for virtual chama meetings.
- **SMS & USSD:** **Africa's Talking**
  - SMS notifications and transactional alerts.
  - USSD gateway for feature phone accessibility.
- **Maps:** **Google Maps Platform** or **Mapbox**
  - Location services for agent finding and branch locators.

---

## 5. DevOps & CI/CD

Tools for version control, testing, and deployment.

- **Version Control:** **Git** (hosted on GitHub/GitLab).
- **Web Hosting:** **Vercel** or **Netlify**
  - Global CDN, automatic SSL, and instant rollbacks.
- **CI/CD Pipelines:** **GitHub Actions**
  - Automated testing, linting (`ESLint`, `Prettier`), and deployment workflows.
- **Environment Management:** `.env` files for managing secrets and
  configuration across environments (Development, Staging, Production).

---

## 6. Security & Compliance

- **Row Level Security (RLS):** Database-level security policies ensuring users
  can only access their own data.
- **Data Encryption:** SSL/TLS for data in transit; AES-256 for data at rest.
- **Compliance:** Designed to meet KYC (Know Your Customer) and AML (Anti-Money
  Laundering) standards.

---

## Summary Diagram

```mermaid
graph TD
    User[User Devices] -->|HTTPS| Web[Web App (React/Vite)]
    User -->|HTTPS| Mobile[Mobile App (Flutter)]

    subgraph "Frontend Layer"
        Web
        Mobile
    end

    subgraph "Backend Services (Supabase)"
        Auth[Auth Service]
        DB[(PostgreSQL DB)]
        Storage[File Storage]
        Realtime[Realtime Subscriptions]
        Edge[Edge Functions (Deno)]
    end

    subgraph "External Integrations"
        Mpesa[M-Pesa API]
        Agora[Agora Video SDK]
        AT[Africa's Talking (SMS/USSD)]
    end

    Web --> Auth
    Web --> DB
    Mobile --> Auth
    Mobile --> DB
    
    Edge --> Mpesa
    Edge --> AT
    Web --> Agora
    Mobile --> Agora
```
