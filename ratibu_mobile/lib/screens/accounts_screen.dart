import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../providers/auth_provider.dart';
import '../services/mpesa_service.dart';
import '../services/transaction_authorization_service.dart';

class AccountsScreen extends ConsumerStatefulWidget {
  const AccountsScreen({super.key});

  @override
  ConsumerState<AccountsScreen> createState() => _AccountsScreenState();
}

class _AccountsScreenState extends ConsumerState<AccountsScreen> {
  bool _loading = true;
  List<Map<String, dynamic>> _chamas = [];
  List<Map<String, dynamic>> _savingsTargets = [];
  String? _mshwariPhone;
  double _totalBalance = 0;
  final _transactionAuthorizationService = TransactionAuthorizationService();

  final _fmt = NumberFormat('#,##0');

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final supabase = Supabase.instance.client;
      final user = supabase.auth.currentUser;
      if (user == null) return;

      // Chamas with balance + member count
      final chamaRows = await supabase
          .from('chama_members')
          .select('role, status, chamas(id, name, description, balance, contribution_amount, contribution_frequency, total_members, status)')
          .eq('user_id', user.id)
          .eq('status', 'active');

      final chamaIds = (chamaRows as List)
          .map((row) => (row['chamas'] as Map?)?['id'] as String?)
          .whereType<String>()
          .toList();

      final Map<String, int> memberCounts = {};
      if (chamaIds.isNotEmpty) {
        final countRows = await supabase
            .from('chama_members')
            .select('chama_id')
            .inFilter('chama_id', chamaIds)
            .eq('status', 'active');
        for (final row in countRows as List) {
          final chamaId = row['chama_id'] as String?;
          if (chamaId != null) {
            memberCounts[chamaId] = (memberCounts[chamaId] ?? 0) + 1;
          }
        }
      }

      // User's total contributed per chama
      final txRows = await supabase
          .from('transactions')
          .select('chama_id, amount')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .eq('type', 'deposit');

      // Savings targets
      final savingsRows = await supabase
          .from('user_savings_targets')
          .select('id, name, purpose, current_amount, target_amount, status, allocation_type, allocation_value')
          .eq('user_id', user.id)
          .order('created_at', ascending: false);

      // Profile
      final profile = await supabase
          .from('users')
          .select('mshwari_phone')
          .eq('id', user.id)
          .maybeSingle();

      // Compute per-chama contribution totals
      final Map<String, double> contributed = {};
      for (final tx in txRows as List) {
        final cid = tx['chama_id'] as String?;
        if (cid != null) {
          contributed[cid] = (contributed[cid] ?? 0) + (tx['amount'] as num).toDouble();
        }
      }

      final chamas = (chamaRows as List).map((r) {
        final c = Map<String, dynamic>.from(r['chamas'] as Map);
        c['my_role'] = r['role'];
        c['my_contributed'] = contributed[c['id']] ?? 0.0;
        c['total_members'] = memberCounts[c['id']] ?? c['total_members'] ?? 0;
        return c;
      }).toList();

      double total = 0;
      for (final c in chamas) {
        total += (c['balance'] as num? ?? 0).toDouble();
      }

      setState(() {
        _chamas = chamas;
        _savingsTargets = List<Map<String, dynamic>>.from(savingsRows);
        _mshwariPhone = profile?['mshwari_phone'] as String?;
        _totalBalance = total;
      });
    } catch (e) {
      debugPrint('Error loading accounts: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  // ── Mshwari ──────────────────────────────────────────────────────────────

  void _showMshwariSetup() {
    final ctrl = TextEditingController(text: _mshwariPhone ?? '');
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1e293b),
        title: const Text('Link Mshwari Account', style: TextStyle(color: Colors.white)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Enter the phone number linked to your Mshwari account. Deposits go to paybill 512400 using this number as the account reference.',
              style: TextStyle(color: Colors.white60, fontSize: 13),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: ctrl,
              keyboardType: TextInputType.phone,
              style: const TextStyle(color: Colors.white),
              decoration: _inputDec('Mshwari Phone (07XX or 254XX)'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: Colors.white54))),
          TextButton(
            onPressed: () async {
              final phone = ctrl.text.trim();
              if (phone.isEmpty) return;
              Navigator.pop(ctx);
              await _saveMshwariPhone(phone);
            },
            child: const Text('Save', style: TextStyle(color: Color(0xFF00C853))),
          ),
        ],
      ),
    );
  }

  Future<void> _saveMshwariPhone(String phone) async {
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) return;
      await Supabase.instance.client
          .from('users').update({'mshwari_phone': phone}).eq('id', user.id);
      setState(() => _mshwariPhone = phone);
      if (mounted) _snack('Mshwari account linked!', success: true);
    } catch (e) {
      if (mounted) _snack('Failed: $e');
    }
  }

  void _showMshwariDeposit() {
    if (_mshwariPhone == null || _mshwariPhone!.isEmpty) {
      _showMshwariSetup();
      return;
    }
    _showAmountDialog('Mshwari (${_mshwariPhone!})', (amount) async {
      final approved = await _transactionAuthorizationService.confirmTransaction(
        context,
        actionLabel: 'deposit',
        amount: amount,
      );
      if (!approved) return;
      final userId = ref.read(authProvider).mapState(authenticated: (s) => s.user.id);
      if (userId == null) return;
      final profile = await Supabase.instance.client
          .from('users').select('phone').eq('id', userId).maybeSingle();
      final payingPhone = profile?['phone'] as String? ?? _mshwariPhone!;
      await MpesaService().initiateStkPush(
        phoneNumber: payingPhone,
        amount: amount,
        userId: userId,
        destinationType: 'mshwari',
        mshwariPhone: _mshwariPhone!,
      );
      if (mounted) _snack('STK Push sent! Enter your M-Pesa PIN.', success: true);
    });
  }

  // ── Dialogs ───────────────────────────────────────────────────────────────

  void _showAmountDialog(String label, Future<void> Function(double) onConfirm) {
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1e293b),
        title: Text('Deposit to $label', style: const TextStyle(color: Colors.white)),
        content: TextField(
          controller: ctrl,
          keyboardType: TextInputType.number,
          style: const TextStyle(color: Colors.white),
          decoration: _inputDec('Amount (KES)'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: Colors.white54))),
          TextButton(
            onPressed: () async {
              final amount = double.tryParse(ctrl.text.trim());
              if (amount == null || amount <= 0) return;
              Navigator.pop(ctx);
              try {
                await onConfirm(amount);
              } catch (e) {
                if (mounted) _snack('Failed: $e');
              }
            },
            child: const Text('Continue', style: TextStyle(color: Color(0xFF00C853))),
          ),
        ],
      ),
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  void _snack(String msg, {bool success = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: success ? const Color(0xFF00C853) : Colors.red,
    ));
  }

  InputDecoration _inputDec(String label) => InputDecoration(
    labelText: label,
    labelStyle: const TextStyle(color: Colors.white60),
    filled: true,
    fillColor: const Color(0xFF0f172a),
    enabledBorder: OutlineInputBorder(
      borderSide: const BorderSide(color: Colors.white24),
      borderRadius: BorderRadius.circular(12),
    ),
    focusedBorder: OutlineInputBorder(
      borderSide: const BorderSide(color: Color(0xFF00C853)),
      borderRadius: BorderRadius.circular(12),
    ),
  );

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      appBar: AppBar(
        title: const Text('Accounts'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF00C853)))
          : RefreshIndicator(
              onRefresh: _load,
              color: const Color(0xFF00C853),
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // ── Total balance banner ──────────────────────────────
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF00C853), Color(0xFF009624)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Total Chama Balance',
                            style: TextStyle(color: Colors.white70, fontSize: 13)),
                        const SizedBox(height: 4),
                        Text('KES ${_fmt.format(_totalBalance)}',
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 28,
                                fontWeight: FontWeight.w900)),
                        const SizedBox(height: 4),
                        Text('Across ${_chamas.length} active chama${_chamas.length == 1 ? '' : 's'}',
                            style: const TextStyle(color: Colors.white60, fontSize: 12)),
                      ],
                    ),
                  ),

                  const SizedBox(height: 12),

                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () => context.push('/statement?accountType=all&accountName=All+Transactions'),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Color(0xFF00C853)),
                        foregroundColor: const Color(0xFF00C853),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      icon: const Icon(Icons.receipt_long),
                      label: const Text('View Full Statement'),
                    ),
                  ),

                  const SizedBox(height: 24),

                  // ── Chama Accounts ────────────────────────────────────
                  _SectionHeader(
                    title: 'Chama Accounts',
                    icon: Icons.group,
                    action: TextButton.icon(
                      onPressed: () => context.push('/create-chama'),
                      icon: const Icon(Icons.add, size: 16, color: Color(0xFF00C853)),
                      label: const Text('New', style: TextStyle(color: Color(0xFF00C853), fontSize: 12)),
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (_chamas.isEmpty)
                    _EmptyCard(
                      message: 'You haven\'t joined any chamas yet.',
                      actionLabel: 'Explore Chamas',
                      onAction: () => context.push('/join-chama'),
                    )
                  else
                    ..._chamas.map((c) => _ChamaCard(
                          chama: c,
                          fmt: _fmt,
                          onDeposit: () => context.push('/chama/${c['id']}/deposit'),
                          onView: () => context.push('/chama/${c['id']}'),
                          onStatement: () => context.push(
                            '/statement?accountType=chama&accountId=${c['id']}&accountName=${Uri.encodeComponent(c['name'] ?? 'Chama')}',
                          ),
                        )),

                  const SizedBox(height: 24),

                  // ── Savings Accounts ──────────────────────────────────
                  _SectionHeader(
                    title: 'Savings Plans',
                    icon: Icons.savings,
                    action: TextButton.icon(
                      onPressed: () => context.push('/personal-savings'),
                      icon: const Icon(Icons.add, size: 16, color: Color(0xFF00C853)),
                      label: const Text('New', style: TextStyle(color: Color(0xFF00C853), fontSize: 12)),
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (_savingsTargets.isEmpty)
                    _EmptyCard(
                      message: 'No savings plans yet.',
                      actionLabel: 'Create a Plan',
                      onAction: () => context.push('/personal-savings'),
                    )
                  else
                    ..._savingsTargets.map((t) => _SavingsCard(
                          target: t,
                          fmt: _fmt,
                          onDeposit: () => _showAmountDialog(
                            t['name'] ?? 'Savings',
                            (amount) async => context.push(
                                '/deposit?savingsTargetId=${t['id']}&amount=${amount.toStringAsFixed(0)}'),
                          ),
                          onView: () => context.push('/personal-savings'),
                          onStatement: () => context.push(
                            '/statement?accountType=savings_target&accountId=${t['id']}&accountName=${Uri.encodeComponent(t['name'] ?? 'Savings')}',
                          ),
                        )),

                  const SizedBox(height: 24),

                  // ── Mshwari ───────────────────────────────────────────
                  _SectionHeader(title: 'M-Pesa Mshwari', icon: Icons.account_balance),
                  const SizedBox(height: 8),
                  _MshwariCard(
                    phone: _mshwariPhone,
                    onDeposit: _showMshwariDeposit,
                    onSetup: _showMshwariSetup,
                    onStatement: () => context.push('/statement?accountType=mshwari&accountName=Mshwari+Savings'),
                  ),

                  const SizedBox(height: 24),
                ],
              ),
            ),
    );
  }
}

// ── Chama Card ────────────────────────────────────────────────────────────────

class _ChamaCard extends StatelessWidget {
  final Map<String, dynamic> chama;
  final NumberFormat fmt;
  final VoidCallback onDeposit;
  final VoidCallback onView;
  final VoidCallback onStatement;

  const _ChamaCard({
    required this.chama,
    required this.fmt,
    required this.onDeposit,
    required this.onView,
    required this.onStatement,
  });

  @override
  Widget build(BuildContext context) {
    final balance = (chama['balance'] as num? ?? 0).toDouble();
    final contributed = (chama['my_contributed'] as num? ?? 0).toDouble();
    final members = chama['total_members'] as int? ?? 0;
    final role = chama['my_role'] as String? ?? 'member';
    final freq = chama['contribution_frequency'] as String?;
    final contribAmount = chama['contribution_amount'] as num?;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF1e293b),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.blue.withValues(alpha: 0.12),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.group, color: Colors.blue, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(chama['name'] ?? 'Chama',
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 15)),
                          Text('$members member${members == 1 ? '' : 's'} · ${role == 'admin' ? 'Admin' : role == 'treasurer' ? 'Treasurer' : 'Member'}',
                              style: const TextStyle(color: Colors.white54, fontSize: 12)),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF00C853).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        chama['status'] == 'active' ? 'Active' : (chama['status'] ?? 'Active'),
                        style: const TextStyle(color: Color(0xFF00C853), fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(child: _Stat(label: 'Pool Balance', value: 'KES ${fmt.format(balance)}')),
                    Expanded(child: _Stat(label: 'My Contributions', value: 'KES ${fmt.format(contributed)}')),
                    if (contribAmount != null)
                      Expanded(child: _Stat(
                        label: freq ?? 'Contribution',
                        value: 'KES ${fmt.format(contribAmount)}',
                      )),
                  ],
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Colors.white10),
          Row(
            children: [
              Expanded(
                child: TextButton(
                  onPressed: onView,
                  child: const Text('View Details', style: TextStyle(color: Colors.white54)),
                ),
              ),
              Container(width: 1, height: 40, color: Colors.white10),
              Expanded(
                child: TextButton(
                  onPressed: onStatement,
                  child: const Text('Statement', style: TextStyle(color: Colors.white54)),
                ),
              ),
              Container(width: 1, height: 40, color: Colors.white10),
              Expanded(
                child: TextButton(
                  onPressed: onDeposit,
                  child: const Text('Deposit', style: TextStyle(color: Color(0xFF00C853), fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Savings Card ──────────────────────────────────────────────────────────────

class _SavingsCard extends StatelessWidget {
  final Map<String, dynamic> target;
  final NumberFormat fmt;
  final VoidCallback onDeposit;
  final VoidCallback onView;
  final VoidCallback onStatement;

  const _SavingsCard({
    required this.target,
    required this.fmt,
    required this.onDeposit,
    required this.onView,
    required this.onStatement,
  });

  @override
  Widget build(BuildContext context) {
    final current = (target['current_amount'] as num? ?? 0).toDouble();
    final total = (target['target_amount'] as num? ?? 0).toDouble();
    final progress = total > 0 ? (current / total).clamp(0.0, 1.0) : 0.0;
    final status = target['status'] as String? ?? 'active';
    final isActive = status == 'active';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF1e293b),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFF00C853).withValues(alpha: 0.12),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.track_changes, color: Color(0xFF00C853), size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(target['name'] ?? 'Savings Plan',
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                          Text(target['purpose'] ?? '',
                              style: const TextStyle(color: Colors.white54, fontSize: 12)),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: (isActive ? Colors.green : Colors.orange).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        isActive ? 'Active' : status[0].toUpperCase() + status.substring(1),
                        style: TextStyle(
                            color: isActive ? Colors.green : Colors.orange,
                            fontSize: 11,
                            fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('KES ${fmt.format(current)}',
                        style: const TextStyle(color: Colors.white54, fontSize: 13)),
                    Text('KES ${fmt.format(total)}',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                  ],
                ),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(99),
                  child: LinearProgressIndicator(
                    value: progress,
                    minHeight: 8,
                    backgroundColor: Colors.white12,
                    valueColor: const AlwaysStoppedAnimation(Color(0xFF00C853)),
                  ),
                ),
                const SizedBox(height: 4),
                Text('${(progress * 100).toStringAsFixed(0)}% of target',
                    style: const TextStyle(color: Colors.white38, fontSize: 11)),
              ],
            ),
          ),
          const Divider(height: 1, color: Colors.white10),
          Row(
            children: [
              Expanded(
                child: TextButton(
                  onPressed: onView,
                  child: const Text('Manage', style: TextStyle(color: Colors.white54)),
                ),
              ),
              Container(width: 1, height: 40, color: Colors.white10),
              Expanded(
                child: TextButton(
                  onPressed: onStatement,
                  child: const Text('Statement', style: TextStyle(color: Colors.white54)),
                ),
              ),
              Container(width: 1, height: 40, color: Colors.white10),
              Expanded(
                child: TextButton(
                  onPressed: isActive ? onDeposit : null,
                  child: Text('Deposit',
                      style: TextStyle(
                          color: isActive ? const Color(0xFF00C853) : Colors.white24,
                          fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Mshwari Card ──────────────────────────────────────────────────────────────

class _MshwariCard extends StatelessWidget {
  final String? phone;
  final VoidCallback onDeposit;
  final VoidCallback onSetup;
  final VoidCallback onStatement;

  const _MshwariCard({required this.phone, required this.onDeposit, required this.onSetup, required this.onStatement});

  @override
  Widget build(BuildContext context) {
    final linked = phone != null && phone!.isNotEmpty;
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1e293b),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.teal.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.account_balance, color: Colors.teal, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Mshwari Savings',
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                      Text(
                        linked ? 'Linked: $phone · Paybill 512400' : 'Tap "Set Up" to link your Mshwari phone',
                        style: const TextStyle(color: Colors.white54, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: (linked ? Colors.green : Colors.orange).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    linked ? 'Linked' : 'Setup',
                    style: TextStyle(
                        color: linked ? Colors.green : Colors.orange,
                        fontSize: 11,
                        fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Colors.white10),
          Row(
            children: [
              Expanded(
                child: TextButton(
                  onPressed: onSetup,
                  child: Text(linked ? 'Change Phone' : 'Set Up',
                      style: const TextStyle(color: Colors.white54)),
                ),
              ),
              Container(width: 1, height: 40, color: Colors.white10),
              Expanded(
                child: TextButton(
                  onPressed: onStatement,
                  child: const Text('Statement', style: TextStyle(color: Colors.white54)),
                ),
              ),
              Container(width: 1, height: 40, color: Colors.white10),
              Expanded(
                child: TextButton(
                  onPressed: onDeposit,
                  child: Text(
                    linked ? 'Deposit' : 'Set Up & Deposit',
                    style: const TextStyle(color: Color(0xFF00C853), fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Shared widgets ────────────────────────────────────────────────────────────

class _Stat extends StatelessWidget {
  final String label;
  final String value;
  const _Stat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.white38, fontSize: 10)),
        const SizedBox(height: 2),
        Text(value,
            style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
            overflow: TextOverflow.ellipsis),
      ],
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final IconData icon;
  final Widget? action;
  const _SectionHeader({required this.title, required this.icon, this.action});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: Colors.white54, size: 16),
        const SizedBox(width: 8),
        Text(title,
            style: const TextStyle(
                color: Colors.white54, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1)),
        const Spacer(),
        if (action != null) action!,
      ],
    );
  }
}

class _EmptyCard extends StatelessWidget {
  final String message;
  final String actionLabel;
  final VoidCallback onAction;
  const _EmptyCard({required this.message, required this.actionLabel, required this.onAction});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1e293b),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        children: [
          Text(message, style: const TextStyle(color: Colors.white54)),
          const SizedBox(height: 12),
          ElevatedButton(
            onPressed: onAction,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF00C853),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              elevation: 0,
            ),
            child: Text(actionLabel),
          ),
        ],
      ),
    );
  }
}
