import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/transaction.dart';
import '../utils/notification_helper.dart';


class TransactionService {
  final _supabase = Supabase.instance.client;

  Future<T> _retry<T>(Future<T> Function() action) async {
    Object? lastError;
    for (var i = 0; i < 3; i++) {
      try {
        return await action();
      } catch (e) {
        lastError = e;
        final message = e.toString().toLowerCase();
        if (i == 2 ||
            !(message.contains('connection reset by peer') ||
                message.contains('clientexception') ||
                message.contains('socketexception'))) {
          rethrow;
        }
        await Future<void>.delayed(Duration(milliseconds: 300 * (i + 1)));
      }
    }
    throw lastError ?? Exception('Request failed');
  }

  Future<List<Transaction>> getRecentTransactions() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return [];

    final response = await _retry(() => _supabase
        .from('transactions')
        .select()
        .eq('user_id', user.id)
        .order('created_at', ascending: false)
        .limit(10));

    final rows = response is List ? response : const [];
    return rows.map((t) => Transaction.fromMap(Map<String, dynamic>.from(t as Map))).toList();
  }

  Future<double> getTotalBalance() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return 0;

    final [chamasResponse, savingsResponse] = await Future.wait([
      _retry(() => _supabase
          .from('chama_members')
          .select('chamas(balance)')
          .eq('user_id', user.id)
          .eq('status', 'active')),
      _retry(() => _supabase
          .from('user_savings_targets')
          .select('current_amount')
          .eq('user_id', user.id)),
    ]);

    double total = 0;
    for (var item in (chamasResponse as List)) {
      if (item['chamas'] != null) {
        total += (item['chamas']['balance'] as num? ?? 0).toDouble();
      }
    }
    for (final item in (savingsResponse as List)) {
      total += (item['current_amount'] as num? ?? 0).toDouble();
    }
    return total;
  }

  Future<double> getSavingsBalance() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return 0;

    final response = await _retry(() => _supabase
        .from('user_savings_targets')
        .select('current_amount')
        .eq('user_id', user.id));

    double total = 0;
    for (final row in (response is List ? response : const [])) {
      total += (row['current_amount'] as num? ?? 0).toDouble();
    }
    return total;
  }

  Future<int> getActiveChamaCount() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return 0;

    final count = await _retry(() => _supabase
        .from('chama_members')
        .count(CountOption.exact)
        .eq('user_id', user.id)
        .eq('status', 'active'));
    
    return count;
  }

  Future<double> getPendingPayments() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return 0.0;

    final response = await _retry(() => _supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', user.id)
        .eq('status', 'pending'));

    double total = 0;
    for (final row in (response is List ? response : const [])) {
      total += (row['amount'] as num? ?? 0).toDouble();
    }
    return total;
  }

  Future<List<Map<String, dynamic>>> getUpcomingMeetings() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return [];

    final activeChamas = await _retry(() => _supabase
        .from('chama_members')
        .select('chama_id')
        .eq('user_id', user.id)
        .eq('status', 'active'));

    final chamaIds = (activeChamas as List)
        .map((row) => row['chama_id']?.toString())
        .whereType<String>()
        .toList();

    if (chamaIds.isEmpty) return [];

    final response = await _retry(() => _supabase
        .from('meetings')
        .select('id, title, date, venue, video_link, chama_id, chamas(name)')
        .inFilter('chama_id', chamaIds)
        .gte('date', DateTime.now().toIso8601String())
        .order('date', ascending: true)
        .limit(3));

    if (response is! List) return [];
    return response.map((row) => Map<String, dynamic>.from(row as Map)).toList();
  }

  Future<void> requestWithdrawal({
    required String chamaId,
    required double amount,
    required String reason,
  }) async {
    final user = _supabase.auth.currentUser;
    if (user == null) throw Exception('Not authenticated');

    await _retry(() => _supabase.from('transactions').insert({
      'chama_id': chamaId,
      'user_id': user.id,
      'type': 'withdrawal',
      'amount': amount,
      'status': 'pending',
      'description': 'Withdrawal: $reason',
    }));

    await NotificationHelper.notifyUser(
      targetUserId: user.id,
      title: 'Withdrawal request received',
      message: 'Your withdrawal request has been received and is pending approval.',
      type: 'warning',
      link: '/chamas',
      emailSubject: 'Withdrawal request received',
    );

    final admins = await _retry(() => _supabase
        .from('chama_members')
        .select('user_id')
        .eq('chama_id', chamaId)
        .inFilter('role', ['admin', 'treasurer', 'secretary'])
        .eq('status', 'active'));

    for (final admin in (admins as List)) {
      final adminId = admin['user_id']?.toString();
      if (adminId == null || adminId == user.id) continue;
      await NotificationHelper.notifyUser(
        targetUserId: adminId,
        title: 'Withdrawal request',
        message: 'A chama withdrawal request needs review.',
        type: 'info',
        link: '/chamas',
        emailSubject: 'Chama withdrawal request',
      );
    }
  }
}
