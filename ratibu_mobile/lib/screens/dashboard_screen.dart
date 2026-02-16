import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import 'tabs/chamas_tab.dart';
import 'profile_screen.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  int _selectedIndex = 0;

  static const List<Widget> _pages = <Widget>[
    HomeTab(),
    const ChamasTab(),
    const Center(child: Text('Activity', style: TextStyle(color: Colors.white))),
    const ProfileScreen(),
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
            icon: Icon(Icons.receipt_long),
            label: 'Activity',
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

class HomeTab extends ConsumerWidget {
  const HomeTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Attempt to get user name safely
    final user = ref.watch(authProvider).mapState(
      authenticated: (state) => state.user,
    );
    
    // Fallback or fetch from metadata/profile in real app
    final email = user?.email ?? 'User';

    return RefreshIndicator(
      onRefresh: () async {
        // In a real app, you might refresh user profile or balance here
        // For now, we refresh the auth state which might trigger a re-fetch if linked
        return ref.read(authProvider.notifier).refreshUser();
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
                      email, // Display email as cleaner placeholder
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
            // Balance Card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF00C853), Color(0xFF009624)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF00C853).withOpacity(0.3),
                    blurRadius: 10,
                    offset: const Offset(0, 5),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Total Balance',
                    style: TextStyle(color: Colors.white70, fontSize: 14),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'KES 124,500', // Mock Data
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                        _ActionButton(
                          icon: Icons.add,
                          label: 'Deposit',
                          onTap: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Please select a Chama to make a deposit.')),
                            );
                          },
                        ),
                      _ActionButton(icon: Icons.arrow_outward, label: 'Withdraw'),
                      _ActionButton(icon: Icons.swap_horiz, label: 'Transfer'),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            // Quick Actions / Recent
            const Text(
              'Recent Transactions',
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            _TransactionItem(
              title: 'Chama Contribution',
              date: 'Today, 10:00 AM',
              amount: '- KES 2,000',
              isNegative: true,
            ),
            _TransactionItem(
              title: 'M-Pesa Deposit',
              date: 'Yesterday, 4:30 PM',
              amount: '+ KES 5,000',
              isNegative: false,
            ),
          ],
        ),
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
              color: Colors.white.withOpacity(0.2),
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
