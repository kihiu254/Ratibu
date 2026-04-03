import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'dart:async';

class ProcessingScreen extends StatefulWidget {
  const ProcessingScreen({super.key});

  @override
  State<ProcessingScreen> createState() => _ProcessingScreenState();
}

class _ProcessingScreenState extends State<ProcessingScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  String _statusMessage = 'Starting Ratibu...';

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeIn),
    );
    _controller.forward();

    // Sequence of messages
    _startSequence();
  }

  void _startSequence() async {
    await Future.delayed(const Duration(seconds: 2));
    if (mounted) setState(() => _statusMessage = 'Checking your session...');

    // Check if there is an active Supabase session
    final session = Supabase.instance.client.auth.currentSession;

    await Future.delayed(const Duration(seconds: 1));
    if (mounted) setState(() => _statusMessage = 'Ready to go!');
    await Future.delayed(const Duration(milliseconds: 800));

    if (!mounted) return;

    final prefs = await SharedPreferences.getInstance();
    final pendingOnboarding = prefs.getBool('pending_onboarding') ?? false;
    final onboardingComplete = prefs.getBool('onboarding_complete') ?? false;
    if (!mounted) return;

    if (pendingOnboarding) {
      if (session != null) {
        context.go('/onboarding');
      } else {
        context.go('/login');
      }
      return;
    }

    if (!onboardingComplete) {
      context.go('/onboarding');
      return;
    }

    if (session != null) {
      // Already logged in — router will handle KYC redirect
      context.go('/dashboard');
    } else {
      context.go('/login');
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final logoSize = (screenWidth * 0.82).clamp(280.0, 380.0);
    return Scaffold(
      backgroundColor: const Color(0xFF020617),
      body: FadeTransition(
        opacity: _fadeAnimation,
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Hero(
                tag: 'app_logo',
                child: SizedBox(
                  height: logoSize,
                  width: logoSize,
                  child: const Image(
                    image: AssetImage('assets/images/logo_square.png'),
                    fit: BoxFit.contain,
                  ),
                ),
              ),
              const SizedBox(height: 48),
              const SizedBox(
                width: 40,
                height: 40,
                child: CircularProgressIndicator(
                  color: Color(0xFF00C853),
                  strokeWidth: 3,
                ),
              ),
              const SizedBox(height: 32),
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 500),
                child: Text(
                  _statusMessage,
                  key: ValueKey(_statusMessage),
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 0.5,
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
