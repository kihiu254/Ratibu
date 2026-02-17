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
      id: map['id'],
      chamaId: map['chama_id'],
      userId: map['user_id'],
      type: map['type'],
      amount: (map['amount'] as num).toDouble(),
      status: map['status'] ?? 'pending',
      reference: map['reference'],
      description: map['description'],
      createdAt: DateTime.parse(map['created_at']),
      completedAt: map['completed_at'] != null ? DateTime.parse(map['completed_at']) : null,
    );
  }
}
