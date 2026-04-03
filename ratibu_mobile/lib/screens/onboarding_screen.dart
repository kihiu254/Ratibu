import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;
  bool _isCompleting = false;
  bool _acceptedTerms = false;
  bool _acceptedPrivacy = false;

  final List<OnboardingPage> _pages = [
    OnboardingPage(
      title: 'Save Together',
      description:
          'Join Chamas and save money with your friends and family efficiently.',
      imagePath: 'assets/images/logo_square.png',
      icon: Icons.group_add_outlined,
      color: const Color(0xFF00C853),
    ),
    OnboardingPage(
      title: 'Total Transparency',
      description:
          'Track every contribution and expense with our real-time ledger system.',
      imagePath: 'assets/images/logo_square.png',
      icon: Icons.account_balance_wallet_outlined,
      color: Colors.orange,
    ),
    OnboardingPage(
      title: 'Financial Growth',
      description:
          'Invest your group savings and watch your wealth grow together.',
      imagePath: 'assets/images/logo_square.png',
      icon: Icons.trending_up,
      color: Colors.blue,
    ),
  ];

  Future<void> _completeOnboarding() async {
    if (_isCompleting) return;
    setState(() => _isCompleting = true);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('onboarding_complete', true);
    await prefs.setBool('pending_onboarding', false);

    final session = Supabase.instance.client.auth.currentSession;
    if (!mounted) return;
    if (session == null) {
      context.go('/login');
      return;
    }

    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) {
      context.go('/login');
      return;
    }

    try {
      final profile = await Supabase.instance.client
          .from('users')
          .select(
              'kyc_status, otp_verified_at, terms_accepted_at, privacy_accepted_at')
          .eq('id', user.id)
          .maybeSingle();

      if (!_acceptedTerms || !_acceptedPrivacy) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text(
                  'Please accept the Terms and Conditions and Privacy Policy before continuing.')),
        );
        return;
      }

      if (profile?['terms_accepted_at'] == null ||
          profile?['privacy_accepted_at'] == null) {
        final now = DateTime.now().toIso8601String();
        await Supabase.instance.client.from('users').update({
          'terms_accepted_at': now,
          'privacy_accepted_at': now,
          'updated_at': now,
        }).eq('id', user.id);
        await Supabase.instance.client.auth.updateUser(
          UserAttributes(
            data: {
              'terms_accepted_at': now,
              'privacy_accepted_at': now,
            },
          ),
        );
      }

      final localOtpVerified =
          prefs.getBool('otp_verified_${user.id}') ?? false;
      final otpVerified =
          profile?['otp_verified_at'] != null || localOtpVerified;
      final kycStatus = profile?['kyc_status'] ?? 'not_started';

      if (!mounted) return;
      if (!otpVerified) {
        context.go('/otp-verification?email=${user.email ?? ''}');
      } else if (kycStatus == 'not_started') {
        context.go('/kyc-form');
      } else {
        context.go('/dashboard');
      }
    } catch (_) {
      if (!mounted) return;
      context.go('/dashboard');
    } finally {
      if (mounted) {
        setState(() => _isCompleting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final logoSize = (screenWidth * 0.88).clamp(280.0, 400.0);
    return Scaffold(
      backgroundColor: const Color(0xFF020617), // Midnight background
      body: Stack(
        children: [
          PageView.builder(
            controller: _pageController,
            itemCount: _pages.length,
            onPageChanged: (index) => setState(() => _currentPage = index),
            itemBuilder: (context, index) {
              final page = _pages[index];
              return Padding(
                padding: const EdgeInsets.fromLTRB(28, 32, 28, 188),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Center(
                      child: SizedBox(
                        height: logoSize,
                        width: logoSize,
                        child: Image.asset(
                          page.imagePath,
                          fit: BoxFit.contain,
                        ),
                      ),
                    ),
                    const SizedBox(height: 28),
                    Text(
                      page.title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 20),
                    Text(
                      page.description,
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 16,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              );
            },
          ),
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              top: false,
              child: Container(
                padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      Color(0xE6020617),
                      Color(0xFF020617),
                    ],
                  ),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(
                        _pages.length,
                        (index) => Container(
                          margin: const EdgeInsets.symmetric(horizontal: 4),
                          width: _currentPage == index ? 24 : 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: _currentPage == index
                                ? const Color(0xFF00C853)
                                : Colors.white24,
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.06),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white10),
                      ),
                      child: Column(
                        children: [
                          CheckboxListTile(
                            value: _acceptedTerms,
                            onChanged: (value) =>
                                setState(() => _acceptedTerms = value ?? false),
                            contentPadding: EdgeInsets.zero,
                            controlAffinity: ListTileControlAffinity.leading,
                            activeColor: const Color(0xFF00C853),
                            title: GestureDetector(
                              onTap: () =>
                                  context.push('/legal/Terms%20of%20Service'),
                              child: const Text(
                                  'I accept the Terms and Conditions',
                                  style: TextStyle(color: Colors.white)),
                            ),
                          ),
                          CheckboxListTile(
                            value: _acceptedPrivacy,
                            onChanged: (value) => setState(
                                () => _acceptedPrivacy = value ?? false),
                            contentPadding: EdgeInsets.zero,
                            controlAffinity: ListTileControlAffinity.leading,
                            activeColor: const Color(0xFF00C853),
                            title: GestureDetector(
                              onTap: () =>
                                  context.push('/legal/Privacy%20Policy'),
                              child: const Text('I accept the Privacy Policy',
                                  style: TextStyle(color: Colors.white)),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      height: 56,
                      child: ElevatedButton(
                        onPressed: _currentPage == _pages.length - 1
                            ? (_isCompleting ||
                                    !_acceptedTerms ||
                                    !_acceptedPrivacy
                                ? null
                                : _completeOnboarding)
                            : () => _pageController.nextPage(
                                  duration: const Duration(milliseconds: 300),
                                  curve: Curves.easeInOut,
                                ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF00C853),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                        child: Text(
                          _currentPage == _pages.length - 1
                              ? 'Get Started'
                              : 'Next',
                          style: const TextStyle(
                              fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                    if (_currentPage < _pages.length - 1)
                      TextButton(
                        onPressed: _isCompleting ||
                                !_acceptedTerms ||
                                !_acceptedPrivacy
                            ? null
                            : _completeOnboarding,
                        child: const Text('Skip',
                            style: TextStyle(color: Colors.white54)),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class OnboardingPage {
  final String title;
  final String description;
  final String imagePath;
  final IconData icon;
  final Color color;

  OnboardingPage({
    required this.title,
    required this.description,
    required this.imagePath,
    required this.icon,
    required this.color,
  });
}
