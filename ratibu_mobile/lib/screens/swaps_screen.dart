import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../providers/chama_provider.dart';

class SwapsScreen extends ConsumerStatefulWidget {
  const SwapsScreen({super.key});

  @override
  ConsumerState<SwapsScreen> createState() => _SwapsScreenState();
}

class _SwapsScreenState extends ConsumerState<SwapsScreen> {
  bool _loading = true;
  bool _loadingData = false;
  List<Map<String, dynamic>> _chamas = [];
  String? _selectedChamaId;
  DateTime _selectedMonth = DateTime(DateTime.now().year, DateTime.now().month, 1);
  List<Map<String, dynamic>> _allocations = [];
  List<Map<String, dynamic>> _swapRequests = [];

  @override
  void initState() {
    super.initState();
    _loadChamas();
  }

  Future<void> _loadChamas() async {
    try {
      final service = ref.read(chamaServiceProvider);
      final chamas = await service.getMyChamas();
      setState(() {
        _chamas = chamas;
        _selectedChamaId = chamas.isNotEmpty ? chamas.first['id'] as String : null;
        _loading = false;
      });
      if (_selectedChamaId != null) {
        await _loadData();
      }
    } catch (e) {
      debugPrint('Error loading chamas: $e');
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadData() async {
    if (_selectedChamaId == null) return;
    setState(() => _loadingData = true);
    try {
      final service = ref.read(chamaServiceProvider);
      final allocations = await service.getAllocations(_selectedChamaId!, _selectedMonth);
      final swaps = await service.getSwapRequests(_selectedChamaId!, _selectedMonth);
      setState(() {
        _allocations = allocations;
        _swapRequests = swaps;
      });
    } catch (e) {
      debugPrint('Error loading swaps: $e');
    } finally {
      if (mounted) setState(() => _loadingData = false);
    }
  }

  void _changeMonth(int delta) {
    setState(() {
      _selectedMonth = DateTime(_selectedMonth.year, _selectedMonth.month + delta, 1);
    });
    _loadData();
  }

  Future<void> _requestSwap() async {
    final userId = Supabase.instance.client.auth.currentUser?.id;
    if (userId == null || _selectedChamaId == null) return;

    final myAllocation = _allocations.firstWhere(
      (a) => a['user_id'] == userId,
      orElse: () => {},
    );
    if (myAllocation.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Your allocation day is not set yet.')),
      );
      return;
    }

    String? targetUserId;
    int? targetDay;
    final myDay = myAllocation['allocation_day'] as int? ?? 0;

    if (!mounted) return;
    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setLocalState) => AlertDialog(
          backgroundColor: const Color(0xFF1e293b),
          title: const Text('Request Swap', style: TextStyle(color: Colors.white)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                dropdownColor: const Color(0xFF0f172a),
                value: targetUserId,
                hint: const Text('Select member', style: TextStyle(color: Colors.white54)),
                items: _allocations
                    .where((a) => a['user_id'] != userId)
                    .map((a) {
                      final user = a['user'] as Map<String, dynamic>?;
                      final name = '${user?['first_name'] ?? ''} ${user?['last_name'] ?? ''}'.trim();
                      return DropdownMenuItem(
                        value: a['user_id'] as String,
                        child: Text(name.isEmpty ? 'Member' : name, style: const TextStyle(color: Colors.white)),
                      );
                    })
                    .toList(),
                onChanged: (val) {
                  setLocalState(() {
                    targetUserId = val;
                    final match = _allocations.firstWhere((a) => a['user_id'] == val, orElse: () => {});
                    targetDay = match['allocation_day'] as int?;
                  });
                },
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Text('Your day: $myDay', style: const TextStyle(color: Colors.white70)),
                  const Spacer(),
                  Text('Target: ${targetDay ?? '-'}', style: const TextStyle(color: Colors.white70)),
                ],
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel', style: TextStyle(color: Colors.white54)),
            ),
            TextButton(
              onPressed: targetUserId == null
                  ? null
                  : () async {
                      try {
                        await ref.read(chamaServiceProvider).createSwapRequest(
                          chamaId: _selectedChamaId!,
                          month: _selectedMonth,
                          targetUserId: targetUserId!,
                          myDay: myDay,
                          targetDay: targetDay ?? 0,
                        );
                        if (context.mounted) {
                          Navigator.pop(context);
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Swap request sent')),
                          );
                        }
                        _loadData();
                      } catch (e) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Failed: $e')),
                          );
                        }
                      }
                    },
              child: const Text('Send', style: TextStyle(color: Color(0xFF00C853))),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: Color(0xFF0f172a),
        body: Center(child: CircularProgressIndicator(color: Color(0xFF00C853))),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      appBar: AppBar(
        title: const Text('Swaps & Allocations'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            onPressed: _requestSwap,
            icon: const Icon(Icons.swap_horiz),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    dropdownColor: const Color(0xFF0f172a),
                    value: _selectedChamaId,
                    hint: const Text('Select Chama', style: TextStyle(color: Colors.white54)),
                    items: _chamas.map((c) {
                      return DropdownMenuItem(
                        value: c['id'] as String,
                        child: Text(c['name'] ?? 'Chama', style: const TextStyle(color: Colors.white)),
                      );
                    }).toList(),
                    onChanged: (val) {
                      setState(() => _selectedChamaId = val);
                      _loadData();
                    },
                  ),
                ),
                const SizedBox(width: 12),
                IconButton(
                  onPressed: () => _changeMonth(-1),
                  icon: const Icon(Icons.chevron_left, color: Colors.white),
                ),
                Text(
                  DateFormat('MMM yyyy').format(_selectedMonth),
                  style: const TextStyle(color: Colors.white),
                ),
                IconButton(
                  onPressed: () => _changeMonth(1),
                  icon: const Icon(Icons.chevron_right, color: Colors.white),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (_loadingData)
              const Expanded(
                child: Center(child: CircularProgressIndicator(color: Color(0xFF00C853))),
              )
            else
              Expanded(
                child: ListView(
                  children: [
                    const Text('Allocation Schedule', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    if (_allocations.isEmpty)
                      const Text('No allocations found.', style: TextStyle(color: Colors.white54))
                    else
                      ..._allocations.map((a) {
                        final user = a['user'] as Map<String, dynamic>?;
                        final name = '${user?['first_name'] ?? ''} ${user?['last_name'] ?? ''}'.trim();
                        return Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1e293b),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.white10),
                          ),
                          child: Row(
                            children: [
                              CircleAvatar(
                                radius: 16,
                                backgroundColor: const Color(0xFF0f172a),
                                child: Text(
                                  (a['allocation_day'] ?? '').toString(),
                                  style: const TextStyle(color: Colors.white, fontSize: 12),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  name.isEmpty ? 'Member' : name,
                                  style: const TextStyle(color: Colors.white),
                                ),
                              ),
                            ],
                          ),
                        );
                      }),
                    const SizedBox(height: 16),
                    const Text('Swap Requests', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    if (_swapRequests.isEmpty)
                      const Text('No swap requests yet.', style: TextStyle(color: Colors.white54))
                    else
                      ..._swapRequests.map((s) {
                        final requester = s['requester'] as Map<String, dynamic>?;
                        final target = s['target'] as Map<String, dynamic>?;
                        return Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1e293b),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.white10),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.swap_horiz, color: Colors.white54, size: 18),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  '${requester?['first_name'] ?? ''} ${requester?['last_name'] ?? ''} ↔ ${target?['first_name'] ?? ''} ${target?['last_name'] ?? ''}',
                                  style: const TextStyle(color: Colors.white70, fontSize: 12),
                                ),
                              ),
                              Text(
                                (s['status'] ?? 'pending').toString().toUpperCase(),
                                style: const TextStyle(color: Colors.white38, fontSize: 10),
                              ),
                            ],
                          ),
                        );
                      }),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
