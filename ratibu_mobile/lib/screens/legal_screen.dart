import 'package:flutter/material.dart';

class LegalScreen extends StatelessWidget {
  final String documentType;

  const LegalScreen({super.key, this.documentType = 'Legal Information'});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(documentType),
        backgroundColor: const Color(0xFF1e293b),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              documentType,
              style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 8),
            const Text(
               'Effective Date: October 1, 2026',
               style: TextStyle(fontSize: 14, color: Colors.white54),
            ),
            const SizedBox(height: 32),
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFF1e293b),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('1. Introduction', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
                  SizedBox(height: 12),
                  Text(
                    'Welcome to Ratibu. These documents represent the legal agreement between Ratibu Ecosystems ("we", "us", or "our") and you, the user. By accessing or using our platform via mobile application, USSD, or web dashboard, you agree to be bound by these policies.',
                    style: TextStyle(fontSize: 14, color: Colors.white70, height: 1.5),
                  ),
                  SizedBox(height: 24),
                  
                  Text('2. Data Protection & Privacy', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
                  SizedBox(height: 12),
                  Text(
                    'We prioritize the security of your financial and personal data. All data is encrypted at rest and in transit using industry-standard protocols. We comply with all relevant local data protection regulations regarding the processing of KYC and group financial data.',
                    style: TextStyle(fontSize: 14, color: Colors.white70, height: 1.5),
                  ),
                  SizedBox(height: 24),
                  
                  Text('3. Financial Compliance', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
                  SizedBox(height: 12),
                  Text(
                    'Ratibu acts as a technology provider for informal savings groups (Chamas) and SMEs. We are not a bank. All funds are held in trust by our licensed banking and mobile money partners. Users are responsible for ensuring their groups operate legally within their respective jurisdictions.',
                    style: TextStyle(fontSize: 14, color: Colors.white70, height: 1.5),
                  ),
                   SizedBox(height: 32),
                  Divider(color: Colors.white10),
                  SizedBox(height: 16),
                  Text('This is a standardized template document. For specific inquiries regarding our legal policies, please contact our legal team at legal@ratibu.com.', style: TextStyle(color: Colors.white54, fontSize: 12, height: 1.5))
                ],
              )
            )
          ],
        ),
      ),
    );
  }
}

