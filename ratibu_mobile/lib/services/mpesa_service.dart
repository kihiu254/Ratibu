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

  bool _isMissingEdgeFunctionError(Object error) {
    final message = error.toString().toLowerCase();
    if (message.contains('requested function was not found')) return true;
    if (message.contains('not_found')) return true;
    if (message.contains('functionexception(status: 404')) return true;
    if (error is FunctionException) {
      final details = error.details;
      if (error.status == 404) return true;
      if (details is Map) {
        final code = details['code']?.toString().toUpperCase();
        if (code == 'NOT_FOUND') return true;
      }
    }
    return false;
  }

  bool _isMissingKcbConfigError(Object error) {
    final message = error.toString().toLowerCase();
    return message.contains('missing kcb buni credentials') ||
        message.contains('kcb buni not configured') ||
        message.contains('kcb gateway is not configured') ||
        message.contains('kcb_buni_not_configured');
  }

  Future<Map<String, dynamic>> _invokeKcbGateway({
    required String action,
    required Map<String, dynamic> payload,
  }) async {
    final response = await _supabase.functions.invoke(
      'kcb-vending-gateway',
      body: {
        'action': action,
        'payload': payload,
      },
    );

    if (response.status != 200) {
      throw 'KCB gateway request failed: ${response.data}';
    }

    final data = response.data;
    if (data is Map<String, dynamic>) return data;
    return {'raw': data};
  }

  Future<Map<String, dynamic>> debugKcbGateway({
    required String action,
    required Map<String, dynamic> payload,
  }) {
    return _invokeKcbGateway(action: action, payload: payload);
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
    String? billerCode,
    String? billAccountReference,
    String? billName,
  }) async {
    assert(
      chamaId != null ||
          savingsTargetId != null ||
          destinationType == 'mshwari' ||
          destinationType == 'bill_payment',
      'Provide chamaId, savingsTargetId, or destinationType: mshwari/bill_payment',
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
      if (billerCode != null) 'billerCode': billerCode,
      if (billAccountReference != null) 'billAccountReference': billAccountReference,
      if (billAccountReference != null) 'accountReference': billAccountReference,
      if (billName != null) 'billName': billName,
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

  Future<void> initiateBillPayment({
    required String phoneNumber,
    required double amount,
    required String userId,
    required String billerCode,
    required String accountReference,
    required String billName,
  }) async {
    try {
      await _invokeKcbGateway(
        action: 'validate-request',
        payload: {
          'billerCode': billerCode,
          'accountReference': accountReference,
          'amount': amount,
          'phoneNumber': _normalizePhone(phoneNumber),
          'billName': billName,
          'transactionType': 'bill_payment',
          'source': 'ratibu_mobile',
        },
      );
    } on FunctionException catch (e) {
      if (_isMissingEdgeFunctionError(e) || _isMissingKcbConfigError(e)) {
        debugPrint('KCB vending gateway is not deployed yet. Continuing with STK push for bill payment.');
      } else {
        final msg = (e.details as Map?)?['error'] ?? e.toString();
        throw 'KCB vending validation failed: $msg';
      }
    } catch (e) {
      if (_isMissingEdgeFunctionError(e) || _isMissingKcbConfigError(e)) {
        debugPrint('KCB vending gateway is not deployed yet. Continuing with STK push for bill payment.');
      } else {
        final msg = _friendlyErrorMessage(e);
        throw 'KCB vending validation failed: $msg';
      }
    }

    await initiateStkPush(
      phoneNumber: phoneNumber,
      amount: amount,
      userId: userId,
      destinationType: 'bill_payment',
      billerCode: billerCode,
      billAccountReference: accountReference,
      billName: billName,
    );
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

  Future<Map<String, dynamic>> previewKcbPurchase({
    required String phoneNumber,
    required double amount,
    required String billerCode,
    required String accountReference,
    required String billName,
    String? transactionReference,
    String? narration,
  }) async {
    return _invokeKcbGateway(
      action: 'vendor-confirmation',
      payload: {
        'billerCode': billerCode,
        'accountReference': accountReference,
        'transactionAmount': amount.toString(),
        'chargeFees': '0',
        'transactionReference': transactionReference ?? DateTime.now().microsecondsSinceEpoch.toString(),
        'billReference': accountReference,
        'narration': narration ?? billName,
        'phoneNumber': _normalizePhone(phoneNumber),
        'billName': billName,
        'transactionType': 'bill_payment',
        'source': 'ratibu_mobile',
      },
    );
  }

  Future<Map<String, dynamic>> checkKcbTransactionStatus({
    required String originatorRequestId,
  }) {
    return _invokeKcbGateway(
      action: 'transaction-status',
      payload: {
        'originatorRequestId': originatorRequestId,
      },
    );
  }
}
