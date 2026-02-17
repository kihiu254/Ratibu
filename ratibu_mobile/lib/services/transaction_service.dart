import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/transaction.dart';

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
    // For now, return 0 or mock logic if table doesn't support it yet
    return 0.0; 
  }
}
