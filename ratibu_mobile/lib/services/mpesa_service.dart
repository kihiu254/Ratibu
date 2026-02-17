import 'package:supabase_flutter/supabase_flutter.dart';

class MpesaService {
  final _supabase = Supabase.instance.client;

  /// Triggers an M-Pesa STK Push to the specified phone number.
  /// 
  /// [phoneNumber] should be in the format 254XXXXXXXXX.
  /// [amount] is the amount to deposit.
  /// [accountReference] is usually the Chama ID or User ID.
  Future<void> initiateStkPush({
    required String phoneNumber,
    required double amount,
    required String userId,
    required String chamaId,
  }) async {
    final session = _supabase.auth.currentSession;
    if (session == null) {
      print('ERROR: User not logged in. STK Push aborted.');
      throw 'User not logged in. Cannot initiate STK Push.';
    }
    
    // Debug: Log token to verify it exists
    final token = session.accessToken;
    print('Initiating STK Push with User: ${_supabase.auth.currentUser?.id}');
    print('Has Access Token: ${token.isNotEmpty}');

    final body = {
          'amount': amount,
          'phoneNumber': phoneNumber,
          'userId': userId,
          'chamaId': chamaId,
          // 'type': 'contribution' // Optional, add if needed by backend
        };
    print('Sending STK Push Body: $body');

    try {
      final response = await _supabase.functions.invoke(
        'trigger-stk-push',
        body: body,
      );

      // _supabase.functions.invoke throws on non-200 if configured, but let's be safe
      if (response.status != 200) {
        throw 'Function returned status ${response.status}: ${response.data}';
      }
    } on FunctionException catch (e) {
      // Print the full error to the console to avoid truncation in toast
      print('FULL FUNCTION ERROR: $e');
      if (e.details != null) print('ERROR DETAILS: ${e.details}');
      
      throw 'STK Push Function Error: $e';
    } catch (e) {
       print('FULL GENERAL ERROR: $e');
       throw 'STK Push failed: $e';
    }
  }
  /// Generates an M-Pesa QR code for the specified amount and chama.
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
          'trxCode': 'PB', // Default to Paybill for Chama contributions
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
