import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/savings_target.dart';

class SavingsTargetService {
  final _supabase = Supabase.instance.client;

  Future<List<SavingsTarget>> getSavingsTargets() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return [];

    final response = await _supabase
        .from('user_savings_targets')
        .select()
        .eq('user_id', user.id)
        .order('created_at', ascending: false);

    return (response as List)
        .map((item) => SavingsTarget.fromMap(item as Map<String, dynamic>))
        .toList();
  }

  Future<void> createSavingsTarget({
    required String name,
    required String purpose,
    String? destinationLabel,
    required double targetAmount,
    double currentAmount = 0,
    required bool autoAllocate,
    required String allocationType,
    required double allocationValue,
    String? notes,
    bool isLocked = false,
    int? lockPeriodMonths,
  }) async {
    final user = _supabase.auth.currentUser;
    if (user == null) throw Exception('Not authenticated');

    DateTime? lockUntil;
    DateTime? lockStartedAt;
    if (isLocked && lockPeriodMonths != null) {
      lockStartedAt = DateTime.now();
      lockUntil = DateTime(
        lockStartedAt.year,
        lockStartedAt.month + lockPeriodMonths,
        lockStartedAt.day,
      );
    }

    await _supabase.from('user_savings_targets').insert({
      'user_id': user.id,
      'name': name,
      'purpose': purpose,
      'destination_label': destinationLabel?.trim().isEmpty == true ? null : destinationLabel?.trim(),
      'target_amount': targetAmount,
      'current_amount': currentAmount,
      'auto_allocate': autoAllocate,
      'allocation_type': allocationType,
      'allocation_value': allocationValue,
      'notes': notes?.trim().isEmpty == true ? null : notes?.trim(),
      'is_locked': isLocked,
      if (lockPeriodMonths != null) 'lock_period_months': lockPeriodMonths,
      if (lockUntil != null) 'lock_until': lockUntil.toIso8601String(),
      if (lockStartedAt != null) 'lock_started_at': lockStartedAt.toIso8601String(),
      'status': isLocked ? 'locked' : 'active',
    });
  }

  Future<void> updateCurrentAmount({
    required String targetId,
    required double newAmount,
  }) async {
    await _supabase
        .from('user_savings_targets')
        .update({
          'current_amount': newAmount,
          'updated_at': DateTime.now().toIso8601String(),
        })
        .eq('id', targetId);
  }

  Future<void> updateSavingsTargetStatus({
    required String targetId,
    required String status,
  }) async {
    await _supabase
        .from('user_savings_targets')
        .update({
          'status': status,
          'updated_at': DateTime.now().toIso8601String(),
        })
        .eq('id', targetId);
  }
}
