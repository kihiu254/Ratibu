import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class ConsentScreen extends StatefulWidget {
  const ConsentScreen({super.key});

  @override
  State<ConsentScreen> createState() => _ConsentScreenState();
}

class _ConsentScreenState extends State<ConsentScreen> {
  bool _understood = false;

  @override
  Widget build(BuildContext context) {
    final points = <String>[
      'Ratibu uses wallet, chama, loans, marketplace, USSD, and meeting features that may rely on third-party providers.',
      'Your credit score, rewards, penalties, and eligibility can change based on behavior, repayment, and group participation.',
      'Loans, vendor roles, agent roles, rider roles, and transaction approvals are not guaranteed and may require review.',
      'Payments, settlement, and meeting links can be delayed or interrupted by network, partner, or device issues.',
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Consent'),
        backgroundColor: const Color(0xFF1e293b),
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF0f172a), Color(0xFF111827)],
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Review before you continue',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 30,
                    fontWeight: FontWeight.w800,
                    height: 1.2,
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'This summary explains the key things you are agreeing to when you use Ratibu. It is not a replacement for the full legal page.',
                  style: TextStyle(color: Colors.white70, height: 1.6),
                ),
                const SizedBox(height: 24),
                ...points.map(
                  (point) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Container(
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: const Color(0xFF111827),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                      ),
                      padding: const EdgeInsets.all(16),
                      child: Text(
                        point,
                        style: const TextStyle(color: Colors.white70, height: 1.6),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'By continuing, you confirm that you have read the full legal page and understand how Ratibu works. You also confirm that you understand payment and loan activity may be reviewed for risk and compliance. If you do not agree, do not continue and contact support before creating or using an account.',
                  style: TextStyle(color: Colors.white70, height: 1.6),
                ),
                const SizedBox(height: 16),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  activeColor: const Color(0xFF00C853),
                  controlAffinity: ListTileControlAffinity.leading,
                  value: _understood,
                  onChanged: (next) => setState(() => _understood = next ?? false),
                  title: const Text(
                    'I have read the consent summary and understand I must accept the full terms before using Ratibu.',
                    style: TextStyle(color: Colors.white70),
                  ),
                ),
                const SizedBox(height: 20),
                Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    OutlinedButton(
                      onPressed: () => context.go('/legal/terms'),
                      child: const Text('Read full legal page'),
                    ),
                    ElevatedButton(
                      onPressed: _understood ? () => context.go('/register') : null,
                      child: const Text('Continue to Register'),
                    ),
                    ElevatedButton(
                      onPressed: _understood ? () => context.go('/login') : null,
                      child: const Text('Continue to Login'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
