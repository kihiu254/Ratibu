import 'package:flutter/material.dart';
import 'package:pesachama_mobile/theme/ratibu_theme.dart';
import 'package:pesachama_mobile/screens/meeting_screen.dart';

void main() {
  runApp(const PesaChamaApp());
}

class PesaChamaApp extends StatelessWidget {
  const PesaChamaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PesaChama & Ratibu',
      theme: RatibuTheme.light,
      debugShowCheckedModeBanner: false,
      home: const OnboardingScreen(),
    );
  }
}

class OnboardingScreen extends StatelessWidget {
  const OnboardingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 40.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 20),
              Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  color: RatibuTheme.navy,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Center(
                  child: Text(
                    'R',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 48),
              const Text(
                'The Future of\nChama Banking.',
                style: TextStyle(
                  color: RatibuTheme.navy,
                  fontSize: 48,
                  fontWeight: FontWeight.bold,
                  height: 1.1,
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Coordinate, contribute, and disburse smarter. Built for communities that grow together.',
                style: TextStyle(
                  color: RatibuTheme.slate,
                  fontSize: 18,
                  height: 1.5,
                ),
              ),
              const Spacer(),
              ElevatedButton(
                onPressed: () {},
                child: const Text('Join a Chama'),
              ),
              const SizedBox(height: 16),
              OutlinedButton(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const MeetingScreen()),
                  );
                },
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 56),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  side: const BorderSide(color: RatibuTheme.navy, width: 2),
                ),
                child: const Text(
                  'Create Group',
                  style: TextStyle(
                    color: RatibuTheme.navy,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
