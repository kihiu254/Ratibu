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
    try {
      await _supabase.functions.invoke(
        'trigger-stk-push',
        body: {
          'phoneNumber': phoneNumber,
          'amount': amount,
          'userId': userId,
          'chamaId': chamaId,
        },
      );
    } catch (e) {
      throw 'STK Push failed: $e';
    }
  }
}
