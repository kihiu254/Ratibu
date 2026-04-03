import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class StatementScreen extends StatefulWidget {
  final String accountType; // 'chama' | 'savings_target' | 'mshwari'
  final String? accountId;
  final String accountName;

  const StatementScreen({
    super.key,
    required this.accountType,
    this.accountId,
    required this.accountName,
  });

  @override
  State<StatementScreen> createState() => _StatementScreenState();
}

class _StatementScreenState extends State<StatementScreen> {
  final _supabase = Supabase.instance.client;
  final _fmt = NumberFormat('#,##0');
  List<Map<String, dynamic>> _rows = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final user = _supabase.auth.currentUser;
      if (user == null) return;

      final q = _supabase
          .from('transactions')
          .select('id, type, amount, status, description, reference, created_at')
          .eq('user_id', user.id);

      if (widget.accountType == 'chama' && widget.accountId != null) {
        q.eq('chama_id', widget.accountId!);
      } else if (widget.accountType == 'savings_target' && widget.accountId != null) {
        q.eq('savings_target_id', widget.accountId!);
      } else if (widget.accountType == 'mshwari') {
        q.ilike('description', '%mshwari%');
      }

      final data = await q.order('created_at', ascending: false).limit(100);
      if (mounted) setState(() => _rows = List<Map<String, dynamic>>.from(data));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load statement: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.accountName,
                style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
            const Text('Transaction statement',
                style: TextStyle(color: Colors.white54, fontSize: 12)),
          ],
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF00C853)))
          : RefreshIndicator(
              onRefresh: _load,
              color: const Color(0xFF00C853),
              child: _rows.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 80),
                        Icon(Icons.receipt_long_outlined, color: Colors.white24, size: 48),
                        SizedBox(height: 12),
                        Center(
                          child: Text('No transactions yet for this account.',
                              style: TextStyle(color: Colors.white54)),
                        ),
                      ],
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _rows.length,
                      separatorBuilder: (_, __) => const Divider(color: Colors.white10, height: 1),
                      itemBuilder: (_, i) {
                        final tx = _rows[i];
                        final type = tx['type'] as String? ?? '';
                        final isCredit = type == 'deposit' || type == 'credit';
                        final amount = (tx['amount'] as num? ?? 0).toDouble();
                        final status = tx['status'] as String? ?? '';
                        final desc = tx['description'] as String? ?? type;
                        final ref = tx['reference'] as String?;
                        final date = DateTime.tryParse(tx['created_at'] as String? ?? '');

                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: isCredit
                                      ? const Color(0xFF00C853).withValues(alpha: 0.12)
                                      : Colors.red.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Icon(
                                  isCredit ? Icons.arrow_downward_rounded : Icons.arrow_upward_rounded,
                                  color: isCredit ? const Color(0xFF00C853) : Colors.redAccent,
                                  size: 18,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      desc[0].toUpperCase() + desc.substring(1),
                                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                                    ),
                                    if (date != null)
                                      Text(
                                        DateFormat('d MMM y, HH:mm').format(date.toLocal()),
                                        style: const TextStyle(color: Colors.white38, fontSize: 11),
                                      ),
                                    if (ref != null)
                                      Text('Ref: $ref',
                                          style: const TextStyle(color: Colors.white38, fontSize: 11)),
                                  ],
                                ),
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(
                                    '${isCredit ? '+' : '-'}KES ${_fmt.format(amount)}',
                                    style: TextStyle(
                                      color: isCredit ? const Color(0xFF00C853) : Colors.redAccent,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  Container(
                                    margin: const EdgeInsets.only(top: 4),
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: status == 'completed'
                                          ? const Color(0xFF00C853).withValues(alpha: 0.12)
                                          : status == 'pending'
                                              ? Colors.orange.withValues(alpha: 0.12)
                                              : Colors.red.withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      status,
                                      style: TextStyle(
                                        fontSize: 10,
                                        color: status == 'completed'
                                            ? const Color(0xFF00C853)
                                            : status == 'pending'
                                                ? Colors.orange
                                                : Colors.redAccent,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
