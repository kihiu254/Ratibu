import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../providers/auth_provider.dart';
import '../providers/chama_provider.dart';
import '../providers/profile_provider.dart';
import '../services/transaction_service.dart';
import 'tabs/chamas_tab.dart';
import 'tabs/dashboard_tab.dart';
import 'profile_screen.dart';

final transactionServiceProvider = Provider((ref) => TransactionService());

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  int _selectedIndex = 0;

  @override
  void initState() {
    super.initState();
    _checkKyc();
  }

  void _checkKyc() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final kycAsync = ref.read(userProfileProvider);
      kycAsync.whenData((profile) {
        if (profile != null && profile['kyc_status'] == 'pending') {
          context.go('/onboarding-success');
        }
      });
    });
  }

  static const List<Widget> _pages = <Widget>[
    ActivitiesTab(),
    ChamasTab(),
    DashboardTab(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      drawer: Drawer(
        backgroundColor: const Color(0xFF0f172a),
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            const DrawerHeader(
              decoration: BoxDecoration(color: Color(0xFF1e293b)),
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.dashboard, color: Color(0xFF00C853), size: 48),
                    SizedBox(height: 12),
                    Text('Explore Ratibu',
                        style: TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
            ),
            _drawerItem(context, Icons.account_balance_wallet, 'Accounts', '/accounts', Colors.teal),
            _drawerItem(context, Icons.savings, 'Personal Savings', '/personal-savings', Colors.greenAccent),
            _drawerItem(context, Icons.explore, 'Explore Chamas', '/join-chama', Colors.cyan),
            _drawerItem(context, Icons.event, 'Meetings', '/meetings', Colors.lightBlue),
            _drawerItem(context, Icons.swap_horiz, 'Swaps', '/swaps', Colors.white70),
            _drawerItem(context, Icons.emoji_events, 'Rewards', '/rewards', Colors.amber),
            _drawerItem(context, Icons.gavel, 'Penalties', '/penalties', Colors.orange),
            const Divider(color: Colors.white10),
            _drawerItem(context, Icons.inventory_2, 'Products', '/products', Colors.blue),
            _drawerItem(context, Icons.rocket_launch, 'Opportunities', '/opportunities', Colors.green),
            _drawerItem(context, Icons.star, 'Features', '/features', Colors.amber),
            _drawerItem(context, Icons.payments, 'Pricing', '/pricing', Colors.purple),
            const Divider(color: Colors.white10),
            _drawerItem(context, Icons.admin_panel_settings, 'Privacy Policy', '/legal/Privacy%20Policy', Colors.white38),
            _drawerItem(context, Icons.gavel, 'Terms of Service', '/legal/Terms%20of%20Service', Colors.white38),
            _drawerItem(context, Icons.cookie, 'Cookie Policy', '/legal/Cookie%20Policy', Colors.white38),
          ],
        ),
      ),
      body: SafeArea(child: _pages.elementAt(_selectedIndex)),
      bottomNavigationBar: BottomNavigationBar(
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.group), label: 'Chamas'),
          BottomNavigationBarItem(icon: Icon(Icons.dashboard), label: 'Dashboard'),
          BottomNavigationBarItem(icon: Icon(Icons.person), label: 'Profile'),
        ],
        currentIndex: _selectedIndex,
        selectedItemColor: const Color(0xFF00C853),
        unselectedItemColor: Colors.grey,
        backgroundColor: const Color(0xFF1e293b),
        type: BottomNavigationBarType.fixed,
        onTap: (i) => setState(() => _selectedIndex = i),
      ),
    );
  }

  Widget _drawerItem(BuildContext context, IconData icon, String title, String route, Color color) {
    return ListTile(
      leading: Icon(icon, color: color),
      title: Text(title, style: const TextStyle(color: Colors.white)),
      onTap: () {
        Navigator.pop(context);
        context.push(route);
      },
    );
  }
}

class ActivitiesTab extends ConsumerStatefulWidget {
  const ActivitiesTab({super.key});

  @override
  ConsumerState<ActivitiesTab> createState() => _ActivitiesTabState();
}

class _ActivitiesTabState extends ConsumerState<ActivitiesTab> {
  late Future<Map<String, dynamic>> _future;
  Stream<List<Map<String, dynamic>>>? _unreadNotificationsStream;

  @override
  void initState() {
    super.initState();
    _future = _fetchDashboardData();
    final userId = Supabase.instance.client.auth.currentUser?.id;
    if (userId != null) {
      _unreadNotificationsStream = Supabase.instance.client
          .from('notifications')
          .stream(primaryKey: ['id'])
          .eq('user_id', userId)
          .order('created_at', ascending: false);
    }
  }

  Future<Map<String, dynamic>> _fetchDashboardData() async {
    final supabase = Supabase.instance.client;
    final user = supabase.auth.currentUser;
    if (user == null) return {};

    final activeChamasResponse = await supabase
        .from('chama_members')
        .count(CountOption.exact)
        .eq('user_id', user.id)
        .eq('status', 'active');

    final pendingResponse = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', user.id)
        .eq('status', 'pending');

    double pendingPayments = 0;
    for (var r in pendingResponse) {
      pendingPayments += (r['amount'] as num).toDouble();
    }

    final recentTransactions = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', ascending: false)
        .limit(5);

    final allTransactions = await supabase
        .from('transactions')
        .select('amount, type')
        .eq('user_id', user.id)
        .eq('status', 'completed');

    double totalBalance = 0;
    for (var tx in allTransactions) {
      if (tx['type'] == 'deposit') totalBalance += (tx['amount'] as num).toDouble();
      if (tx['type'] == 'withdrawal') totalBalance -= (tx['amount'] as num).toDouble();
    }

    // Fetch display name from users table
    final profile = await supabase
        .from('users')
        .select('first_name, last_name')
        .eq('id', user.id)
        .maybeSingle();

    final firstName = profile?['first_name'] ?? '';
    final lastName = profile?['last_name'] ?? '';
    final displayName = firstName.isNotEmpty
        ? '$firstName $lastName'.trim()
        : user.email ?? 'User';

    return {
      'totalBalance': totalBalance,
      'activeChamas': activeChamasResponse,
      'pendingPayments': pendingPayments,
      'recentTransactions': recentTransactions,
      'displayName': displayName,
    };
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        final isLoading = snapshot.connectionState == ConnectionState.waiting;
        final data = snapshot.data ?? {};
        final totalBalance = data['totalBalance'] ?? 0.0;
        final activeChamas = data['activeChamas'] ?? 0;
        final pendingPayments = data['pendingPayments'] ?? 0.0;
        final recentTransactions = data['recentTransactions'] as List<dynamic>? ?? [];
        final displayName = data['displayName'] ?? 'User';

        return RefreshIndicator(
          onRefresh: () async {
            await ref.read(authProvider.notifier).refreshUser();
            if (!mounted) return;
            setState(() => _future = _fetchDashboardData());
          },
          color: const Color(0xFF00C853),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16.0),
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Hello,',
                            style: TextStyle(color: Colors.grey[400], fontSize: 16)),
                        Text(
                          displayName,
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.bold),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  Stack(
                    clipBehavior: Clip.none,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.notifications, color: Colors.white),
                        onPressed: () => context.push('/notifications'),
                      ),
                      if (_unreadNotificationsStream != null)
                        Positioned(
                          right: 6,
                          top: 6,
                          child: StreamBuilder<List<Map<String, dynamic>>>(
                            stream: _unreadNotificationsStream,
                            builder: (context, snapshot) {
                              final unreadCount = (snapshot.data ?? [])
                                  .where((item) => item['is_read'] == false)
                                  .length;
                              if (unreadCount == 0) return const SizedBox.shrink();

                              return Container(
                                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                                decoration: BoxDecoration(
                                  color: Colors.redAccent,
                                  borderRadius: BorderRadius.circular(999),
                                  border: Border.all(color: const Color(0xFF0f172a), width: 1.5),
                                ),
                                child: Text(
                                  unreadCount > 9 ? '9+' : '$unreadCount',
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: _StatCard(
                      title: 'Total Balance',
                      value: 'KES ${NumberFormat("#,##0").format(totalBalance)}',
                      icon: Icons.account_balance_wallet,
                      color: Colors.green,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _StatCard(
                      title: 'Active Chamas',
                      value: '$activeChamas',
                      icon: Icons.group,
                      color: Colors.blue,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _StatCard(
                title: 'Pending Payments',
                value: 'KES ${NumberFormat("#,##0").format(pendingPayments)}',
                icon: Icons.pending_actions,
                color: Colors.orange,
                fullWidth: true,
              ),
              const SizedBox(height: 24),
              const Text('Quick Actions',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              Wrap(
                spacing: 20,
                runSpacing: 16,
                alignment: WrapAlignment.spaceAround,
                children: [
                  _ActionButton(icon: Icons.add, label: 'Deposit', onTap: () => context.push('/accounts')),
                  _ActionButton(
                      icon: Icons.arrow_outward,
                      label: 'Withdraw',
                      onTap: () => _showWithdrawDialog(context, ref)),
                  _ActionButton(
                      icon: Icons.account_balance_wallet,
                      label: 'Accounts',
                      onTap: () => context.push('/accounts')),
                  _ActionButton(
                      icon: Icons.savings,
                      label: 'Savings',
                      onTap: () => context.push('/personal-savings')),
                  _ActionButton(
                      icon: Icons.explore,
                      label: 'Explore',
                      onTap: () => context.push('/join-chama')),
                  _ActionButton(
                      icon: Icons.event,
                      label: 'Meetings',
                      onTap: () => context.push('/meetings')),
                  _ActionButton(
                      icon: Icons.swap_horiz,
                      label: 'Swaps',
                      onTap: () => context.push('/swaps')),
                  _ActionButton(
                      icon: Icons.emoji_events,
                      label: 'Rewards',
                      onTap: () => context.push('/rewards')),
                  _ActionButton(
                      icon: Icons.gavel,
                      label: 'Penalties',
                      onTap: () => context.push('/penalties')),
                ],
              ),
              const SizedBox(height: 24),
              const Text('Recent Transactions',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              if (isLoading)
                const Center(
                    child: Padding(
                  padding: EdgeInsets.all(20.0),
                  child: CircularProgressIndicator(color: Color(0xFF00C853)),
                ))
              else if (recentTransactions.isEmpty)
                Container(
                  padding: const EdgeInsets.all(32),
                  alignment: Alignment.center,
                  child: const Column(
                    children: [
                      Icon(Icons.history, color: Colors.white24, size: 48),
                      SizedBox(height: 16),
                      Text('No recent activity',
                          style: TextStyle(color: Colors.white54)),
                    ],
                  ),
                )
              else
                Column(
                  children: recentTransactions
                      .map((tx) => _TransactionItem(
                            title: tx['description'] ??
                                tx['type'].toString().toUpperCase(),
                            date: DateFormat.yMMMd()
                                .add_jm()
                                .format(DateTime.parse(tx['created_at'])),
                            amount:
                                '${tx['type'] == 'withdrawal' ? '-' : '+'} KES ${NumberFormat("#,##0").format(tx['amount'])}',
                            isNegative: tx['type'] == 'withdrawal',
                          ))
                      .toList(),
                ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _showDepositDialog() async {
    try {
      final chamas = await ref.read(chamaServiceProvider).getMyChamas();
      if (!mounted) return;
      if (chamas.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No chamas found. Join or create one first.')),
        );
        return;
      }
      String? selectedChamaId;
      showDialog(
        context: context,
        builder: (context) => StatefulBuilder(
          builder: (context, setS) => AlertDialog(
            backgroundColor: const Color(0xFF1e293b),
            title: const Text('Select Chama', style: TextStyle(color: Colors.white)),
            content: ConstrainedBox(
              constraints: const BoxConstraints(minWidth: 280),
              child: DropdownButtonFormField<String>(
                dropdownColor: const Color(0xFF0f172a),
                isExpanded: true,
                value: selectedChamaId,
                hint: const Text('Choose a chama',
                    style: TextStyle(color: Colors.white54)),
                style: const TextStyle(color: Colors.white),
                items: chamas
                    .map((c) => DropdownMenuItem(
                          value: c['id'] as String,
                          child: Text(c['name'] ?? 'Chama',
                              style: const TextStyle(color: Colors.white),
                              overflow: TextOverflow.ellipsis),
                        ))
                    .toList(),
                onChanged: (val) => setS(() => selectedChamaId = val),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel', style: TextStyle(color: Colors.white54)),
              ),
              TextButton(
                onPressed: selectedChamaId == null
                    ? null
                    : () {
                        Navigator.pop(context);
                        context.push('/chama/$selectedChamaId/deposit');
                      },
                child: const Text('Continue',
                    style: TextStyle(color: Color(0xFF00C853))),
              ),
            ],
          ),
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Failed to load chamas: $e')));
      }
    }
  }

  void _showWithdrawDialog(BuildContext context, WidgetRef ref) async {
    final amountController = TextEditingController();
    final reasonController = TextEditingController();
    String? selectedChamaId;
    final chamas = await ref.read(chamaServiceProvider).getMyChamas();
    if (!context.mounted) return;
    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setS) => AlertDialog(
          backgroundColor: const Color(0xFF1e293b),
          title: const Text('Request Withdrawal',
              style: TextStyle(color: Colors.white)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  dropdownColor: const Color(0xFF0f172a),
                  isExpanded: true,
                  value: selectedChamaId,
                  hint: const Text('Select Chama',
                      style: TextStyle(color: Colors.white54)),
                  style: const TextStyle(color: Colors.white),
                  items: chamas
                      .map((c) => DropdownMenuItem(
                            value: c['id'] as String,
                            child: Text(c['name'] as String,
                                style: const TextStyle(color: Colors.white),
                                overflow: TextOverflow.ellipsis),
                          ))
                      .toList(),
                  onChanged: (val) => setS(() => selectedChamaId = val),
                  decoration: const InputDecoration(
                    enabledBorder: UnderlineInputBorder(
                        borderSide: BorderSide(color: Colors.white24)),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: amountController,
                  decoration: const InputDecoration(
                    hintText: 'Amount (KES)',
                    hintStyle: TextStyle(color: Colors.white54),
                    enabledBorder: UnderlineInputBorder(
                        borderSide: BorderSide(color: Colors.white24)),
                  ),
                  style: const TextStyle(color: Colors.white),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: reasonController,
                  decoration: const InputDecoration(
                    hintText: 'Reason for withdrawal',
                    hintStyle: TextStyle(color: Colors.white54),
                    enabledBorder: UnderlineInputBorder(
                        borderSide: BorderSide(color: Colors.white24)),
                  ),
                  style: const TextStyle(color: Colors.white),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
            ),
            TextButton(
              onPressed: () async {
                if (selectedChamaId == null || amountController.text.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Please fill all fields')));
                  return;
                }
                final amount = double.tryParse(amountController.text);
                if (amount == null || amount <= 0) {
                  ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Invalid amount')));
                  return;
                }
                try {
                  await ref.read(transactionServiceProvider).requestWithdrawal(
                        chamaId: selectedChamaId!,
                        amount: amount,
                        reason: reasonController.text,
                      );
                  if (context.mounted) {
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                      content: Text('Withdrawal request submitted!'),
                      backgroundColor: Color(0xFF00C853),
                    ));
                  }
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red));
                  }
                }
              },
              child: const Text('Submit',
                  style: TextStyle(color: Color(0xFF00C853))),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final MaterialColor color;
  final bool fullWidth;

  const _StatCard({
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
    this.fullWidth = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        boxShadow: [
          BoxShadow(
              color: color.withValues(alpha: 0.05),
              blurRadius: 20,
              offset: const Offset(0, 10))
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1), shape: BoxShape.circle),
            child: Icon(icon, color: color, size: 24),
          ),
          const SizedBox(height: 20),
          Text(title,
              style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.5),
                  fontSize: 13,
                  fontWeight: FontWeight.w500)),
          const SizedBox(height: 8),
          Text(value,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.5)),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  const _ActionButton({required this.icon, required this.label, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.1),
                shape: BoxShape.circle),
            child: Icon(icon, color: Colors.white),
          ),
          const SizedBox(height: 8),
          Text(label, style: const TextStyle(color: Colors.white, fontSize: 12)),
        ],
      ),
    );
  }
}

class _TransactionItem extends StatelessWidget {
  final String title;
  final String date;
  final String amount;
  final bool isNegative;

  const _TransactionItem({
    required this.title,
    required this.date,
    required this.amount,
    required this.isNegative,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: const Color(0xFF1e293b), borderRadius: BorderRadius.circular(12)),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: isNegative
                        ? Colors.red.withValues(alpha: 0.1)
                        : Colors.green.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    isNegative ? Icons.arrow_upward : Icons.arrow_downward,
                    color: isNegative ? Colors.red : Colors.green,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          style: const TextStyle(
                              color: Colors.white, fontWeight: FontWeight.bold),
                          overflow: TextOverflow.ellipsis),
                      Text(date,
                          style: TextStyle(color: Colors.grey[400], fontSize: 12)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Text(amount,
              style: TextStyle(
                  color: isNegative ? Colors.white : const Color(0xFF00C853),
                  fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}
