import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/notification_helper.dart';

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier();
});

// Simple State Union for Auth
abstract class AuthState {
  T? mapState<T>({
    T Function(AuthStateInitial)? initial,
    T Function(AuthStateLoading)? loading,
    T Function(AuthStateAuthenticated)? authenticated,
    T Function(AuthStateUnauthenticated)? unauthenticated,
    T Function(AuthStateAwaiting2FA)? awaiting2FA,
    T Function(AuthStateError)? error,
  }) {
    if (this is AuthStateInitial) return initial?.call(this as AuthStateInitial);
    if (this is AuthStateLoading) return loading?.call(this as AuthStateLoading);
    if (this is AuthStateAuthenticated) return authenticated?.call(this as AuthStateAuthenticated);
    if (this is AuthStateUnauthenticated) return unauthenticated?.call(this as AuthStateUnauthenticated);
    if (this is AuthStateAwaiting2FA) return awaiting2FA?.call(this as AuthStateAwaiting2FA);
    if (this is AuthStateError) return error?.call(this as AuthStateError);
    return null;
  }
}

class AuthStateInitial extends AuthState {}
class AuthStateLoading extends AuthState {}
class AuthStateAuthenticated extends AuthState {
  final User user;
  final String kycStatus;
  final bool otpVerified;
  final bool legalAccepted;
  AuthStateAuthenticated(
    this.user, {
    this.kycStatus = 'not_started',
    this.otpVerified = false,
    this.legalAccepted = false,
  });
}
class AuthStateUnauthenticated extends AuthState {}
class AuthStateAwaiting2FA extends AuthState {
  final User user;
  final String kycStatus;
  final bool otpVerified;
  final bool legalAccepted;
  AuthStateAwaiting2FA(
    this.user, {
    this.kycStatus = 'not_started',
    this.otpVerified = false,
    this.legalAccepted = false,
  });
}
class AuthStateError extends AuthState {
  final String message;
  AuthStateError(this.message);
}

class AuthNotifier extends StateNotifier<AuthState> {
  final _supabase = Supabase.instance.client;

  AuthNotifier() : super(AuthStateInitial()) {
    _initializeAuth();
  }

  void _initializeAuth() {
    _supabase.auth.onAuthStateChange.listen((data) {
      final session = data.session;
      if (session != null) {
        refreshUser();
      } else {
        state = AuthStateUnauthenticated();
      }
    });

    // Initial check
    refreshUser();
  }

  Future<bool> _isConnected() async {
    final connectivityResult = await Connectivity().checkConnectivity();
    if (connectivityResult.contains(ConnectivityResult.none)) {
      state = AuthStateError('Please connect to the internet.');
      return false;
    }
    return true;
  }

  Future<void> signUp({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    required String phone,
    String? referralCode,
  }) async {
    if (!await _isConnected()) return;
    state = AuthStateLoading();
    try {
      // Pass metadata so the backend trigger can populate the profile correctly
      final AuthResponse res = await _supabase.auth.signUp(
        email: email,
        password: password,
        data: {
          'first_name': firstName,
          'last_name': lastName,
          'full_name': '$firstName $lastName',
          'phone': phone,
          if (referralCode != null && referralCode.trim().isNotEmpty) 'referral_code': referralCode.trim(),
        },
      );
      debugPrint('SignUp response: ${res.user?.id}');

      // If a session is created, keep user authenticated to allow OTP verification
      await refreshUser();

      if (res.user != null) {
        debugPrint('Sending welcome notification for user: ${res.user!.id}');
        NotificationHelper.sendNotification(
          title: 'Welcome to Ratibu!',
          message: 'Your account has been created successfully. Please log in to continue.',
          type: 'success',
          userId: res.user!.id,
        );

        // Send Welcome Email
        NotificationHelper.sendEmail(
          to: email,
          subject: 'Welcome to Ratibu Neobank 🚀',
          html: '''
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h1 style="color: #00C853;">Welcome to Ratibu, $firstName!</h1>
              <p>We're thrilled to have you join our financial community. Ratibu is here to help you manage your Chamas and grow your wealth with ease.</p>
              <p><b>Next Steps:</b></p>
              <ul>
                <li>Log in to your account.</li>
                <li>Complete your KYC profile.</li>
                <li>Join or create your first Chama!</li>
              </ul>
              <p>If you have any questions, simply reply to this email.</p>
              <br>
              <p>Best regards,<br>The Ratibu Team</p>
            </div>
          ''',
        );
      }
    } on AuthException catch (e) {
      debugPrint('AuthException during signUp: ${e.message}');
      state = AuthStateError(e.message);
    } catch (e) {
      debugPrint('Unexpected error during signUp: $e');
      state = AuthStateError('An unexpected error occurred: $e');
    }
  }

  Future<void> signIn({required String email, required String password}) async {
    if (!await _isConnected()) return;
    state = AuthStateLoading();
    try {
      final AuthResponse res = await _supabase.auth.signInWithPassword(
        email: email,
        password: password,
      );
      
      final kycData = await _supabase
          .from('users')
          .select('kyc_status, first_name, last_name, two_factor_enabled, otp_verified_at, terms_accepted_at, privacy_accepted_at')
          .eq('id', res.user!.id)
          .maybeSingle();
      
      // 2FA disabled in mobile security settings
      final is2FAEnabled = false;
      final kycStatus = kycData?['kyc_status'] ?? 'not_started';
      final firstName = kycData?['first_name'] ?? '';
      final fullName = firstName.isNotEmpty ? '$firstName ${kycData?['last_name'] ?? ''}'.trim() : 'Member';
      final prefs = await SharedPreferences.getInstance();
      final localOtpVerified = prefs.getBool('otp_verified_${res.user!.id}') ?? false;
      final otpVerified = kycData?['otp_verified_at'] != null || localOtpVerified;
      final legalAccepted = kycData?['terms_accepted_at'] != null &&
          kycData?['privacy_accepted_at'] != null;

      if (is2FAEnabled) {
        // Trigger 2FA
        await _supabase.functions.invoke('send-otp', body: {
          'email': email,
          'userId': res.user!.id,
          'fullName': fullName,
          'purpose': '2fa',
        });

        state = AuthStateAwaiting2FA(
          res.user!, 
          kycStatus: kycStatus,
          otpVerified: otpVerified,
          legalAccepted: legalAccepted,
        );
      } else {
        state = AuthStateAuthenticated(
          res.user!,
          kycStatus: kycStatus,
          otpVerified: otpVerified,
          legalAccepted: legalAccepted,
        );
      }
      
    } on AuthException catch (e) {
      debugPrint('AuthException during signIn: ${e.message}');
      state = AuthStateError(e.message);
    } catch (e) {
      debugPrint('Unexpected error during signIn: $e');
      state = AuthStateError('Login failed: $e');
    }
  }

  Future<void> verify2FA({required String email, required String code}) async {
    final currentState = state;
    if (currentState is! AuthStateAwaiting2FA) return;
    
    state = AuthStateLoading();
    try {
      final response = await _supabase.functions.invoke('verify-otp', body: {
        'email': email,
        'code': code,
        'purpose': '2fa',
      });

      if (response.status == 200) {
        state = AuthStateAuthenticated(
          currentState.user,
          kycStatus: currentState.kycStatus,
          otpVerified: currentState.otpVerified,
          legalAccepted: currentState.legalAccepted,
        );
        
        NotificationHelper.sendNotification(
          title: 'Welcome back!',
          message: 'You have successfully signed in to your Ratibu account.',
          type: 'success',
          userId: currentState.user.id,
        );
      } else {
        state = AuthStateAwaiting2FA(
          currentState.user,
          kycStatus: currentState.kycStatus,
          otpVerified: currentState.otpVerified,
          legalAccepted: currentState.legalAccepted,
        );
        state = AuthStateError('Invalid or expired security code');
      }
    } catch (e) {
        state = AuthStateAwaiting2FA(
        currentState.user,
        kycStatus: currentState.kycStatus,
        otpVerified: currentState.otpVerified,
        legalAccepted: currentState.legalAccepted,
      );
      state = AuthStateError('Verification failed: $e');
    }
  }

  Future<void> resetPassword({required String email}) async {
    state = AuthStateLoading();
    try {
      await _supabase.auth.resetPasswordForEmail(email);
      state = AuthStateUnauthenticated(); // Return to idle state
    } on AuthException catch (e) {
      state = AuthStateError(e.message);
    } catch (e) {
      state = AuthStateError('Reset failed: $e');
    }
  }

  Future<void> signOut() async {
    await _supabase.auth.signOut();
    state = AuthStateUnauthenticated();
  }

  Future<void> refreshUser() async {
    final user = _supabase.auth.currentUser;
    if (user != null) {
      try {
        final kycData = await _supabase
            .from('users')
            .select('kyc_status, otp_verified_at, terms_accepted_at, privacy_accepted_at')
            .eq('id', user.id)
            .maybeSingle(); // won't throw if row missing
        final prefs = await SharedPreferences.getInstance();
        final localOtpVerified = prefs.getBool('otp_verified_${user.id}') ?? false;
        final otpVerified = kycData?['otp_verified_at'] != null || localOtpVerified;
        final legalAccepted = kycData?['terms_accepted_at'] != null &&
            kycData?['privacy_accepted_at'] != null;
        state = AuthStateAuthenticated(
          user,
          kycStatus: kycData?['kyc_status'] ?? 'not_started',
          otpVerified: otpVerified,
          legalAccepted: legalAccepted,
        );
      } catch (e) {
        debugPrint('Error fetching KYC status: $e');
        state = AuthStateAuthenticated(user); // fallback
      }
    } else {
      state = AuthStateUnauthenticated();
    }
  }
}
