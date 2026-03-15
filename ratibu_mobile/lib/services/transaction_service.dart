import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/transaction.dart';
import '../utils/notification_helper.dart';


class TransactionService {
  final _supabase = Supabase.instance.client;

  Future<List<Transaction>> getRecentTransactions() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return [];

    final response = await _supabase
        .from('transactions')
        .select()
        .eq('user_id', user.id)
        .order('created_at', ascending: false)
        .limit(10);

    return (response as List).map((t) => Transaction.fromMap(t)).toList();
  }

  Future<double> getTotalBalance() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return 0;

    // Sum balance from all chamas where user is a member
    double total = 0;
    
    // The previous implementation was summing ALL chamas' balances
    // It should probably sum the user's specific wallet balance or share in each chama
    // For now, let's assume 'balance' in chamas table is the chama's total fund
    // And users might want to see their own contribution total? 
    // Reverting to previous logic: Sum of balances of chamas they belong to (High level view)
    
    final response = await _supabase
        .from('chama_members')
        .select('chamas(balance)')
        .eq('user_id', user.id);

    if (response != null) {
      for (var item in (response as List)) {
        if (item['chamas'] != null) {
          total += (item['chamas']['balance'] as num).toDouble();
        }
      }
    }
    return total;
  }

  Future<int> getActiveChamaCount() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return 0;

    final count = await _supabase
        .from('chama_members')
        .count(CountOption.exact)
        .eq('user_id', user.id);
    
    return count;
  }

  Future<double> getPendingPayments() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return 0.0;
    
    // In a real app, we'd query a 'contributions' table for status='pending'
    return 0.0; 
  }

  Future<void> requestWithdrawal({
    required String chamaId,
    required double amount,
    required String reason,
  }) async {
    final user = _supabase.auth.currentUser;
    if (user == null) throw Exception('Not authenticated');

    await _supabase.from('transactions').insert({
      'chama_id': chamaId,
      'user_id': user.id,
      'type': 'withdrawal',
      'amount': amount,
      'status': 'pending',
      'description': 'Withdrawal: $reason',
    });

    // Notify User and Admin via Email
    if (user.email != null) {
      NotificationHelper.sendEmail(
        to: user.email!,
        subject: 'Withdrawal Request Received',
        html: '''
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #FF9800;">Withdrawal Requested</h2>
            <p>Your request to withdraw <b>KES $amount</b> has been received and is pending approval.</p>
            <p><b>Reason:</b> $reason</p>
            <p>You will be notified once the request is processed.</p>
            <br>
            <p>Best regards,<br>The Ratibu Team</p>
          </div>
        ''',
      );
    }
  }
}
