import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
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
    T Function(AuthStateError)? error,
  }) {
    if (this is AuthStateInitial) return initial?.call(this as AuthStateInitial);
    if (this is AuthStateLoading) return loading?.call(this as AuthStateLoading);
    if (this is AuthStateAuthenticated) return authenticated?.call(this as AuthStateAuthenticated);
    if (this is AuthStateUnauthenticated) return unauthenticated?.call(this as AuthStateUnauthenticated);
    if (this is AuthStateError) return error?.call(this as AuthStateError);
    return null;
  }
}

class AuthStateInitial extends AuthState {}
class AuthStateLoading extends AuthState {}
class AuthStateAuthenticated extends AuthState {
  final User user;
  AuthStateAuthenticated(this.user);
}
class AuthStateUnauthenticated extends AuthState {}
class AuthStateError extends AuthState {
  final String message;
  AuthStateError(this.message);
}

class AuthNotifier extends StateNotifier<AuthState> {
  final _supabase = Supabase.instance.client;

  AuthNotifier() : super(AuthStateInitial());

  Future<void> signUp({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    required String phone,
  }) async {
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
        },
      );

      // The backend trigger handle_new_user now handles profile creation in public.users
      // We do NOT need to manually insert here, as it would cause a duplicate key error.
      
      state = AuthStateUnauthenticated(); // Require login after signup

      if (res.user != null) {
         NotificationHelper.sendNotification(
          title: 'Welcome to Ratibu!',
          message: 'Your account has been created successfully. Please log in to continue.',
          type: 'success',
          userId: res.user!.id,
        );
      }
    } on AuthException catch (e) {
      state = AuthStateError(e.message);
    } catch (e) {
      state = AuthStateError('An unexpected error occurred: $e');
    }
  }

  Future<void> signIn({required String email, required String password}) async {
    state = AuthStateLoading();
    try {
      final AuthResponse res = await _supabase.auth.signInWithPassword(
        email: email,
        password: password,
      );
      state = AuthStateAuthenticated(res.user!);
      
      NotificationHelper.sendNotification(
        title: 'Welcome back!',
        message: 'You have successfully signed in to your Ratibu account.',
        type: 'success',
        userId: res.user!.id,
      );
    } on AuthException catch (e) {
      state = AuthStateError(e.message);
    } catch (e) {
      state = AuthStateError('Login failed: $e');
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
      state = AuthStateAuthenticated(user);
    } else {
      state = AuthStateUnauthenticated();
    }
  }
}
