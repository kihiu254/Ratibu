import 'package:supabase_flutter/supabase_flutter.dart';

class WalletOverview {
  final Map<String, dynamic>? user;
  final List<WalletTransferRecord> transfers;

  const WalletOverview({
    required this.user,
    required this.transfers,
  });
}

class WalletTransferRecord {
  final String id;
  final String direction;
  final double amount;
  final String? note;
  final String status;
  final String channel;
  final DateTime createdAt;
  final double? senderBalanceAfter;
  final double? receiverBalanceAfter;

  const WalletTransferRecord({
    required this.id,
    required this.direction,
    required this.amount,
    required this.note,
    required this.status,
    required this.channel,
    required this.createdAt,
    required this.senderBalanceAfter,
    required this.receiverBalanceAfter,
  });
}

class WalletService {
  final SupabaseClient _supabase;

  WalletService({SupabaseClient? client}) : _supabase = client ?? Supabase.instance.client;

  Future<WalletOverview?> fetchOverview() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return null;

    final overviewResponse = await _supabase.rpc('get_marketplace_overview', params: {
      'p_user_id': user.id,
    });

    final overviewMap = overviewResponse is Map
        ? Map<String, dynamic>.from(overviewResponse)
        : <String, dynamic>{};
    final userData = Map<String, dynamic>.from(overviewMap['user'] as Map? ?? {});

    final transferResponse = await _supabase
        .from('wallet_transfers')
        .select('id, sender_user_id, receiver_user_id, amount, note, channel, status, sender_balance_after, receiver_balance_after, created_at')
        .or('sender_user_id.eq.${user.id},receiver_user_id.eq.${user.id}')
        .order('created_at', ascending: false)
        .limit(10);

    final transfers = (transferResponse as List? ?? const [])
        .map((row) => Map<String, dynamic>.from(row as Map))
        .map((row) {
          final senderId = row['sender_user_id']?.toString();
          return WalletTransferRecord(
            id: row['id']?.toString() ?? '',
            direction: senderId == user.id ? 'outgoing' : 'incoming',
            amount: (row['amount'] as num?)?.toDouble() ?? 0,
            note: row['note']?.toString(),
            status: row['status']?.toString() ?? 'completed',
            channel: row['channel']?.toString() ?? 'wallet',
            createdAt: DateTime.tryParse(row['created_at']?.toString() ?? '') ?? DateTime.now(),
            senderBalanceAfter: (row['sender_balance_after'] as num?)?.toDouble(),
            receiverBalanceAfter: (row['receiver_balance_after'] as num?)?.toDouble(),
          );
        })
        .toList();

    return WalletOverview(user: userData, transfers: transfers);
  }

  Future<Map<String, dynamic>> sendMoney({
    required String receiverPhone,
    required double amount,
    String? note,
  }) async {
    final user = _supabase.auth.currentUser;
    if (user == null) throw Exception('Not authenticated');

    final response = await _supabase.rpc('internal_wallet_transfer', params: {
      'p_sender_user_id': user.id,
      'p_receiver_phone': receiverPhone,
      'p_amount': amount,
      'p_note': note?.trim().isEmpty == true ? null : note?.trim(),
    });

    if (response is Map<String, dynamic>) {
      return response;
    }
    return Map<String, dynamic>.from(response as Map);
  }
}
