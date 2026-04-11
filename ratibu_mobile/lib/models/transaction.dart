class Transaction {
  final String id;
  final String chamaId;
  final String userId;
  final String type;
  final double amount;
  final String status;
  final String? reference;
  final String? description;
  final DateTime createdAt;
  final DateTime? completedAt;

  Transaction({
    required this.id,
    required this.chamaId,
    required this.userId,
    required this.type,
    required this.amount,
    required this.status,
    this.reference,
    this.description,
    required this.createdAt,
    this.completedAt,
  });

  factory Transaction.fromMap(Map<String, dynamic> map) {
    return Transaction(
      id: map['id']?.toString() ?? '',
      chamaId: map['chama_id']?.toString() ?? '',
      userId: map['user_id']?.toString() ?? '',
      type: map['type']?.toString() ?? 'unknown',
      amount: (map['amount'] as num? ?? 0).toDouble(),
      status: map['status']?.toString() ?? 'pending',
      reference: map['reference']?.toString(),
      description: map['description']?.toString(),
      createdAt: DateTime.tryParse(map['created_at']?.toString() ?? '') ?? DateTime.now(),
      completedAt: map['completed_at'] != null
          ? DateTime.tryParse(map['completed_at'].toString())
          : null,
    );
  }
}
