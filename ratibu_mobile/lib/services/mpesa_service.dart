import 'dart:io';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter/foundation.dart';

class MpesaService {
  final _supabase = Supabase.instance.client;

  bool _isNetworkError(Object error) {
    final message = error.toString().toLowerCase();
    return error is SocketException ||
        message.contains('failed host lookup') ||
        message.contains('clientexception') ||
        message.contains('socketexception') ||
        message.contains('connection reset by peer') ||
        message.contains('network is unreachable');
  }

  String _friendlyErrorMessage(Object error) {
    if (_isNetworkError(error)) {
      return 'Unable to reach Ratibu servers. Check your internet connection and try again.';
    }
    return error.toString();
  }

  /// Normalizes phone to 254XXXXXXXXX format.
  String _normalizePhone(String phone) {
    final trimmed = phone.replaceAll(RegExp(r'\s+'), '');
    if (RegExp(r'^2547\d{8}$').hasMatch(trimmed)) return trimmed;
    if (RegExp(r'^07\d{8}$').hasMatch(trimmed)) return '254${trimmed.substring(1)}';
    if (RegExp(r'^\+2547\d{8}$').hasMatch(trimmed)) return trimmed.substring(1);
    if (RegExp(r'^01\d{8}$').hasMatch(trimmed)) return '254${trimmed.substring(1)}';
    if (RegExp(r'^2541\d{8}$').hasMatch(trimmed)) return trimmed;
    return trimmed; // let the edge function validate
  }

  Future<void> initiateStkPush({
    required String phoneNumber,
    required double amount,
    required String userId,
    String? chamaId,
    String? savingsTargetId,
    String? destinationType,
    String? mshwariPhone,
  }) async {
    assert(
      chamaId != null || savingsTargetId != null || destinationType == 'mshwari',
      'Provide chamaId, savingsTargetId, or destinationType: mshwari',
    );

    final session = _supabase.auth.currentSession;
    if (session == null) throw 'User not logged in. Cannot initiate STK Push.';

    final normalizedPhone = _normalizePhone(phoneNumber);
    debugPrint('Initiating STK Push — user: $userId, phone: $normalizedPhone');

    final body = <String, dynamic>{
      'amount': amount,
      'phoneNumber': normalizedPhone,
      'userId': userId,
      if (chamaId != null) 'chamaId': chamaId,
      if (savingsTargetId != null) 'savingsTargetId': savingsTargetId,
      if (destinationType != null) 'destinationType': destinationType,
      if (mshwariPhone != null) 'mshwariPhone': _normalizePhone(mshwariPhone),
    };

    debugPrint('STK Push body: $body');

    try {
      final response = await _supabase.functions.invoke(
        'trigger-stk-push',
        body: body,
      );

      if (response.status != 200) {
        throw 'Function returned status ${response.status}: ${response.data}';
      }
    } on FunctionException catch (e) {
      debugPrint('FULL FUNCTION ERROR: $e');
      if (e.details != null) debugPrint('ERROR DETAILS: ${e.details}');
      final msg = (e.details as Map?)?['error'] ?? e.toString();
      throw 'STK Push failed: $msg';
    } catch (e) {
      debugPrint('FULL GENERAL ERROR: $e');
      throw 'STK Push failed: ${_friendlyErrorMessage(e)}';
    }
  }

  Future<Map<String, dynamic>> generateQrCode({
    required double amount,
    required String merchantName,
    required String refNo,
  }) async {
    try {
      final response = await _supabase.functions.invoke(
        'generate-qr-code',
        body: {
          'amount': amount,
          'merchantName': merchantName,
          'refNo': refNo,
          'trxCode': 'PB',
        },
      );
      if (response.status != 200) {
        throw 'Failed to generate QR code: ${response.data}';
      }
      return response.data as Map<String, dynamic>;
    } catch (e) {
      throw 'QR Code generation failed: $e';
    }
  }
}
