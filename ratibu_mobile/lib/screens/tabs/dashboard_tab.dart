import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../providers/home_provider.dart';

class DashboardTab extends ConsumerWidget {
  const DashboardTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final homeState = ref.watch(homeProvider);
    final currencyFormat = NumberFormat.currency(symbol: 'KES ', decimalDigits: 0);

    return SingleChildScrollView(
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
                  const Text(
                    'Dashboard',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Welcome back, here\'s your financial overview.',
                    style: TextStyle(color: Colors.grey[400], fontSize: 13),
                  ),
                ],
              ),
              // "New Chama" Button placeholder if needed, or keeping clean
            ],
          ),
          const SizedBox(height: 24),
          
          // Total Balance Card (Matching Web Gradient & Layout)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF0f172a), Color(0xFF1e293b)], // slate-900 to slate-800
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16), // Rounded-2xl approx
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.3),
                  blurRadius: 15,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Stack(
              children: [
                Positioned(
                  top: 0,
                  right: 0,
                  child: Opacity(
                    opacity: 0.1,
                    child: Icon(LucideIcons.wallet, color: Colors.white, size: 80),
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Total Balance',
                      style: TextStyle(color: Colors.grey[400], fontSize: 14, fontWeight: FontWeight.w500),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      currencyFormat.format(homeState.totalBalance),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 30,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF4ade80).withOpacity(0.1), // green-400 equivalent
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(LucideIcons.arrowUpRight, color: Color(0xFF4ade80), size: 14),
                          SizedBox(width: 4),
                          Text(
                            '+12.5% this month',
                            style: TextStyle(color: Color(0xFF4ade80), fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          
          const SizedBox(height: 24),
          
          // Secondary Stats Grid (Full width cards on mobile for readability, or grid)
          // Web uses grid-cols-1 md:grid-cols-3. Mobile is cols-1 usually.
          // Let's stack them to match "mobile view" of the web dashboard
          
          // Active Chamas Card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: const Color(0xFF0f172a), // Dark bg (slate-900)
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF1e293b)), // slate-800 border
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.blue[900]!.withOpacity(0.3), // blue-900/30
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(LucideIcons.wallet, color: Colors.blue, size: 20), // blue-400
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  'Active Chamas',
                  style: TextStyle(color: Colors.grey[400], fontSize: 14, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 4),
                Text(
                  homeState.activeChamaCount.toString(),
                  style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
          
          const SizedBox(height: 16),
          
          // Pending Payments Card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: const Color(0xFF0f172a),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF1e293b)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.orange[900]!.withOpacity(0.3), // orange-900/30
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(LucideIcons.arrowDownLeft, color: Colors.orange, size: 20), // orange-400
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  'Pending Payments',
                  style: TextStyle(color: Colors.grey[400], fontSize: 14, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 4),
                Text(
                  currencyFormat.format(homeState.pendingPayments),
                  style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
          
          const SizedBox(height: 24),
          
          // Recent Transactions Section
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFF0f172a), // slate-900
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF1e293b)),
            ),
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(20),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Recent Transactions',
                        style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      Text(
                        'View All',
                        style: TextStyle(color: const Color(0xFF00C853), fontSize: 14, fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
                const Divider(color: Color(0xFF1e293b), height: 1),
                if (homeState.transactions.isEmpty)
                   const Padding(
                     padding: EdgeInsets.all(24.0),
                     child: Text('No transactions yet', style: TextStyle(color: Colors.grey)),
                   )
                else
                  ...homeState.transactions.take(5).map((tx) {
                    final isDeposit = tx.type != 'withdrawal'; // Assuming 'deposit' or others are positive
                    // Web Logic: 
                    // Even (mocked as deposit): ArrowUpRight, Green Icon, + Amount Green
                    // Odd (mocked as withdrawal): ArrowDownLeft, Red Icon, - Amount Slate/White
                    
                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                      decoration: const BoxDecoration(
                        border: Border(bottom: BorderSide(color: Color(0xFF1e293b))),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: const Color(0xFF1e293b), // slate-800
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              isDeposit ? LucideIcons.arrowUpRight : LucideIcons.arrowDownLeft,
                              color: isDeposit ? const Color(0xFF22c55e) : const Color(0xFFef4444), // green-500 / red-500
                              size: 20,
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  tx.description ?? (isDeposit ? 'Monthly Contribution' : 'Withdrawal'),
                                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w500),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  // Simplified date format from example: "Today, 10:23 AM"
                                  DateFormat('MMM d, h:mm a').format(tx.createdAt),
                                  style: TextStyle(color: Colors.grey[500], fontSize: 13),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            '${isDeposit ? '+' : '-'} ${currencyFormat.format(tx.amount)}',
                            style: TextStyle(
                              color: isDeposit ? const Color(0xFF22c55e) : Colors.white, // Green or White
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    );
                  }).toList(),
              ],
            ),
          ),
          // Bottom padding
          const SizedBox(height: 20),
        ],
      ),
    );
  }
}
