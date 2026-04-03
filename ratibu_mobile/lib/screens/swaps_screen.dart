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

class _SwapsScreenState extends ConsumerState<SwapsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _loading = true;
  bool _loadingData = false;
  List<Map<String, dynamic>> _chamas = [];
  String? _selectedChamaId;
  String? _selectedChamaName;
  DateTime _selectedMonth =
      DateTime(DateTime.now().year, DateTime.now().month, 1);
  List<Map<String, dynamic>> _allocations = [];
  List<Map<String, dynamic>> _swapRequests = [];
  String? _myUserId;
  bool _creatingSwap = false;
  String? _actingSwapId;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _myUserId = Supabase.instance.client.auth.currentUser?.id;
    _loadChamas();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadChamas() async {
    try {
      final chamas = await ref.read(chamaServiceProvider).getMyChamas();
      setState(() {
        _chamas = chamas;
        _selectedChamaId =
            chamas.isNotEmpty ? chamas.first['id'] as String : null;
        _selectedChamaName =
            chamas.isNotEmpty ? chamas.first['name'] as String? : null;
        _loading = false;
      });
      if (_selectedChamaId != null) await _loadData();
    } catch (e) {
      debugPrint('Error: $e');
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadData() async {
    if (_selectedChamaId == null) return;
    setState(() => _loadingData = true);
    try {
      final service = ref.read(chamaServiceProvider);
      await service.generateAllocations(_selectedChamaId!, _selectedMonth);
      final allocations =
          await service.getAllocations(_selectedChamaId!, _selectedMonth);
      final swaps =
          await service.getSwapRequests(_selectedChamaId!, _selectedMonth);
      setState(() {
        _allocations = allocations;
        _swapRequests = swaps;
      });
    } catch (e) {
      debugPrint('Error loading data: $e');
      _snack(_errorText(e));
    } finally {
      if (mounted) setState(() => _loadingData = false);
    }
  }

  void _changeMonth(int delta) {
    setState(() {
      _selectedMonth =
          DateTime(_selectedMonth.year, _selectedMonth.month + delta, 1);
    });
    _loadData();
  }

  Map<String, dynamic>? get _myAllocation =>
      _allocations.where((a) => a['user_id'] == _myUserId).firstOrNull;

  Future<void> _requestSwap() async {
    if (_myAllocation == null) {
      _snack('Your allocation day is not set yet.');
      return;
    }

    String? targetUserId;
    int? targetDay;
    final myDay = _myAllocation!['allocation_day'] as int? ?? 0;

    final others =
        _allocations.where((a) => a['user_id'] != _myUserId).toList();
    if (others.isEmpty) {
      _snack('No other members to swap with.');
      return;
    }

    await showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1e293b),
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => Padding(
          padding: EdgeInsets.only(
            left: 24,
            right: 24,
            top: 24,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF00C853).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child:
                        const Icon(Icons.swap_horiz, color: Color(0xFF00C853)),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Request Swap',
                            style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 18)),
                        Text('Exchange your allocation day with a member',
                            style:
                                TextStyle(color: Colors.white54, fontSize: 12)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              // My day chip
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF0f172a),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white10),
                ),
                child: Row(
                  children: [
                    const Text('Your allocation day:',
                        style: TextStyle(color: Colors.white54, fontSize: 13)),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF00C853).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text('Day $myDay',
                          style: const TextStyle(
                              color: Color(0xFF00C853),
                              fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              const Text('Select member to swap with:',
                  style: TextStyle(color: Colors.white60, fontSize: 13)),
              const SizedBox(height: 8),
              ...others.map((a) {
                final user = a['user'] as Map<String, dynamic>?;
                final name =
                    '${user?['first_name'] ?? ''} ${user?['last_name'] ?? ''}'
                        .trim();
                final day = a['allocation_day'] as int? ?? 0;
                final isSelected = targetUserId == a['user_id'];
                return GestureDetector(
                  onTap: () => setS(() {
                    targetUserId = a['user_id'] as String;
                    targetDay = day;
                  }),
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? const Color(0xFF00C853).withValues(alpha: 0.1)
                          : const Color(0xFF0f172a),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isSelected
                            ? const Color(0xFF00C853)
                            : Colors.white10,
                      ),
                    ),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 18,
                          backgroundColor: Colors.blue.withValues(alpha: 0.15),
                          child: Text(
                            (name.isNotEmpty ? name[0] : '?').toUpperCase(),
                            style: const TextStyle(
                                color: Colors.blue,
                                fontWeight: FontWeight.bold),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            name.isEmpty ? 'Member' : name,
                            style: const TextStyle(color: Colors.white),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.blue.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text('Day $day',
                              style: const TextStyle(
                                  color: Colors.blue, fontSize: 12)),
                        ),
                        if (isSelected) ...[
                          const SizedBox(width: 8),
                          const Icon(Icons.check_circle,
                              color: Color(0xFF00C853), size: 18),
                        ],
                      ],
                    ),
                  ),
                );
              }),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: targetUserId == null || _creatingSwap
                    ? null
                    : () async {
                        Navigator.pop(ctx);
                        setState(() => _creatingSwap = true);
                        try {
                          await ref
                              .read(chamaServiceProvider)
                              .createSwapRequest(
                                chamaId: _selectedChamaId!,
                                month: _selectedMonth,
                                targetUserId: targetUserId!,
                                myDay: myDay,
                                targetDay: targetDay ?? 0,
                              );
                          _snack('Swap request sent!', success: true);
                          _loadData();
                        } catch (e) {
                          _snack(_errorText(e));
                        } finally {
                          if (mounted) setState(() => _creatingSwap = false);
                        }
                      },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF00C853),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                child: Text(
                  _creatingSwap ? 'Sending...' : 'Send Swap Request',
                  style: const TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 15),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _snack(String msg, {bool success = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: success ? const Color(0xFF00C853) : Colors.red,
    ));
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: Color(0xFF0f172a),
        body:
            Center(child: CircularProgressIndicator(color: Color(0xFF00C853))),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      appBar: AppBar(
        title: const Text('Swaps & Allocations',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF0f172a),
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFF00C853),
          indicatorWeight: 3,
          labelColor: const Color(0xFF00C853),
          unselectedLabelColor: Colors.white38,
          labelStyle:
              const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          tabs: [
            Tab(text: 'Schedule (${_allocations.length})'),
            Tab(text: 'Requests (${_swapRequests.length})'),
          ],
        ),
      ),
      body: Column(
        children: [
          // Controls bar
          Container(
            color: const Color(0xFF0f172a),
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Row(
              children: [
                // Chama selector
                Expanded(
                  child: GestureDetector(
                    onTap: _chamas.length > 1 ? _showChamaPicker : null,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1e293b),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.white10),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.group,
                              color: Colors.white54, size: 16),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _selectedChamaName ?? 'Select Chama',
                              style: const TextStyle(
                                  color: Colors.white, fontSize: 13),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (_chamas.length > 1)
                            const Icon(Icons.expand_more,
                                color: Colors.white38, size: 16),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                // Month navigator
                Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFF1e293b),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.white10),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        onPressed: () => _changeMonth(-1),
                        icon: const Icon(Icons.chevron_left,
                            color: Colors.white54, size: 18),
                        padding: const EdgeInsets.all(6),
                        constraints: const BoxConstraints(),
                      ),
                      Text(
                        DateFormat('MMM yy').format(_selectedMonth),
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.bold),
                      ),
                      IconButton(
                        onPressed: () => _changeMonth(1),
                        icon: const Icon(Icons.chevron_right,
                            color: Colors.white54, size: 18),
                        padding: const EdgeInsets.all(6),
                        constraints: const BoxConstraints(),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Tab content
          Expanded(
            child: _loadingData
                ? const Center(
                    child: CircularProgressIndicator(color: Color(0xFF00C853)))
                : TabBarView(
                    controller: _tabController,
                    children: [
                      _buildScheduleTab(),
                      _buildRequestsTab(),
                    ],
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _requestSwap,
        backgroundColor: const Color(0xFF00C853),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.swap_horiz),
        label: const Text('Request Swap',
            style: TextStyle(fontWeight: FontWeight.bold)),
      ),
    );
  }

  void _showChamaPicker() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1e293b),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(ctx).size.height * 0.75,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Padding(
                  padding: EdgeInsets.all(16),
                  child: Text('Select Chama',
                      style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 16)),
                ),
                ..._chamas.map((c) => ListTile(
                      leading:
                          const Icon(Icons.group, color: Color(0xFF00C853)),
                      title: Text(c['name'] ?? 'Chama',
                          style: const TextStyle(color: Colors.white)),
                      onTap: () {
                        Navigator.pop(ctx);
                        setState(() {
                          _selectedChamaId = c['id'] as String;
                          _selectedChamaName = c['name'] as String?;
                        });
                        _loadData();
                      },
                    )),
                const SizedBox(height: 8),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildScheduleTab() {
    if (_allocations.isEmpty) {
      return _emptyState(
        icon: Icons.calendar_month,
        title: 'No allocations yet',
        subtitle: 'Allocations for this month haven\'t been generated.',
      );
    }

    final myAlloc = _myAllocation;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
      children: [
        if (myAlloc != null) ...[
          Container(
            margin: const EdgeInsets.only(bottom: 16),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF00C853), Color(0xFF009624)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                const Icon(Icons.star, color: Colors.white, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Your Allocation',
                          style:
                              TextStyle(color: Colors.white70, fontSize: 12)),
                      Text(
                        'Day ${myAlloc['allocation_day']} of ${DateFormat('MMMM yyyy').format(_selectedMonth)}',
                        style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 16),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
        const Text('All Members',
            style: TextStyle(
                color: Colors.white38,
                fontSize: 11,
                fontWeight: FontWeight.bold,
                letterSpacing: 1)),
        const SizedBox(height: 8),
        ..._allocations.asMap().entries.map((entry) {
          final i = entry.key;
          final a = entry.value;
          final user = a['user'] as Map<String, dynamic>?;
          final name =
              '${user?['first_name'] ?? ''} ${user?['last_name'] ?? ''}'.trim();
          final day = a['allocation_day'] as int? ?? 0;
          final isMe = a['user_id'] == _myUserId;

          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: isMe
                  ? const Color(0xFF00C853).withValues(alpha: 0.08)
                  : const Color(0xFF1e293b),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: isMe
                    ? const Color(0xFF00C853).withValues(alpha: 0.3)
                    : Colors.white10,
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: isMe
                        ? const Color(0xFF00C853).withValues(alpha: 0.15)
                        : Colors.white.withValues(alpha: 0.05),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Text(
                      '${i + 1}',
                      style: TextStyle(
                        color: isMe ? const Color(0xFF00C853) : Colors.white38,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name.isEmpty ? 'Member' : name,
                        style: TextStyle(
                          color: isMe ? const Color(0xFF00C853) : Colors.white,
                          fontWeight:
                              isMe ? FontWeight.bold : FontWeight.normal,
                        ),
                      ),
                      if (isMe)
                        const Text('You',
                            style: TextStyle(
                                color: Color(0xFF00C853), fontSize: 11)),
                    ],
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                  decoration: BoxDecoration(
                    color: isMe
                        ? const Color(0xFF00C853).withValues(alpha: 0.15)
                        : Colors.blue.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    'Day $day',
                    style: TextStyle(
                      color: isMe ? const Color(0xFF00C853) : Colors.blue,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
          );
        }),
      ],
    );
  }

  Widget _buildRequestsTab() {
    if (_swapRequests.isEmpty) {
      return _emptyState(
        icon: Icons.swap_horiz,
        title: 'No swap requests',
        subtitle: 'Tap "Request Swap" to exchange your allocation day.',
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
      children: _swapRequests.map((s) {
        final requester = s['requester'] as Map<String, dynamic>?;
        final target = s['target'] as Map<String, dynamic>?;
        final status = (s['status'] ?? 'pending') as String;
        final isMyRequest = s['requester_id'] == _myUserId;
        final isTargeted = s['target_user_id'] == _myUserId;

        Color statusColor;
        IconData statusIcon;
        switch (status) {
          case 'approved':
            statusColor = const Color(0xFF00C853);
            statusIcon = Icons.check_circle;
            break;
          case 'rejected':
            statusColor = Colors.red;
            statusIcon = Icons.cancel;
            break;
          case 'cancelled':
            statusColor = Colors.grey;
            statusIcon = Icons.remove_circle;
            break;
          default:
            statusColor = Colors.orange;
            statusIcon = Icons.pending;
        }

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: const Color(0xFF1e293b),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isTargeted && status == 'pending'
                  ? Colors.orange.withValues(alpha: 0.4)
                  : Colors.white10,
            ),
          ),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    // Requester
                    Expanded(
                      child: Column(
                        children: [
                          CircleAvatar(
                            radius: 20,
                            backgroundColor:
                                Colors.blue.withValues(alpha: 0.15),
                            child: Text(
                              _initial(requester),
                              style: const TextStyle(
                                  color: Colors.blue,
                                  fontWeight: FontWeight.bold),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            _fullName(requester),
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 12,
                                fontWeight: FontWeight.bold),
                            textAlign: TextAlign.center,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            'Day ${s['requester_day'] ?? '-'}',
                            style: const TextStyle(
                                color: Colors.white54, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                    // Arrow
                    Column(
                      children: [
                        Icon(Icons.swap_horiz, color: statusColor, size: 28),
                        const SizedBox(height: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: statusColor.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(statusIcon, color: statusColor, size: 10),
                              const SizedBox(width: 4),
                              Text(
                                status.toUpperCase(),
                                style: TextStyle(
                                    color: statusColor,
                                    fontSize: 9,
                                    fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    // Target
                    Expanded(
                      child: Column(
                        children: [
                          CircleAvatar(
                            radius: 20,
                            backgroundColor:
                                Colors.purple.withValues(alpha: 0.15),
                            child: Text(
                              _initial(target),
                              style: const TextStyle(
                                  color: Colors.purple,
                                  fontWeight: FontWeight.bold),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            _fullName(target),
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 12,
                                fontWeight: FontWeight.bold),
                            textAlign: TextAlign.center,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            'Day ${s['target_day'] ?? '-'}',
                            style: const TextStyle(
                                color: Colors.white54, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              // Action buttons for targeted user
              if (isTargeted && status == 'pending') ...[
                const Divider(height: 1, color: Colors.white10),
                Row(
                  children: [
                    Expanded(
                      child: TextButton(
                        onPressed: _actingSwapId == s['id']
                            ? null
                            : () => _respondSwap(s['id'] as String, false),
                        child: Text(
                          _actingSwapId == s['id'] ? 'Working...' : 'Decline',
                          style: const TextStyle(color: Colors.red),
                        ),
                      ),
                    ),
                    Container(width: 1, height: 40, color: Colors.white10),
                    Expanded(
                      child: TextButton(
                        onPressed: _actingSwapId == s['id']
                            ? null
                            : () => _respondSwap(s['id'] as String, true),
                        child: Text(
                          _actingSwapId == s['id'] ? 'Working...' : 'Accept',
                          style: const TextStyle(
                            color: Color(0xFF00C853),
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
              if (isMyRequest && status == 'pending') ...[
                const Divider(height: 1, color: Colors.white10),
                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Waiting for ${_fullName(target)} to respond',
                          style: const TextStyle(
                              color: Colors.white38, fontSize: 12),
                        ),
                      ),
                      TextButton(
                        onPressed: _actingSwapId == s['id']
                            ? null
                            : () => _cancelSwap(s['id'] as String),
                        child: Text(
                          _actingSwapId == s['id'] ? 'Working...' : 'Cancel',
                          style: const TextStyle(
                              color: Colors.redAccent,
                              fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        );
      }).toList(),
    );
  }

  Future<void> _respondSwap(String swapId, bool accept) async {
    setState(() => _actingSwapId = swapId);
    try {
      if (accept) {
        await ref.read(chamaServiceProvider).approveSwap(swapId);
        _snack('Swap accepted!', success: true);
      } else {
        await ref.read(chamaServiceProvider).rejectSwap(swapId);
        _snack('Swap declined.', success: true);
      }
      _loadData();
    } catch (e) {
      _snack(_errorText(e));
    } finally {
      if (mounted) setState(() => _actingSwapId = null);
    }
  }

  Future<void> _cancelSwap(String swapId) async {
    setState(() => _actingSwapId = swapId);
    try {
      await ref.read(chamaServiceProvider).cancelSwap(swapId);
      _snack('Swap request cancelled.', success: true);
      _loadData();
    } catch (e) {
      _snack(_errorText(e));
    } finally {
      if (mounted) setState(() => _actingSwapId = null);
    }
  }

  String _errorText(Object error) {
    return error.toString().replaceFirst('Exception: ', '');
  }

  String _initial(Map<String, dynamic>? user) {
    final name = '${user?['first_name'] ?? ''}';
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
  }

  String _fullName(Map<String, dynamic>? user) {
    final name =
        '${user?['first_name'] ?? ''} ${user?['last_name'] ?? ''}'.trim();
    return name.isEmpty ? 'Member' : name;
  }

  Widget _emptyState({
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: Colors.white12, size: 64),
            const SizedBox(height: 16),
            Text(title,
                style: const TextStyle(
                    color: Colors.white54,
                    fontSize: 16,
                    fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text(subtitle,
                style: const TextStyle(color: Colors.white38, fontSize: 13),
                textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}
