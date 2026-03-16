import 'package:flutter/material.dart';

class FeaturesScreen extends StatelessWidget {
  const FeaturesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Platform Features'),
        backgroundColor: const Color(0xFF1e293b),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Everything you need.',
              style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 8),
             const Text(
               'Nothing you don\'t.',
               style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Color(0xFF00C853)),
             ),
            const SizedBox(height: 16),
            const Text(
              'A platform architected for resilience, transparency, and effortless group management.',
              style: TextStyle(fontSize: 16, color: Colors.white70),
            ),
            const SizedBox(height: 32),
            _buildFeatureSection(
              title: "Core Banking",
              features: [
                 {'title': 'Real-time Ledgers', 'desc': 'Automated tracking of every cent.', 'icon': Icons.list_alt},
                 {'title': 'M-Pesa Integration', 'desc': 'Instant deposits & withdrawals.', 'icon': Icons.phone_android},
                 {'title': 'Multi-sig Approvals', 'desc': 'N-of-M approvals for all payouts.', 'icon': Icons.verified_user},
              ]
            ),
             const SizedBox(height: 32),
             _buildFeatureSection(
              title: "Analytics & Reporting",
              features: [
                 {'title': 'Automated Statements', 'desc': 'Generate bank-grade PDF reports.', 'icon': Icons.picture_as_pdf},
                 {'title': 'Member Tracking', 'desc': 'Monitor individual contribution rates.', 'icon': Icons.insights},
              ]
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFeatureSection({required String title, required List<Map<String, dynamic>> features}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
         Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
         const SizedBox(height: 16),
         ...features.map((f) => Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF1e293b),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
            ),
            child: Row(
              children: [
                 Container(
                   padding: const EdgeInsets.all(10),
                   decoration: BoxDecoration(
                     color: const Color(0xFF00C853).withValues(alpha: 0.1),
                     borderRadius: BorderRadius.circular(10),
                   ),
                   child: Icon(f['icon'] as IconData, color: const Color(0xFF00C853), size: 20),
                 ),
                 const SizedBox(width: 16),
                 Expanded(
                   child: Column(
                     crossAxisAlignment: CrossAxisAlignment.start,
                     children: [
                       Text(f['title'] as String, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                       const SizedBox(height: 4),
                       Text(f['desc'] as String, style: const TextStyle(fontSize: 13, color: Colors.white70)),
                     ],
                   ),
                 )
              ],
            )
         )),
      ],
    );
  }
}

