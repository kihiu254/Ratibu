import 'package:flutter/material.dart';

class LegalScreen extends StatelessWidget {
  final String documentType;

  const LegalScreen({super.key, this.documentType = 'Legal Information'});

  @override
  Widget build(BuildContext context) {
    final sections = <_LegalSection>[
      const _LegalSection(
        'What Ratibu Is',
        'Ratibu is a financial and group-operations platform for chamas, wallet transfers, savings, loans, marketplace roles, delivery workflows, rewards, penalties, and meeting coordination through web, mobile, and USSD.',
      ),
      const _LegalSection(
        'What Ratibu Is Not',
        'Ratibu is a technology platform, not a bank, not a mobile money issuer, and not a licensed deposit-taker. Where funds move through third parties, those third parties operate under their own terms, settlement timelines, outages, limits, and compliance requirements.',
      ),
      const _LegalSection(
        'Accounts, Identity, and Security',
        'You are responsible for the accuracy of your account details, phone number, KYC information, and device access. Protect your password, PINs, SIM, recovery methods, and OTP codes. We may suspend access where activity looks fraudulent, unsafe, or inconsistent with our rules.',
      ),
      const _LegalSection(
        'Chamas and Group Activity',
        'Chama records, contributions, withdrawals, votes, roles, swaps, meeting attendance, and governance actions are recorded to support transparency. Group admins, treasurers, secretaries, and members may have different permissions. Chama rules, contribution cycles, penalties, and approvals may be configured by the group and by Ratibu policy.',
      ),
      const _LegalSection(
        'Wallets and Transfers',
        'Wallet balances, internal transfers, savings movements, and cash-out actions may be subject to validation, score thresholds, available funds, fraud checks, settlement windows, and service availability. Some transfers are internal ledger movements, while others may rely on payment rails operated by third parties such as Safaricom M-PESA/Daraja or banking partners.',
      ),
      const _LegalSection(
        'Loans and Credit Decisions',
        'Loan products may include Chama Booster, Business Loan, and Personal Loan. Eligibility, limits, pricing, approval, and disbursement may depend on savings history, chama participation, vendor status, credit score, repayment behavior, and risk rules. Ratibu may change or pause credit offers, and approval is not guaranteed.',
      ),
      const _LegalSection(
        'Credit Score, Rewards, and Penalties',
        'Ratibu may calculate a credit score using savings history, contribution discipline, repayment behavior, role activity, meeting participation, penalties, reversals, and other platform signals. Rewards may improve your standing, while penalties, reversals, missed obligations, or risky activity may reduce it. Score-based eligibility is operational and may change over time.',
      ),
      const _LegalSection(
        'Marketplace, Roles, and Delivery',
        'Vendor, agent, and rider roles may require approval and may depend on your chama participation, score, and identity checks. Marketplace tools may include vendor payments, delivery requests, e-commerce flows, till/paybill connections, and role-based commissions. Delivery and merchant operations may involve third-party logistics, telecom, and payment providers.',
      ),
      const _LegalSection(
        'Meetings and Third-Party Tools',
        'Ratibu may link to external meeting tools such as Google Meet or similar services. If a meeting is hosted by a third-party provider, their availability and privacy terms apply in addition to Ratibu rules. Meeting links are user-visible and may be shared inside the chama context only as allowed by the group.',
      ),
      const _LegalSection(
        'USSD Usage',
        'USSD is a short, session-based channel intended for quick actions such as balances, joins, deposits, withdrawals, requests, and summaries. Because USSD is limited, long forms, file uploads, deep histories, and detailed dashboards may only be available on web or mobile.',
      ),
      const _LegalSection(
        'Data Use and Sharing',
        'We may collect account details, KYC data, phone numbers, device identifiers, transaction history, chama activity, role data, support requests, and usage logs. We may share data with service providers that help us run payments, hosting, analytics, notifications, identity checks, fraud controls, and meeting or communication services, as permitted by law and our policies.',
      ),
      const _LegalSection(
        'Risks, Limits, and Availability',
        'Financial services can fail because of network issues, third-party outages, invalid account details, wrong numbers, fraud controls, rate limits, or maintenance windows. Ratibu may apply transaction limits, review holds, reversal checks, and manual approval steps where needed.',
      ),
      const _LegalSection(
        'Fraud, Abuse, and Suspension',
        'We may monitor for suspicious activity, repeated failed requests, account takeover, policy abuse, fake identities, duplicate accounts, chargebacks, unauthorized chamas, or other risky behavior. We may delay, decline, reverse, or suspend actions to protect users, groups, and the platform.',
      ),
      const _LegalSection(
        'Disputes and Support',
        'We encourage users to resolve disputes first through the chama or support channel. Where needed, Ratibu may review logs, transaction records, role changes, and audit trails. Final outcomes may depend on evidence, third-party confirmation, and applicable law.',
      ),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(documentType),
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
                  'Ratibu Legal',
                  style: TextStyle(
                    color: Color(0xFF00C853),
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.6,
                  ),
                ),
                const SizedBox(height: 10),
                const Text(
                  'Transparent service terms for Ratibu Chamas, wallet transfers, loans, marketplace roles, USSD, meeting links, and third-party providers.',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 18,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 20),
                const _SummaryCard(
                  title: 'Effective date',
                  value: 'April 20, 2026',
                ),
                const SizedBox(height: 12),
                const _SummaryCard(
                  title: 'Version',
                  value: 'Ratibu transparency draft',
                ),
                const SizedBox(height: 24),
                ...sections.map(
                  (section) => Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Container(
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: const Color(0xFF111827),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                      ),
                      padding: const EdgeInsets.all(18),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            section.title,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            section.body,
                            style: const TextStyle(
                              color: Colors.white70,
                              height: 1.6,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'We may update these notices as Ratibu products, legal obligations, and third-party services change. Continued use after an update means the updated terms may apply. For questions, complaints, or disputes, use the support channel shown inside the app or contact the Ratibu team through the official business channels in the product.',
                  style: TextStyle(color: Colors.white70, height: 1.6),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final String title;
  final String value;

  const _SummaryCard({required this.title, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: const Color(0xFF111827),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: Colors.white60,
              fontSize: 12,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 17,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _LegalSection {
  final String title;
  final String body;

  const _LegalSection(this.title, this.body);
}
