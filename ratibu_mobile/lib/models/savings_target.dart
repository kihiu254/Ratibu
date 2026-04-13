class SavingsTarget {
  final String id;
  final String name;
  final String purpose;
  final String? destinationLabel;
  final double targetAmount;
  final double currentAmount;
  final bool autoAllocate;
  final String allocationType;
  final double allocationValue;
  final String status;
  final String? notes;
  final bool isLocked;
  final int? lockPeriodMonths;
  final DateTime? lockUntil;
  final DateTime? lockStartedAt;
  final int? savingsPeriodMonths;
  final DateTime? savingsPeriodStartedAt;
  final double earlyWithdrawalPenaltyPercent;

  const SavingsTarget({
    required this.id,
    required this.name,
    required this.purpose,
    required this.destinationLabel,
    required this.targetAmount,
    required this.currentAmount,
    required this.autoAllocate,
    required this.allocationType,
    required this.allocationValue,
    required this.status,
    required this.notes,
    this.isLocked = false,
    this.lockPeriodMonths,
    this.lockUntil,
    this.lockStartedAt,
    this.savingsPeriodMonths,
    this.savingsPeriodStartedAt,
    this.earlyWithdrawalPenaltyPercent = 5,
  });

  factory SavingsTarget.fromMap(Map<String, dynamic> map) {
    return SavingsTarget(
      id: map['id'] as String,
      name: map['name'] as String? ?? '',
      purpose: map['purpose'] as String? ?? 'custom',
      destinationLabel: map['destination_label'] as String?,
      targetAmount: (map['target_amount'] as num?)?.toDouble() ?? 0,
      currentAmount: (map['current_amount'] as num?)?.toDouble() ?? 0,
      autoAllocate: map['auto_allocate'] as bool? ?? true,
      allocationType: map['allocation_type'] as String? ?? 'percentage',
      allocationValue: (map['allocation_value'] as num?)?.toDouble() ?? 0,
      status: map['status'] as String? ?? 'active',
      notes: map['notes'] as String?,
      isLocked: map['is_locked'] as bool? ?? false,
      lockPeriodMonths: (map['lock_period_months'] as num?)?.toInt(),
      lockUntil: map['lock_until'] != null
          ? DateTime.tryParse(map['lock_until'] as String)
          : null,
      lockStartedAt: map['lock_started_at'] != null
          ? DateTime.tryParse(map['lock_started_at'] as String)
          : null,
      savingsPeriodMonths: (map['savings_period_months'] as num?)?.toInt(),
      savingsPeriodStartedAt: map['savings_period_started_at'] != null
          ? DateTime.tryParse(map['savings_period_started_at'] as String)
          : null,
      earlyWithdrawalPenaltyPercent:
          (map['early_withdrawal_penalty_percent'] as num?)?.toDouble() ?? 5,
    );
  }

  double get progressPercent {
    if (targetAmount <= 0) return 0;
    return ((currentAmount / targetAmount) * 100).clamp(0, 100);
  }

  /// Whether the lock period is still active
  bool get isCurrentlyLocked {
    if (!isLocked || lockUntil == null) return false;
    return DateTime.now().isBefore(lockUntil!);
  }

  /// Days remaining in lock period
  int get lockDaysRemaining {
    if (!isCurrentlyLocked) return 0;
    return lockUntil!.difference(DateTime.now()).inDays;
  }

  DateTime? get savingsPeriodEndsAt {
    final startedAt = savingsPeriodStartedAt;
    final months = savingsPeriodMonths;
    if (startedAt == null || months == null) return null;
    return DateTime(startedAt.year, startedAt.month + months, startedAt.day, startedAt.hour, startedAt.minute, startedAt.second);
  }

  bool get isSavingsPeriodActive {
    final endsAt = savingsPeriodEndsAt;
    if (endsAt == null) return false;
    return DateTime.now().isBefore(endsAt);
  }
}
