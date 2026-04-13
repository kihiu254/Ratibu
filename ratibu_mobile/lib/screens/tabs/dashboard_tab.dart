import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../providers/home_provider.dart';

class DashboardTab extends ConsumerWidget {
  const DashboardTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final homeState = ref.watch(homeProvider);
    final currencyFormat =
        NumberFormat.currency(symbol: 'KES ', decimalDigits: 0);

    if (homeState.isLoading &&
        homeState.transactions.isEmpty &&
        homeState.totalBalance == 0 &&
        homeState.savingsBalance == 0) {
      return const Center(
          child: CircularProgressIndicator(color: Color(0xFF00C853)));
    }

    return RefreshIndicator(
      color: const Color(0xFF00C853),
      onRefresh: () => ref.read(homeProvider.notifier).refresh(),
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
                      'Live account summary.',
                      style: TextStyle(color: Colors.grey[400], fontSize: 13),
                    ),
                  ],
                ),
                if (homeState.error != null)
                  IconButton(
                    tooltip: 'Retry sync',
                    onPressed: () => ref.read(homeProvider.notifier).refresh(),
                    icon: const Icon(Icons.refresh, color: Color(0xFF00C853)),
                  ),
              ],
            ),
            const SizedBox(height: 24),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF0f172a), Color(0xFF1e293b)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.3),
                    blurRadius: 15,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Stack(
                children: [
                  const Positioned(
                    top: 0,
                    right: 0,
                    child: Opacity(
                      opacity: 0.1,
                      child: Icon(LucideIcons.wallet,
                          color: Colors.white, size: 80),
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Total Balance',
                        style: TextStyle(
                            color: Colors.grey[400],
                            fontSize: 14,
                            fontWeight: FontWeight.w500),
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
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFF4ade80).withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(LucideIcons.database,
                                color: Color(0xFF4ade80), size: 14),
                            SizedBox(width: 4),
                            Text(
                              'Live data',
                              style: TextStyle(
                                  color: Color(0xFF4ade80), fontSize: 12),
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
            Row(
              children: [
                Expanded(
                  child: _StatCard(
                    title: 'Active Chamas',
                    value: homeState.activeChamaCount.toString(),
                    icon: LucideIcons.users,
                    color: Colors.blue,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _StatCard(
                    title: 'Savings',
                    value: currencyFormat.format(homeState.savingsBalance),
                    icon: LucideIcons.piggyBank,
                    color: Colors.green,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _StatCard(
              title: 'Pending Payments',
              value: currencyFormat.format(homeState.pendingPayments),
              icon: LucideIcons.clock3,
              color: Colors.orange,
              fullWidth: true,
            ),
            const SizedBox(height: 16),
            Container(
              decoration: BoxDecoration(
                color: const Color(0xFF0f172a),
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
                          'Quick Services',
                          style: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.bold),
                        ),
                        TextButton(
                          onPressed: () => context.push('/kcb-mpesa'),
                          child: const Text(
                            'Open KCB M-PESA',
                            style: TextStyle(
                                color: Color(0xFF00C853), fontSize: 14),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Divider(color: Color(0xFF1e293b), height: 1),
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        Expanded(
                          child: _QuickActionCard(
                            icon: LucideIcons.landmark,
                            title: 'KCB M-PESA',
                            subtitle: 'Loans and savings',
                            onTap: () => context.push('/kcb-mpesa'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _QuickActionCard(
                            icon: LucideIcons.zap,
                            title: 'KPLC Bill',
                            subtitle: 'Tokens & postpaid',
                            onTap: () =>
                                context.push('/kplc-bill?type=prepaid'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _QuickActionCard(
                            icon: LucideIcons.rotateCcw,
                            title: 'Reversal',
                            subtitle: 'Reverse a transaction',
                            onTap: () => context.push('/mpesa-reversal'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            if (homeState.upcomingMeetings.isNotEmpty)
              Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF0f172a),
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
                            'Upcoming Meetings',
                            style: TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.bold),
                          ),
                          TextButton(
                            onPressed: () => context.push('/calendar'),
                            child: const Text(
                              'Calendar',
                              style: TextStyle(
                                  color: Color(0xFF00C853), fontSize: 14),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Divider(color: Color(0xFF1e293b), height: 1),
                    ...homeState.upcomingMeetings.take(3).map((meeting) {
                      final date =
                          DateTime.tryParse(meeting['date']?.toString() ?? '')
                              ?.toLocal();
                      final chamaName =
                          (meeting['chamas'] as Map<String, dynamic>?)?['name']
                                  ?.toString() ??
                              'Chama';
                      return Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 20, vertical: 16),
                        decoration: const BoxDecoration(
                          border: Border(
                              bottom: BorderSide(color: Color(0xFF1e293b))),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 40,
                              height: 40,
                              decoration: const BoxDecoration(
                                color: Color(0xFF1e293b),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.event,
                                  color: Color(0xFF00C853), size: 20),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    meeting['title']?.toString() ?? 'Meeting',
                                    style: const TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w500),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    chamaName,
                                    style: TextStyle(
                                        color: Colors.grey[500], fontSize: 13),
                                  ),
                                  if (date != null)
                                    Text(
                                      DateFormat('MMM d, h:mm a').format(date),
                                      style: TextStyle(
                                          color: Colors.grey[500],
                                          fontSize: 13),
                                    ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              ),
            if (homeState.error != null) ...[
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.red.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.red.withValues(alpha: 0.18)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.warning_amber_rounded,
                        color: Colors.redAccent),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        homeState.error!,
                        style: const TextStyle(
                            color: Colors.white70, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 24),
            Container(
              decoration: BoxDecoration(
                color: const Color(0xFF0f172a),
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
                          style: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.bold),
                        ),
                        Text(
                          '${homeState.transactions.length} shown',
                          style: const TextStyle(
                              color: Color(0xFF00C853),
                              fontSize: 14,
                              fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ),
                  const Divider(color: Color(0xFF1e293b), height: 1),
                  if (homeState.transactions.isEmpty)
                    const Padding(
                      padding: EdgeInsets.all(24.0),
                      child: Text('No transactions yet',
                          style: TextStyle(color: Colors.grey)),
                    )
                  else
                    ...homeState.transactions.take(5).map((tx) {
                      final isDeposit = tx.type != 'withdrawal';
                      return Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 20, vertical: 16),
                        decoration: const BoxDecoration(
                          border: Border(
                              bottom: BorderSide(color: Color(0xFF1e293b))),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 40,
                              height: 40,
                              decoration: const BoxDecoration(
                                color: Color(0xFF1e293b),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                isDeposit
                                    ? LucideIcons.arrowUpRight
                                    : LucideIcons.arrowDownLeft,
                                color: isDeposit
                                    ? const Color(0xFF22c55e)
                                    : const Color(0xFFef4444),
                                size: 20,
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    tx.description ??
                                        (isDeposit
                                            ? 'Monthly Contribution'
                                            : 'Withdrawal'),
                                    style: const TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w500),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    DateFormat('MMM d, h:mm a')
                                        .format(tx.createdAt),
                                    style: TextStyle(
                                        color: Colors.grey[500], fontSize: 13),
                                  ),
                                ],
                              ),
                            ),
                            Text(
                              '${isDeposit ? '+' : '-'} ${currencyFormat.format(tx.amount)}',
                              style: TextStyle(
                                color: isDeposit
                                    ? const Color(0xFF22c55e)
                                    : Colors.white,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: () => context.push(
                            '/statement?accountType=all&accountName=All+Transactions'),
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Color(0xFF00C853)),
                          foregroundColor: const Color(0xFF00C853),
                        ),
                        icon: const Icon(Icons.receipt_long),
                        label: const Text('View Full Statement'),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }
}

class _QuickActionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _QuickActionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF1e293b),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: const Color(0xFF00C853)),
              const SizedBox(height: 14),
              Text(title,
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Text(subtitle,
                  style: const TextStyle(color: Colors.white54, fontSize: 12)),
            ],
          ),
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
      width: fullWidth ? double.infinity : null,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF0f172a),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF1e293b)),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.05),
            blurRadius: 20,
            offset: const Offset(0, 10),
          )
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 24),
          ),
          const SizedBox(height: 20),
          Text(
            title,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.5),
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
            ),
          ),
        ],
      ),
    );
  }
}
