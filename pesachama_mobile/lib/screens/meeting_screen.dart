import 'package:flutter/material.dart';
import 'package:pesachama_mobile/theme/ratibu_theme.dart';

class MeetingScreen extends StatefulWidget {
  const MeetingScreen({super.key});

  @override
  State<MeetingScreen> createState() => _MeetingScreenState();
}

class _MeetingScreenState extends State<MeetingScreen> {
  bool isPaying = false;
  String? paymentStatus;

  Future<void> _handlePayment() async {
    setState(() {
      isPaying = true;
      paymentStatus = 'Requesting M-Pesa Prompt...';
    });

    // Mocking the payment lifecycle
    await Future.delayed(const Duration(seconds: 2));
    setState(() => paymentStatus = 'PIN Prompt Sent to Phone');
    
    await Future.delayed(const Duration(seconds: 3));
    setState(() => paymentStatus = 'Payment Success! \nKES 5,000 Verified.');
    
    await Future.delayed(const Duration(seconds: 2));
    if (mounted) {
      setState(() {
        isPaying = false;
        paymentStatus = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: RatibuTheme.navy,
      appBar: AppBar(
        title: const Text('Virtual Meeting: Zenith Chama'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Column(
        children: [
          // Virtual Meeting Video Mockup
          Expanded(
            flex: 3,
            child: Container(
              margin: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white10,
                borderRadius: BorderRadius.circular(24),
                image: const DecorationImage(
                  image: NetworkImage('https://images.unsplash.com/photo-1573497620053-ea5300f94f21?auto=format&fit=crop&q=80&w=1000'),
                  fit: BoxFit.cover,
                  opacity: 0.6,
                ),
              ),
              child: Stack(
                children: [
                   Positioned(
                    bottom: 16,
                    left: 16,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.black54,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Text('Sarah Kamau (Speaking)', style: TextStyle(color: Colors.white, fontSize: 12)),
                    ),
                  ),
                  const Center(
                    child: Icon(Icons.videocam, size: 64, color: Colors.white24),
                  ),
                ],
              ),
            ),
          ),
          
          // Contribution Panel
          Expanded(
            flex: 2,
            child: Container(
              width: double.infinity,
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
              ),
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Contribution Goals',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: RatibuTheme.navy),
                  ),
                  const SizedBox(height: 16),
                  
                  if (paymentStatus != null)
                    Container(
                      width: double.infinity,
                      margin: const EdgeInsets.bottom(16),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: RatibuTheme.green.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: RatibuTheme.green.withOpacity(0.2)),
                      ),
                      child: Text(
                        paymentStatus!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: RatibuTheme.green, fontWeight: FontWeight.bold),
                      ),
                    ),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Sarah\'s Disbursement', style: TextStyle(color: RatibuTheme.slate)),
                      const Text('75%', style: TextStyle(fontWeight: FontWeight.bold, color: RatibuTheme.green)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  LinearProgressIndicator(
                    value: 0.75,
                    backgroundColor: Colors.grey[200],
                    valueColor: const AlwaysStoppedAnimation<Color>(RatibuTheme.green),
                    minHeight: 10,
                    borderRadius: BorderRadius.circular(5),
                  ),
                  const Spacer(),
                  
                  ElevatedButton(
                    onPressed: isPaying ? null : _handlePayment,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: RatibuTheme.orange,
                    ),
                    child: isPaying 
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text('Contribute KES 5,000 Now'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
