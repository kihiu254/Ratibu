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
    );
  }

  double get progressPercent {
    if (targetAmount <= 0) return 0;
    final value = (currentAmount / targetAmount) * 100;
    return value > 100 ? 100 : value;
  }
}
