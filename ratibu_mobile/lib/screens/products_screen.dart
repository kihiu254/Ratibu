import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class ProductsScreen extends StatelessWidget {
  const ProductsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    const products = <_Product>[
      _Product(
        icon: Icons.swap_horiz,
        color: Color(0xFF38BDF8),
        title: 'Send Money',
        description: 'Transfer money to other Ratibu members at a very low cost.',
        tag: 'Wallet transfer',
        route: '/wallet',
      ),
      _Product(
        icon: Icons.store,
        color: Color(0xFF22C55E),
        title: 'Vendor Payments',
        description: 'Pay vendors using their till number for products and services.',
        tag: 'Till numbers',
        route: '/marketplace',
      ),
      _Product(
        icon: Icons.radio,
        color: Color(0xFFF59E0B),
        title: 'Agent Products',
        description: 'Agents receive an agent number for onboarding, collections, and support.',
        tag: 'Agent numbers',
        route: '/marketplace',
      ),
      _Product(
        icon: Icons.delivery_dining,
        color: Color(0xFF8B5CF6),
        title: 'Delivery',
        description: 'Riders receive delivery jobs and get paid after completion.',
        tag: 'Rider work',
        route: '/marketplace',
      ),
      _Product(
        icon: Icons.shopping_bag,
        color: Color(0xFF06B6D4),
        title: 'E-commerce',
        description: 'Browse products from approved vendors and complete checkout in Ratibu.',
        tag: 'Product catalog',
        route: '/dashboard',
      ),
      _Product(
        icon: Icons.verified_user,
        color: Color(0xFF14B8A6),
        title: 'Credit Score Access',
        description: 'Vendor, rider, and agent roles are unlocked by credit score and score history.',
        tag: 'Rewards + penalties',
        route: '/marketplace',
      ),
    ];

    const roleRules = <_RoleRule>[
      _RoleRule('Vendor', '600+', 'Get a till number and sell products or services.'),
      _RoleRule('Rider', '650+', 'Receive delivery jobs and rider payouts.'),
      _RoleRule('Agent', '700+', 'Receive an agent number and handle service operations.'),
    ];

    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      appBar: AppBar(
        title: const Text('Products'),
        backgroundColor: const Color(0xFF0f172a),
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        children: [
          const Text(
            'Available products live here, not inside the dashboard.',
            style: TextStyle(
              color: Colors.white,
              fontSize: 26,
              fontWeight: FontWeight.w900,
              height: 1.15,
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'Ratibu users can send money, pay vendors, access agent services, request delivery, and shop from approved sellers. Role access is controlled by rewards and penalty scores.',
            style: TextStyle(color: Colors.white70, fontSize: 15, height: 1.6),
          ),
          const SizedBox(height: 18),
          FilledButton.icon(
            onPressed: () async {
              final session = Supabase.instance.client.auth.currentSession;
              if (!context.mounted) return;
              if (session?.user != null) {
                context.push('/marketplace');
              } else {
                context.go('/login?redirectTo=/marketplace');
              }
            },
            icon: const Icon(Icons.shield),
            label: const Text('Check credit score'),
          ),
          const SizedBox(height: 20),
          const Text(
            'Score rules',
            style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 12),
          ...roleRules.map(
            (rule) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _RoleRuleCard(rule: rule),
            ),
          ),
          const SizedBox(height: 24),
          ...products.map(
            (product) => Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: _ProductCard(
                product: product,
                onTap: () => context.push(product.route),
              ),
            ),
          ),
          const SizedBox(height: 8),
          const _ScorePanel(),
        ],
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  const _ProductCard({required this.product, required this.onTap});

  final _Product product;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(22),
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: const Color(0xFF1e293b),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: product.color.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Icon(product.icon, color: product.color, size: 28),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          product.title,
                          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Colors.white),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          product.tag,
                          style: const TextStyle(color: Colors.white60, fontSize: 12, fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Text(
                product.description,
                style: const TextStyle(color: Colors.white70, height: 1.5),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RoleRuleCard extends StatelessWidget {
  const _RoleRuleCard({required this.rule});

  final _RoleRule rule;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF111827),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(rule.score, style: const TextStyle(color: Color(0xFF00C853), fontSize: 12, fontWeight: FontWeight.w900)),
          const SizedBox(height: 6),
          Text(rule.role, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900)),
          const SizedBox(height: 6),
          Text(rule.description, style: const TextStyle(color: Colors.white60, fontSize: 12, height: 1.5)),
        ],
      ),
    );
  }
}

class _ScorePanel extends StatelessWidget {
  const _ScorePanel();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(0xFF0f172a), Color(0xFF1e293b)]),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('How score works', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900)),
          SizedBox(height: 10),
          Text(
            'Rewards improve your score through good savings, successful payments, referrals, and reliable activity. Penalties reduce it through late repayments, disputes, failed deliveries, and policy violations.',
            style: TextStyle(color: Colors.white70, height: 1.6),
          ),
        ],
      ),
    );
  }
}

class _Product {
  final IconData icon;
  final Color color;
  final String title;
  final String description;
  final String tag;
  final String route;

  const _Product({
    required this.icon,
    required this.color,
    required this.title,
    required this.description,
    required this.tag,
    required this.route,
  });
}

class _RoleRule {
  final String role;
  final String score;
  final String description;

  const _RoleRule(this.role, this.score, this.description);
}
