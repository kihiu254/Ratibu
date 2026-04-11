import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'security_service.dart';

enum _ApprovalChoice { biometric, pin }

class TransactionPinException implements Exception {
  final String message;
  final bool resetRequired;
  final int attemptsRemaining;

  const TransactionPinException(
    this.message, {
    this.resetRequired = false,
    this.attemptsRemaining = 0,
  });

  @override
  String toString() => message;
}

class _PinActionResult {
  final bool success;
  final bool resetRequired;
  final int attemptsRemaining;

  const _PinActionResult({
    required this.success,
    required this.resetRequired,
    required this.attemptsRemaining,
  });
}

class TransactionAuthorizationService {
  final _supabase = Supabase.instance.client;
  final _biometricService = BiometricService();

  Future<Map<String, dynamic>> _invokeAuth(Map<String, dynamic> body) async {
    Object? lastError;
    for (var i = 0; i < 3; i++) {
      try {
        final response = await _supabase.functions.invoke('transaction-auth', body: body);
        return {
          'status': response.status,
          'data': response.data,
        };
      } catch (e) {
        lastError = e;
        final message = e.toString().toLowerCase();
        if (i == 2 ||
            !(e is SocketException ||
                message.contains('connection reset by peer') ||
                message.contains('clientexception') ||
                message.contains('socketexception'))) {
          rethrow;
        }
        await Future<void>.delayed(Duration(milliseconds: 300 * (i + 1)));
      }
    }
    throw lastError ?? Exception('Request failed');
  }

  Future<bool> confirmTransaction(
    BuildContext context, {
    required String actionLabel,
    required double amount,
  }) async {
    final status = await _getPinStatus();
    if (!context.mounted) return false;

    if (status.resetRequired) {
      await _showPinResetRequiredDialog(context);
      return false;
    }

    if (status.needsSetup) {
      final created = await _promptSetPin(
        context,
        actionLabel: actionLabel,
        amount: amount,
      );
      if (!created) return false;
      return true;
    }

    final prefs = await SharedPreferences.getInstance();
    if (!context.mounted) return false;
    final biometricsEnabled = prefs.getBool('biometrics_enabled') ?? false;
    final biometricAvailable = await _biometricService.isBiometricAvailable();
    if (!context.mounted) return false;

    if (biometricsEnabled && biometricAvailable) {
      final choice = await showDialog<_ApprovalChoice>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          backgroundColor: const Color(0xFF1e293b),
          title: const Text('Confirm Transaction', style: TextStyle(color: Colors.white)),
          content: const Text(
            'Approve this action with biometrics or enter your transaction PIN.',
            style: TextStyle(color: Colors.white70),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, _ApprovalChoice.pin),
              child: const Text('Use PIN', style: TextStyle(color: Color(0xFF00C853))),
            ),
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, _ApprovalChoice.biometric),
              child: const Text('Use Biometrics', style: TextStyle(color: Color(0xFF00C853))),
            ),
          ],
        ),
      );

      if (choice == _ApprovalChoice.biometric) {
        return await _biometricService.authenticate();
      }
      if (choice == _ApprovalChoice.pin) {
        if (!context.mounted) return false;
        return await _promptAndVerifyPin(
          context,
          actionLabel: actionLabel,
          amount: amount,
        );
      }
      return false;
    }

    if (!context.mounted) return false;
    return await _promptAndVerifyPin(
      context,
      actionLabel: actionLabel,
      amount: amount,
    );
  }

  Future<bool> _promptAndVerifyPin(
    BuildContext context, {
    required String actionLabel,
    required double amount,
  }) async {
    final pin = await showDialog<String>(
      context: context,
      builder: (dialogContext) {
        final pinController = TextEditingController();
        return AlertDialog(
          backgroundColor: const Color(0xFF1e293b),
          title: const Text('Enter Transaction PIN', style: TextStyle(color: Colors.white)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Confirm $actionLabel of KES ${amount.toStringAsFixed(0)}.',
                style: const TextStyle(color: Colors.white70),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: pinController,
                obscureText: true,
                keyboardType: TextInputType.number,
                maxLength: 6,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(
                  hintText: '4-6 digit PIN',
                  hintStyle: TextStyle(color: Colors.white54),
                  counterText: '',
                  enabledBorder: UnderlineInputBorder(
                    borderSide: BorderSide(color: Colors.white24),
                  ),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Cancel', style: TextStyle(color: Colors.white54)),
            ),
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, pinController.text.trim()),
              child: const Text('Verify', style: TextStyle(color: Color(0xFF00C853))),
            ),
          ],
        );
      },
    );

    if (pin == null || pin.isEmpty) return false;
    return await _verifyPin(context, pin);
  }

  Future<bool> _promptSetPin(
    BuildContext context, {
    required String actionLabel,
    required double amount,
    bool isReset = false,
  }) async {
    final pin = await showDialog<String>(
      context: context,
      builder: (dialogContext) {
        final pinController = TextEditingController();
        final confirmController = TextEditingController();
        return AlertDialog(
          backgroundColor: const Color(0xFF1e293b),
          title: Text(
            isReset ? 'Reset Transaction PIN' : 'Create Transaction PIN',
            style: const TextStyle(color: Colors.white),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Create a PIN to approve deposits and withdrawals.',
                style: TextStyle(color: Colors.white70),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: pinController,
                obscureText: true,
                keyboardType: TextInputType.number,
                maxLength: 6,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(
                  hintText: 'New PIN',
                  hintStyle: TextStyle(color: Colors.white54),
                  counterText: '',
                  enabledBorder: UnderlineInputBorder(
                    borderSide: BorderSide(color: Colors.white24),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: confirmController,
                obscureText: true,
                keyboardType: TextInputType.number,
                maxLength: 6,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(
                  hintText: 'Confirm PIN',
                  hintStyle: TextStyle(color: Colors.white54),
                  counterText: '',
                  enabledBorder: UnderlineInputBorder(
                    borderSide: BorderSide(color: Colors.white24),
                  ),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Cancel', style: TextStyle(color: Colors.white54)),
            ),
            TextButton(
              onPressed: () {
                final firstPin = pinController.text.trim();
                final secondPin = confirmController.text.trim();
                if (firstPin != secondPin || firstPin.length < 4 || firstPin.length > 6) {
                  Navigator.pop(dialogContext, '');
                  return;
                }
                Navigator.pop(dialogContext, firstPin);
              },
              child: const Text('Save PIN', style: TextStyle(color: Color(0xFF00C853))),
            ),
          ],
        );
      },
    );

    if (pin == null || pin.isEmpty) return false;

    final result = await _setOrResetPin(pin, reset: isReset);
    if (!result.success) {
      throw 'Failed to ${isReset ? 'reset' : 'create'} transaction PIN';
    }
    return true;
  }

  Future<bool> _verifyPin(BuildContext context, String pin) async {
    final result = await _invokeAuth({'action': 'verify', 'pin': pin});
    final response = result['data'] as Map<String, dynamic>;
    final status = result['status'] as int;
    if (status == 200 && response['success'] == true) {
      return true;
    }

    if (response['needsSetup'] == true) {
      return false;
    }

    final attemptsRemaining = (response['attemptsRemaining'] as num?)?.toInt() ?? 0;
    final resetRequired = status == 423 || response['resetRequired'] == true || attemptsRemaining <= 0;
    await _showPinErrorDialog(
      context,
      resetRequired: resetRequired,
      attemptsRemaining: attemptsRemaining,
    );
    return false;
  }

  Future<_PinStatus> _getPinStatus() async {
    final result = await _invokeAuth({'action': 'status'});
    final response = result['data'] as Map<String, dynamic>;
    final status = result['status'] as int;
    if (status != 200) {
      throw 'Failed to check transaction PIN status';
    }
    return _PinStatus(
      enabled: response['enabled'] == true,
      needsSetup: response['needsSetup'] == true,
      resetRequired: response['resetRequired'] == true,
      attemptsRemaining: (response['attemptsRemaining'] as num?)?.toInt() ?? 0,
    );
  }

  Future<bool> resetTransactionPin(BuildContext context) async {
    return await _promptSetPin(
      context,
      actionLabel: 'reset',
      amount: 0,
      isReset: true,
    );
  }

  Future<_PinActionResult> _setOrResetPin(String pin, {required bool reset}) async {
    final result = await _invokeAuth({'action': reset ? 'reset' : 'set', 'pin': pin});
    final response = result['data'] as Map<String, dynamic>;
    final status = result['status'] as int;
    if (status != 200) {
      throw 'Failed to ${reset ? 'reset' : 'create'} transaction PIN';
    }
    return _PinActionResult(
      success: response['success'] == true,
      resetRequired: response['reset'] == true,
      attemptsRemaining: (response['attemptsRemaining'] as num?)?.toInt() ?? 0,
    );
  }

  Future<void> _showPinErrorDialog(
    BuildContext context, {
    required bool resetRequired,
    required int attemptsRemaining,
  }) async {
    if (!context.mounted) return;

    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: const Color(0xFF1e293b),
        title: const Text('Transaction PIN', style: TextStyle(color: Colors.white)),
        content: Text(
          resetRequired
              ? 'Your transaction PIN has been locked after 3 failed attempts. Reset it from Profile to continue.'
              : 'Wrong PIN. ${attemptsRemaining > 0 ? '$attemptsRemaining attempt${attemptsRemaining == 1 ? '' : 's'} left.' : 'Please try again.'}',
          style: const TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Close', style: TextStyle(color: Colors.white54)),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(dialogContext);
              if (!context.mounted) return;
              context.push('/profile');
            },
            child: const Text('Reset PIN', style: TextStyle(color: Color(0xFF00C853))),
          ),
        ],
      ),
    );
  }

  Future<void> _showPinResetRequiredDialog(BuildContext context) async {
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: const Color(0xFF1e293b),
        title: const Text('Reset Required', style: TextStyle(color: Colors.white)),
        content: const Text(
          'Your transaction PIN is locked. Reset it in Profile to continue.',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Close', style: TextStyle(color: Colors.white54)),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(dialogContext);
              if (!context.mounted) return;
              context.push('/profile');
            },
            child: const Text('Go to Profile', style: TextStyle(color: Color(0xFF00C853))),
          ),
        ],
      ),
    );
  }
}

class _PinStatus {
  final bool enabled;
  final bool needsSetup;
  final bool resetRequired;
  final int attemptsRemaining;

  const _PinStatus({
    required this.enabled,
    required this.needsSetup,
    required this.resetRequired,
    required this.attemptsRemaining,
  });
}
