import 'package:flutter/material.dart';

class OpportunitiesScreen extends StatelessWidget {
  const OpportunitiesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Opportunities'),
        backgroundColor: const Color(0xFF1e293b),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Grow with Ratibu',
              style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 16),
            const Text(
              'Join our ecosystem to empower millions of unbanked and under-banked individuals. We partner with innovators to scale financial inclusion.',
              style: TextStyle(fontSize: 16, color: Colors.white70),
            ),
            const SizedBox(height: 32),
            _buildOpportunityCard(
              icon: Icons.store,
              color: Colors.blue,
              title: 'Agent Partnerships',
              description: 'Become a verified Ratibu agent. Earn commissions by onboarding new Chamas and facilitating cash-in/cash-out transactions.',
            ),
            const SizedBox(height: 16),
            _buildOpportunityCard(
              icon: Icons.code,
              color: Colors.green,
              title: 'Developer APIs',
              description: 'Integrate our core banking rails into your application. Build modern fintech solutions atop our compliant infrastructure.',
            ),
             const SizedBox(height: 16),
            _buildOpportunityCard(
              icon: Icons.account_balance,
              color: Colors.purple,
              title: 'Institutional Investment',
              description: 'Partner with us as a liquidity provider. We channel capital to high-performing SMEs and Chamas with proven track records.',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOpportunityCard({required IconData icon, required Color color, required String title, required String description}) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: const Color(0xFF1e293b),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
             padding: const EdgeInsets.all(12),
             decoration: BoxDecoration(
               color: color.withValues(alpha: 0.1),
               borderRadius: BorderRadius.circular(12),
             ),
             child: Icon(icon, color: color, size: 24),
           ),
           const SizedBox(width: 16),
           Expanded(
             child: Column(
               crossAxisAlignment: CrossAxisAlignment.start,
               children: [
                 Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
                 const SizedBox(height: 8),
                 Text(description, style: const TextStyle(fontSize: 14, color: Colors.white70, height: 1.5)),
               ],
             ),
           )
        ],
      )
    );
  }
}

