import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../providers/auth_provider.dart';
import '../widgets/ratibu_logo.dart';

class OtpVerificationScreen extends ConsumerStatefulWidget {
  final String? email;
  const OtpVerificationScreen({super.key, this.email});

  @override
  ConsumerState<OtpVerificationScreen> createState() => _OtpVerificationScreenState();
}

class _OtpVerificationScreenState extends ConsumerState<OtpVerificationScreen> {
  final List<TextEditingController> _controllers = List.generate(6, (index) => TextEditingController());
  final List<FocusNode> _focusNodes = List.generate(6, (index) => FocusNode());
  bool _isLoading = false;
  String? _sendError;

  Future<void> _signOutToLogin() async {
    try {
      await Supabase.instance.client.auth.signOut();
    } catch (_) {}
    if (mounted) {
      context.go('/login');
    }
  }

  @override
  void initState() {
    super.initState();
    _generateAndSendOtp();
  }

  Future<void> _generateAndSendOtp({bool force = false}) async {
    if (widget.email == null || widget.email!.isEmpty) return;

    setState(() { _isLoading = true; _sendError = null; });
    try {
      final supabase = Supabase.instance.client;
      final user = supabase.auth.currentUser;
      final prefs = await SharedPreferences.getInstance();
      final otpSentKey = 'otp_sent_onboarding_${user?.id ?? widget.email}';

      if (!force) {
        final alreadySentLocal = prefs.getBool(otpSentKey) ?? false;
        if (alreadySentLocal) {
          if (!mounted) return;
          setState(() => _sendError = null);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('A valid code was already sent. Check your email.'),
              backgroundColor: Color(0xFF00C853),
            ),
          );
          return;
        }
      }
      
      if (user != null) {
        final localOtpVerified = prefs.getBool('otp_verified_${user.id}') ?? false;
        if (localOtpVerified) {
          await ref.read(authProvider.notifier).refreshUser();
          if (!mounted) return;
          context.pushReplacement('/kyc-form');
          return;
        }
      }

      String fullName = 'Member';
      if (user != null) {
        final profile = await supabase
            .from('users')
            .select('first_name, last_name, otp_verified_at')
            .eq('id', user.id)
            .maybeSingle();
        if (profile != null) {
          if (profile['otp_verified_at'] != null) {
            await ref.read(authProvider.notifier).refreshUser();
            if (!mounted) return;
            context.pushReplacement('/kyc-form');
            return;
          }
          final first = profile['first_name'] ?? '';
          final last = profile['last_name'] ?? '';
          if (first.isNotEmpty) fullName = '$first $last'.trim();
        }
      }

      final response = await supabase.functions.invoke('send-otp', body: {
        'email': widget.email,
        'userId': user?.id,
        'fullName': fullName,
        'purpose': 'onboarding',
        'force': force,
      });

      debugPrint('send-otp status: ${response.status}, data: ${response.data}');

      if (response.data?['verified'] == true) {
        if (user != null) {
          await prefs.setBool('otp_verified_${user.id}', true);
        }
        await ref.read(authProvider.notifier).refreshUser();
        if (!mounted) return;
        context.pushReplacement('/kyc-form');
        return;
      }

      if (response.status != 200) {
        final errMsg = response.data?['error'] ?? 'Failed to send OTP (status ${response.status})';
        throw Exception(errMsg);
      }
      await prefs.setBool(otpSentKey, true);
      
      if (mounted) {
        final alreadySent = response.data?['alreadySent'] == true;
        setState(() => _sendError = null);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              alreadySent
                  ? 'A valid code was already sent. Check your email.'
                  : '✓ Verification code sent to your email!',
            ),
            backgroundColor: const Color(0xFF00C853),
          ),
        );
      }
    } catch (e) {
      debugPrint('Error sending OTP: $e');
      if (mounted) {
        setState(() => _sendError = e.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    for (var controller in _controllers) {
      controller.dispose();
    }
    for (var node in _focusNodes) {
      node.dispose();
    }
    super.dispose();
  }

  void _onOtpChanged(String value, int index) {
    if (value.length == 1 && index < 5) {
      _focusNodes[index + 1].requestFocus();
    }
    if (value.isEmpty && index > 0) {
      _focusNodes[index - 1].requestFocus();
    }
  }

  Future<void> _verifyOtp() async {
    final otp = _controllers.map((c) => c.text).join();
    if (otp.length < 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter the full 6-digit code')),
      );
      return;
    }

    setState(() => _isLoading = true);
    
    try {
      final supabase = Supabase.instance.client;
      final response = await supabase.functions.invoke('verify-otp', body: {
        'email': widget.email,
        'code': otp,
        'purpose': 'onboarding',
      });

      if (response.status != 200) {
        throw Exception(response.data['error'] ?? 'Verification failed');
      }
      
      final currentUser = supabase.auth.currentUser;
      if (currentUser != null) {
        final verifiedAt = DateTime.now().toIso8601String();
        await supabase
            .from('users')
            .update({'otp_verified_at': verifiedAt, 'updated_at': verifiedAt})
            .eq('id', currentUser.id);
        final prefs = await SharedPreferences.getInstance();
        await prefs.setBool('otp_verified_${currentUser.id}', true);
      }

      await ref.read(authProvider.notifier).refreshUser();
      if (!mounted) return;
      context.pushReplacement('/kyc-form');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Verification failed: ${e.toString()}'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvoked: (didPop) {
        if (!didPop) {
          _signOutToLogin();
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFF020617),
        resizeToAvoidBottomInset: true,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back, color: Colors.white),
            onPressed: _signOutToLogin,
          ),
        ),
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
              const SizedBox(height: 8),
              const Center(child: RatibuLogo(height: 90)),
              const SizedBox(height: 24),
              const Text(
                'Security Verification',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                "We've sent a 6-digit access code to your registered email address",
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 16,
                  color: Colors.white.withValues(alpha: 0.6),
                ),
              ),
              const SizedBox(height: 32),
              // Error banner
              if (_sendError != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, color: Colors.red, size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _sendError!,
                          style: const TextStyle(color: Colors.red, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: List.generate(
                  6,
                  (index) => SizedBox(
                    width: 45,
                    child: TextField(
                      controller: _controllers[index],
                      focusNode: _focusNodes[index],
                      keyboardType: TextInputType.number,
                      textAlign: TextAlign.center,
                      maxLength: 1,
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                      ],
                      decoration: InputDecoration(
                        counterText: '',
                        enabledBorder: OutlineInputBorder(
                          borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderSide: const BorderSide(color: Color(0xFF00C853), width: 2),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        fillColor: Colors.white.withValues(alpha: 0.05),
                        filled: true,
                      ),
                      onChanged: (value) => _onOtpChanged(value, index),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 28),
              ElevatedButton(
                onPressed: _isLoading ? null : _verifyOtp,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF00C853),
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 60),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                  ),
                  disabledBackgroundColor: const Color(0xFF00C853).withValues(alpha: 0.3),
                ),
                child: _isLoading
                    ? const SizedBox(
                        height: 24,
                        width: 24,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : const Text(
                        'VERIFY & PROCEED',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 1.2,
                        ),
                      ),
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    "Didn't receive the code? ",
                    style: TextStyle(color: Colors.white.withValues(alpha: 0.5)),
                  ),
                  TextButton(
                    onPressed: _isLoading ? null : () => _generateAndSendOtp(force: true),
                    child: const Text(
                      'Resend Code',
                      style: TextStyle(
                        color: Color(0xFF00C853),
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

