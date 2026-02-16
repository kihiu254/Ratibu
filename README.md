# Ratibu - Modern Chama Management Platform

**Ratibu** is a comprehensive digital ecosystem designed to empower informal
investment groups (Chamas) with transparency, security, and growth tools. It
bridges the gap between traditional group savings and modern financial
technology.

## 🚀 Features

### for Chamas & Investment Groups

- **Digital Records**: Move away from paper books to secure, cloud-based
  ledgers.
- **Automated Contributions**: Integration with M-Pesa for seamless deposits and
  withdrawals.
- **Meeting Management**: Schedule meetings, track attendance, and record
  minutes globally.
- **Loan Management**: Manage member loans, interest rates, and repayment
  schedules automatically.
- **Transparency**: Every member can see their contributions and group financial
  health in real-time.

### Technology Stack

- **Frontend**: React (Vite), Tailwind CSS, Framer Motion
- **Backend**: Supabase (PostgreSQL, Edge Functions, Auth, Storage)
- **Mobile**: Flutter (iOS & Android)
- **Payments**: Safaricom M-Pesa (Daraja API) with USSD fallbacks.

## 📂 Project Structure

- `pesachama-web-new/` - The web dashboard and landing page (React).
- `pesachama-backend/` - Supabase configurations, Edge Functions
  (`trigger-stk-push`, `ussd-handler`), and SQL migrations.
- `ratibu_mobile/` - The cross-platform mobile application (Flutter).

## 🛠️ Getting Started

### Prerequisites

- Node.js (v18+)
- Flutter SDK
- Supabase CLI
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/kihiu254/Ratibu.git
   cd Ratibu
   ```

2. **Web Dashboard Setup**
   ```bash
   cd pesachama-web-new
   npm install
   npm run dev
   ```

3. **Mobile App Setup**
   ```bash
   cd ratibu_mobile
   flutter pub get
   flutter run
   ```

4. **Backend Setup** Ensure you have Supabase CLI linked to your project.
   ```bash
   cd pesachama-backend
   supabase start
   ```

## 🤝 Contribution

Developed by **GuruCrafts Agency**.

**Developer Contact**: [1kihiupaul@gmail.com](mailto:1kihiupaul@gmail.com)

**Global Support**:

- Email: [ratibumail@gmail.com](mailto:ratibumail@gmail.com)
- Phone: [+254 112 081 866](tel:+254112081866)

## 📄 License

© 2026 Ratibu Ecosystems. All Rights Reserved.
