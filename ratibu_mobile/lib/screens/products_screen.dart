import 'package:flutter/material.dart';

class ProductsScreen extends StatelessWidget {
  const ProductsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    const products = <_Product>[
      _Product(
        icon: Icons.account_balance_wallet,
        color: Color(0xFF38BDF8),
        title: 'Digital Wallets',
      ),
      _Product(
        icon: Icons.groups,
        color: Color(0xFF22C55E),
        title: 'Chama OS',
      ),
      _Product(
        icon: Icons.payments,
        color: Color(0xFFF59E0B),
        title: 'Loans & Credit',
      ),
      _Product(
        icon: Icons.swap_horiz,
        color: Color(0xFF8B5CF6),
        title: 'USSD Offline Access',
      ),
      _Product(
        icon: Icons.account_balance,
        color: Color(0xFF10B981),
        title: 'KCB M-PESA',
      ),
      _Product(
        icon: Icons.electrical_services,
        color: Color(0xFFFB923C),
        title: 'KPLC Bill Payments',
      ),
      _Product(
        icon: Icons.repeat,
        color: Color(0xFF94A3B8),
        title: 'Standing Orders',
      ),
      _Product(
        icon: Icons.verified_user,
        color: Color(0xFF06B6D4),
        title: 'Secure Payments',
      ),
    ];

    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      appBar: AppBar(
        title: const Text('Products'),
        backgroundColor: const Color(0xFF1e293b),
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 4),
            ...products.map(
              (product) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _buildProductCard(product),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProductCard(_Product product) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1e293b),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: product.color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(product.icon, color: product.color, size: 28),
          ),
          const SizedBox(height: 16),
          Text(
            product.title,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

class _Product {
  final IconData icon;
  final Color color;
  final String title;

  const _Product({
    required this.icon,
    required this.color,
    required this.title,
  });
}
