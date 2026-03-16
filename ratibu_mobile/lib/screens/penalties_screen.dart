import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class PenaltiesScreen extends StatefulWidget {
  const PenaltiesScreen({super.key});

  @override
  State<PenaltiesScreen> createState() => _PenaltiesScreenState();
}

class _PenaltiesScreenState extends State<PenaltiesScreen> {
  bool _loading = true;
  List<Map<String, dynamic>> _events = [];
  int _totalPoints = 0;
  double _totalMoney = 0;

  @override
  void initState() {
    super.initState();
    _loadPenalties();
  }

  Future<void> _loadPenalties() async {
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) return;

      final data = await Supabase.instance.client
          .from('penalty_events')
          .select('id, reason, points_penalty, monetary_penalty, status, created_at, chama:chamas(name)')
          .eq('user_id', user.id)
          .order('created_at', ascending: false);

      int points = 0;
      double money = 0;
      for (final e in data) {
        points += (e['points_penalty'] as num?)?.toInt() ?? 0;
        money += (e['monetary_penalty'] as num?)?.toDouble() ?? 0;
      }

      setState(() {
        _events = List<Map<String, dynamic>>.from(data);
        _totalPoints = points;
        _totalMoney = money;
        _loading = false;
      });
    } catch (e) {
      debugPrint('Error loading penalties: $e');
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      appBar: AppBar(
        title: const Text('Penalties'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF00C853)))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: _summaryCard(
                          label: 'Penalty Points',
                          value: _totalPoints.toString(),
                          color: Colors.orange,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _summaryCard(
                          label: 'Total KES',
                          value: NumberFormat('#,##0.00').format(_totalMoney),
                          color: Colors.red,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'Penalty History',
                    style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  if (_events.isEmpty)
                    const Text('No penalties found.', style: TextStyle(color: Colors.white54))
                  else
                    ..._events.map((e) {
                      final chama = e['chama'] as Map<String, dynamic>?;
                      final date = DateTime.tryParse(e['created_at'] ?? '');
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1e293b),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: Colors.white10),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              e['reason'] ?? 'Penalty',
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              chama?['name'] ?? 'Chama',
                              style: const TextStyle(color: Colors.white54, fontSize: 12),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              date != null ? DateFormat.yMMMd().add_jm().format(date) : '',
                              style: const TextStyle(color: Colors.white38, fontSize: 12),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Text(
                                  '-${e['points_penalty'] ?? 0} pts',
                                  style: const TextStyle(color: Colors.orange, fontWeight: FontWeight.bold),
                                ),
                                const SizedBox(width: 12),
                                Text(
                                  'KES ${NumberFormat('#,##0.00').format((e['monetary_penalty'] as num?)?.toDouble() ?? 0)}',
                                  style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold),
                                ),
                                const Spacer(),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.08),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    (e['status'] ?? 'applied').toString().toUpperCase(),
                                    style: const TextStyle(color: Colors.white54, fontSize: 10),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    }),
                ],
              ),
            ),
    );
  }

  Widget _summaryCard({required String label, required String value, required Color color}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1e293b),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Colors.white54, fontSize: 12)),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(color: color, fontSize: 20, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }
}
