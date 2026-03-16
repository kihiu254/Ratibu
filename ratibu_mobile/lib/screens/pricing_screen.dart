import 'package:flutter/material.dart';

class PricingScreen extends StatelessWidget {
  const PricingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Transparent Pricing'),
        backgroundColor: const Color(0xFF1e293b),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Simple, transparent pricing.',
              style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 16),
            const Text(
              'No hidden fees. Choose the tier that fits your group\'s ambitions.',
              style: TextStyle(fontSize: 16, color: Colors.white70),
            ),
            const SizedBox(height: 32),
            _buildPricingCard(
              title: 'Basic Chama',
              price: 'Free',
              description: 'Perfect for small family and friends savings groups.',
              features: ['Up to 15 members', 'Basic ledger tracking', 'USSD Access'],
              isPopular: false,
            ),
            const SizedBox(height: 24),
            _buildPricingCard(
              title: 'Pro Sacco',
              price: 'KES 1,500',
              period: '/month',
              description: 'Advanced tools for growing investment groups and SACCOs.',
              features: ['Unlimited members', 'Advanced automated ledgers', 'Full USSD & App Access', 'Automated M-Pesa collections'],
              isPopular: true,
            ),
             const SizedBox(height: 24),
            _buildPricingCard(
              title: 'Enterprise API',
              price: 'Custom',
              description: 'Tailored infrastructure for fintechs and large institutions.',
              features: ['Everything in Pro Sacco', 'Full White-labeling', 'Dedicated Account Manager', 'Custom API Integrations'],
              isPopular: false,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPricingCard({
    required String title,
    required String price,
    String? period,
    required String description,
    required List<String> features,
    required bool isPopular,
  }) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: isPopular ? const Color(0xFF00C853).withValues(alpha: 0.1) : const Color(0xFF1e293b),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isPopular ? const Color(0xFF00C853) : Colors.white.withValues(alpha: 0.05),
          width: isPopular ? 2 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (isPopular)
             Container(
               margin: const EdgeInsets.only(bottom: 16),
               padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
               decoration: BoxDecoration(
                 color: const Color(0xFF00C853),
                 borderRadius: BorderRadius.circular(20),
               ),
               child: const Text('Most Popular', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
             ),
          Text(title, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white)),
          const SizedBox(height: 8),
          Text(description, style: const TextStyle(fontSize: 14, color: Colors.white70)),
          const SizedBox(height: 24),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(price, style: const TextStyle(fontSize: 36, fontWeight: FontWeight.w900, color: Colors.white)),
              if (period != null)
                Text(period, style: const TextStyle(fontSize: 16, color: Colors.white54)),
            ],
          ),
          const SizedBox(height: 24),
          const Divider(color: Colors.white10),
          const SizedBox(height: 24),
          ...features.map((f) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              children: [
                const Icon(Icons.check_circle, color: Color(0xFF00C853), size: 20),
                const SizedBox(width: 12),
                Expanded(child: Text(f, style: const TextStyle(color: Colors.white, fontSize: 14))),
              ],
            ),
          )),
        ],
      )
    );
  }
}

