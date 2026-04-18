import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class KcbMpesaScreen extends StatelessWidget {
  const KcbMpesaScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      appBar: AppBar(
        title: const Text('KCB M-PESA'),
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _HeroCard(
              title: 'KCB M-PESA',
              subtitle: 'Savings and loans built for M-PESA customers.',
              description:
                  'KCB M-PESA combines short-term loans with savings tools so members can manage cash flow from the same mobile app.',
            ),
            const SizedBox(height: 20),
            const Text(
              'What you can do here',
              style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            _ActionCard(
              icon: Icons.savings,
              title: 'KCB M-PESA savings',
              subtitle: 'Track savings and move money with the same Ratibu transaction PIN.',
              onTap: () => context.push('/personal-savings'),
            ),
            const SizedBox(height: 12),
            _ActionCard(
              icon: Icons.payments,
              title: 'Loans & Credit',
              subtitle: 'Open the loan hub to review active and historical loans.',
              onTap: () => context.push('/loans'),
            ),
            const SizedBox(height: 12),
            _ActionCard(
              icon: Icons.payments,
              title: 'Pay KPLC electricity',
              subtitle: 'Buy tokens or pay a postpaid electricity bill from the same flow.',
              onTap: () => context.push('/kplc-bill?type=prepaid'),
            ),
            const SizedBox(height: 12),
            _ActionCard(
              icon: Icons.receipt_long,
              title: 'Postpaid electricity bill',
              subtitle: 'Pay an existing KPLC bill using the same STK prompt.',
              onTap: () => context.push('/kplc-bill?type=postpaid'),
            ),
            const SizedBox(height: 24),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF1e293b),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white10),
              ),
              child: const Text(
                'This screen is the launch point. The actual payment still uses the same M-Pesa STK and transaction PIN flow as deposits and withdrawals.',
                style: TextStyle(color: Colors.white70, fontSize: 13, height: 1.5),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeroCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final String description;

  const _HeroCard({
    required this.title,
    required this.subtitle,
    required this.description,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1e3a8a), Color(0xFF0f172a)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFF60a5fa).withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.account_balance, color: Color(0xFF60a5fa), size: 34),
          const SizedBox(height: 14),
          Text(title, style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          Text(subtitle, style: const TextStyle(color: Colors.white70, fontSize: 15)),
          const SizedBox(height: 12),
          Text(description, style: const TextStyle(color: Colors.white60, fontSize: 13, height: 1.5)),
        ],
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _ActionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF1e293b),
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF00C853).withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: const Color(0xFF00C853)),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    Text(subtitle, style: const TextStyle(color: Colors.white60, fontSize: 12)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: Colors.white38),
            ],
          ),
        ),
      ),
    );
  }
}
