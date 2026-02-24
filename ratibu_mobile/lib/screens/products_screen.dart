import 'package:flutter/material.dart';

class ProductsScreen extends StatelessWidget {
  const ProductsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Our Products'),
        backgroundColor: const Color(0xFF1e293b),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Built for the Next Economy',
              style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 16),
            const Text(
              'Ratibu provides a comprehensive suite of financial tools designed specifically for informal savings groups and modern SMEs.',
              style: TextStyle(fontSize: 16, color: Colors.white70),
            ),
            const SizedBox(height: 32),
            _buildProductCard(
              icon: Icons.account_balance_wallet,
              color: Colors.blue,
              title: 'Digital Wallets',
              description: 'Secure, automated group accounts that hold funds transparently. Every member has real-time visibility into balances.',
            ),
            const SizedBox(height: 16),
            _buildProductCard(
              icon: Icons.group_work,
              color: Colors.green,
              title: 'Chama OS',
              description: 'The complete operating system for investment groups. Automate ledgers, track contributions, and manage multi-signature withdrawals.',
            ),
             const SizedBox(height: 16),
            _buildProductCard(
              icon: Icons.payments,
              color: Colors.purple,
              title: 'Instant Credit',
              description: 'Access low-interest loans collateralized by your group savings. Instant approvals based on your group\'s financial history.',
            ),
             const SizedBox(height: 16),
            _buildProductCard(
              icon: Icons.phone_android,
              color: Colors.orange,
              title: 'USSD Offline Access',
              description: 'No smartphone? No internet? No problem. Access all your Chama features securely via *XXX# on any mobile device.',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProductCard({required IconData icon, required Color color, required String title, required String description}) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: const Color(0xFF1e293b),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
             padding: const EdgeInsets.all(12),
             decoration: BoxDecoration(
               color: color.withOpacity(0.1),
               borderRadius: BorderRadius.circular(12),
             ),
             child: Icon(icon, color: color, size: 28),
           ),
           const SizedBox(height: 16),
           Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
           const SizedBox(height: 8),
           Text(description, style: const TextStyle(fontSize: 14, color: Colors.white70)),
        ],
      )
    );
  }
}
