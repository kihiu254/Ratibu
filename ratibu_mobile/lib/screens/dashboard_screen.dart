import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../providers/auth_provider.dart';
import '../providers/home_provider.dart';
import '../models/transaction.dart';
import 'tabs/chamas_tab.dart';
import 'tabs/dashboard_tab.dart';
import 'profile_screen.dart';


import 'package:supabase_flutter/supabase_flutter.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  int _selectedIndex = 0;

  static const List<Widget> _pages = <Widget>[
    ActivitiesTab(), // Home (Feed)
    ChamasTab(),     // Chamas
    DashboardTab(),  // Dashboard (Stats)
    ProfileScreen(), // Profile
  ];

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      body: SafeArea(
        child: _pages.elementAt(_selectedIndex),
      ),
      bottomNavigationBar: BottomNavigationBar(
        items: const <BottomNavigationBarItem>[
          BottomNavigationBarItem(
            icon: Icon(Icons.home),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.group),
            label: 'Chamas',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard),
            label: 'Dashboard',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
        currentIndex: _selectedIndex,
        selectedItemColor: const Color(0xFF00C853),
        unselectedItemColor: Colors.grey,
        backgroundColor: const Color(0xFF1e293b),
        type: BottomNavigationBarType.fixed,
        onTap: _onItemTapped,
      ),
    );
  }
}

class ActivitiesTab extends ConsumerWidget {
  const ActivitiesTab({super.key});

  Future<Map<String, dynamic>> _fetchDashboardData(WidgetRef ref) async {
    final supabase = Supabase.instance.client;
    final user = supabase.auth.currentUser;
    if (user == null) return {};

    // 1. Fetch Active Chamas Count
    final activeChamasResponse = await supabase
        .from('chama_members')
        .count(CountOption.exact)
        .eq('user_id', user.id)
        .eq('status', 'active');
    final activeChamas = activeChamasResponse;

    // 2. Fetch Pending Payments (Sum)
    final pendingResponse = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', user.id)
        .eq('status', 'pending');
    
    // Calculate pending sum manually since we can't do sum() easily in client
    double pendingPayments = 0;
    for (var record in pendingResponse) {
        pendingPayments += (record['amount'] as num).toDouble();
    }

    // 3. Fetch Recent Transactions
    final recentTransactions = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', ascending: false)
        .limit(5);

    // 4. Calculate Total Balance
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

    return {
      'totalBalance': totalBalance,
      'activeChamas': activeChamas,
      'pendingPayments': pendingPayments,
      'recentTransactions': recentTransactions,
    };
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Attempt to get user name safely
    final user = ref.watch(authProvider).mapState(
      authenticated: (state) => state.user,
    );
    
    final email = user?.email ?? 'User';

    return FutureBuilder<Map<String, dynamic>>(
      future: _fetchDashboardData(ref),
      builder: (context, snapshot) {
        final isLoading = snapshot.connectionState == ConnectionState.waiting;
        final data = snapshot.data ?? {};
        final totalBalance = data['totalBalance'] ?? 0.0;
        final activeChamas = data['activeChamas'] ?? 0;
        final pendingPayments = data['pendingPayments'] ?? 0.0;
        final recentTransactions = data['recentTransactions'] as List<dynamic>? ?? [];

        return RefreshIndicator(
          onRefresh: () async {
            await ref.read(authProvider.notifier).refreshUser();
            // Trigger rebuild by setState if we were stateful, 
            // but for now FutureBuilder re-runs on parent rebuild or we can assume pull-to-refresh
            // forces re-evaluation if we used a provider. 
            // Ideally we'd wrap this in a provider but for quick implementation this works.
            (context as Element).markNeedsBuild(); 
          },
          color: const Color(0xFF00C853),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Hello,',
                          style: TextStyle(color: Colors.grey[400], fontSize: 16),
                        ),
                        Text(
                          email,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.notifications, color: Colors.white),
                      onPressed: () => context.push('/notifications'),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                
                // --- Real Data Stats ---
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
                
                const Text(
                   'Quick Actions',
                   style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                ),
                 const SizedBox(height: 16),
                 Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _ActionButton(
                        icon: Icons.add,
                        label: 'Deposit',
                         onTap: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Please select a Chama first to make a deposit.')),
                          );
                        },
                      ),
                       _ActionButton(icon: Icons.arrow_outward, label: 'Withdraw'),
                      _ActionButton(icon: Icons.swap_horiz, label: 'Transfer'),
                      _ActionButton(
                        icon: Icons.qr_code, 
                        label: 'Scan',
                      ),
                    ],
                 ),

                const SizedBox(height: 24),
                // Activity Feed (Real Data)
                const Text(
                  'Recent Transactions',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
                
                if (isLoading)
                  const Center(child: Padding(
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
                        Text('No recent activity', style: TextStyle(color: Colors.white54)),
                      ],
                    ),
                  )
                else
                  Column(
                    children: recentTransactions.map((tx) => _TransactionItem(
                      title: tx['description'] ?? tx['type'].toString().toUpperCase(),
                      date: DateFormat.yMMMd().add_jm().format(DateTime.parse(tx['created_at'])),
                      amount: '${tx['type'] == 'withdrawal' ? '-' : '+'} KES ${NumberFormat("#,##0").format(tx['amount'])}',
                      isNegative: tx['type'] == 'withdrawal',
                    )).toList(),
                  ),
              ],
            ),
          ),
        );
      }
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
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1e293b),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
               Container(
                 padding: const EdgeInsets.all(8),
                 decoration: BoxDecoration(
                   color: color.withOpacity(0.2),
                   borderRadius: BorderRadius.circular(8),
                 ),
                 child: Icon(icon, color: color, size: 20),
               ),
               if (!fullWidth) const SizedBox() // Spacer
            ],
          ),
          const SizedBox(height: 12),
          Text(title, style: const TextStyle(color: Colors.grey, fontSize: 12)),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  const _ActionButton({
    required this.icon,
    required this.label,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: Colors.white),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: const TextStyle(color: Colors.white, fontSize: 12),
          ),
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
        color: const Color(0xFF1e293b),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: isNegative
                      ? Colors.red.withOpacity(0.1)
                      : Colors.green.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  isNegative ? Icons.arrow_upward : Icons.arrow_downward,
                  color: isNegative ? Colors.red : Colors.green,
                  size: 20,
                ),
              ),
              const SizedBox(width: 16),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                        color: Colors.white, fontWeight: FontWeight.bold),
                  ),
                  Text(
                    date,
                    style: TextStyle(color: Colors.grey[400], fontSize: 12),
                  ),
                ],
              ),
            ],
          ),
          Text(
            amount,
            style: TextStyle(
              color: isNegative ? Colors.white : const Color(0xFF00C853),
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}
