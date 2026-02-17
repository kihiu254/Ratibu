import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../providers/chama_provider.dart';

class ChamaDetailsScreen extends ConsumerWidget {
  final String chamaId;

  const ChamaDetailsScreen({super.key, required this.chamaId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chamaAsync = ref.watch(chamaDetailsProvider(chamaId));

    return chamaAsync.when(
      data: (data) {
        final chama = data['chama'] as Map<String, dynamic>;
        // ignore: unused_local_variable
        final members = data['members'] as List<dynamic>;

        return DefaultTabController(
          length: 4,
          child: Scaffold(
            appBar: AppBar(
              title: Text(chama['name']),
              backgroundColor: const Color(0xFF1a1a1a),
              foregroundColor: Colors.white,
              bottom: const TabBar(
                isScrollable: true,
                indicatorColor: Color(0xFF00C853),
                labelColor: Color(0xFF00C853),
                unselectedLabelColor: Colors.grey,
                tabs: [
                  Tab(text: 'Overview'),
                  Tab(text: 'Members'),
                  Tab(text: 'Meetings'),
                  Tab(text: 'Prompts'),
                ],
              ),
            ),
            backgroundColor: const Color(0xFF121212),
            body: TabBarView(
              children: [
                _OverviewTab(chama: chama),
                _MembersTab(members: members),
                _MeetingsTab(chamaId: chamaId),
                _PromptsTab(chamaId: chamaId),
              ],
            ),
          ),
        );
      },
      loading: () => const Scaffold(
        backgroundColor: Color(0xFF121212),
        body: Center(child: CircularProgressIndicator(color: Color(0xFF00C853))),
      ),
      error: (err, stack) => Scaffold(
        backgroundColor: Color(0xFF121212),
        appBar: AppBar(title: const Text('Error'), backgroundColor: Colors.red),
        body: Center(child: Text('Error: $err', style: const TextStyle(color: Colors.white))),
      ),
    );
  }
}

class _OverviewTab extends ConsumerWidget {
  final Map<String, dynamic> chama;

  const _OverviewTab({required this.chama});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currencyFormat = NumberFormat.currency(locale: 'en_KE', symbol: 'KES ');
    final balance = chama['balance'] ?? 0;

    return RefreshIndicator(
      onRefresh: () async => ref.refresh(chamaDetailsProvider(chama['id'])),
      color: const Color(0xFF00C853),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
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
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Group Balance',
                    style: TextStyle(color: Colors.white70, fontSize: 14),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    currencyFormat.format(balance),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () => context.push('/chama/${chama['id']}/automate'),
                          icon: const Icon(Icons.timer, size: 18),
                          label: const Text('Automate'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white.withOpacity(0.2),
                            foregroundColor: Colors.white,
                            elevation: 0,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () => context.push('/chama/${chama['id']}/deposit'),
                          icon: const Icon(Icons.account_balance_wallet, size: 18),
                          label: const Text('Deposit'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: const Color(0xFF00C853),
                            elevation: 0,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'About',
              style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              chama['description'] ?? 'No description provided.',
              style: TextStyle(color: Colors.grey[400], fontSize: 14),
            ),
            const SizedBox(height: 24),
            _InfoRow(icon: Icons.repeat, label: 'Frequency', value: chama['contribution_frequency'] ?? 'N/A'),
            const SizedBox(height: 12),
            _InfoRow(icon: Icons.monetization_on, label: 'Amount', value: currencyFormat.format(chama['contribution_amount'] ?? 0)),
            const SizedBox(height: 12),
            _InfoRow(
              icon: Icons.card_giftcard, 
              label: 'Join Reward', 
              value: '${chama['join_points'] ?? 500} Points',
              valueColor: const Color(0xFF00C853),
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;

  const _InfoRow({
    required this.icon, 
    required this.label, 
    required this.value,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: Colors.grey, size: 20),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(color: Colors.grey, fontSize: 12)),
            Text(
              value, 
              style: TextStyle(
                color: valueColor ?? Colors.white, 
                fontSize: 16,
                fontWeight: valueColor != null ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _MembersTab extends ConsumerWidget {
  final List<dynamic> members;

  const _MembersTab({required this.members});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (members.isEmpty) {
      return const Center(child: Text('No members yet', style: TextStyle(color: Colors.grey)));
    }

    return RefreshIndicator(
      onRefresh: () async => ref.refresh(chamaDetailsProvider(members.isNotEmpty ? members[0]['chama_id'] : '')), // Hacky, needs better way
      color: const Color(0xFF00C853),
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        itemCount: members.length,
        itemBuilder: (context, index) {
          final member = members[index];
          final user = member['users'] ?? {};
          final name = '${user['first_name'] ?? ''} ${user['last_name'] ?? ''}'.trim();
          final role = member['role'] ?? 'Member';
          final currentUser = Supabase.instance.client.auth.currentUser;
          
          // Check if current user is admin of this chama
          final isAdmin = members.any((m) => m['user_id'] == currentUser?.id && m['role'] == 'admin');

          return Card(
            color: const Color(0xFF1e293b),
            margin: const EdgeInsets.only(bottom: 12),
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: const Color(0xFF00C853),
                foregroundColor: Colors.white,
                child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?'),
              ),
              title: Text(name.isNotEmpty ? name : 'Unknown User', style: const TextStyle(color: Colors.white)),
              subtitle: Text(role.toUpperCase(), style: const TextStyle(color: Colors.grey, fontSize: 12)),
              trailing: isAdmin && member['user_id'] != currentUser?.id 
                ? IconButton(
                    icon: const Icon(Icons.edit, color: Colors.grey, size: 20),
                    onPressed: () => _showRoleDialog(context, ref, member),
                  )
                : null,
            ),
          );
        },
      ),
    );
  }

  void _showRoleDialog(BuildContext context, WidgetRef ref, dynamic member) {
    final roles = ['admin', 'treasurer', 'secretary', 'member'];
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1e293b),
        title: const Text('Change Role', style: TextStyle(color: Colors.white)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: roles.map((role) => ListTile(
            title: Text(role.toUpperCase(), style: const TextStyle(color: Colors.white)),
            onTap: () async {
              try {
                await ref.read(chamaServiceProvider).updateMemberRole(
                  memberId: member['id'],
                  role: role,
                );
                if (context.mounted) {
                  Navigator.pop(context);
                  ref.refresh(chamaDetailsProvider(member['chama_id']));
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Role updated to ${role.toUpperCase()}')),
                  );
                }
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
                  );
                }
              }
            },
          )).toList(),
        ),
      ),
    );
  }
}

class _MeetingsTab extends ConsumerWidget {
  final String chamaId;

  const _MeetingsTab({required this.chamaId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meetingsAsync = ref.watch(chamaMeetingsProvider(chamaId));

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: meetingsAsync.when(
        data: (meetings) {
          if (meetings.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                   const Icon(Icons.event_busy, size: 64, color: Colors.grey),
                   const SizedBox(height: 16),
                   const Text('No meetings scheduled', style: TextStyle(color: Colors.grey)),
                   const SizedBox(height: 16),
                   ElevatedButton(
                    onPressed: () => context.push('/chama/$chamaId/create-meeting'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2C2C2C),
                      foregroundColor: Colors.white,
                    ),
                    child: const Text('Schedule Meeting'),
                  ),
                ],
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.refresh(chamaMeetingsProvider(chamaId)),
            color: const Color(0xFF00C853),
            child: ListView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              itemCount: meetings.length,
              itemBuilder: (context, index) {
                final meeting = meetings[index];
                final date = DateTime.parse(meeting['date']);
                final formattedDate = DateFormat('MMM d, y • h:mm a').format(date);
                final isVirtual = meeting['video_link'] != null && meeting['video_link'].isNotEmpty;

                return Card(
                  color: const Color(0xFF1e293b),
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    leading: const Icon(Icons.calendar_today, color: Color(0xFF00C853)),
                    title: Text(meeting['title'], style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: 4),
                        Text(formattedDate, style: const TextStyle(color: Colors.white70)),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Icon(isVirtual ? Icons.video_call : Icons.location_on, size: 14, color: Colors.grey),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                isVirtual ? 'Virtual Meeting' : (meeting['venue'] ?? 'TBD'),
                                style: const TextStyle(color: Colors.grey),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                        if (isVirtual) ...[
                           const SizedBox(height: 8),
                           InkWell(
                             onTap: () {
                               // TODO: Launch URL
                               ScaffoldMessenger.of(context).showSnackBar(
                                 SnackBar(content: Text('Join Link: ${meeting['video_link']}')),
                               );
                             },
                             child: const Text(
                               'Join Meeting',
                               style: TextStyle(color: Color(0xFF00C853), fontWeight: FontWeight.bold),
                             ),
                           ),
                        ]
                      ],
                    ),
                    isThreeLine: true,
                  ),
                );
              },
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(child: Text('Error: $err', style: const TextStyle(color: Colors.red))),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/chama/$chamaId/create-meeting'),
        backgroundColor: const Color(0xFF00C853),
        label: const Text('Schedule'),
        icon: const Icon(Icons.add),
      ),
    );
  }
}

class _PromptsTab extends ConsumerWidget {
  final String chamaId;

  const _PromptsTab({required this.chamaId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final promptsAsync = ref.watch(chamaPromptsProvider(chamaId));

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: promptsAsync.when(
        data: (prompts) {
          if (prompts.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.notifications_off, size: 64, color: Colors.grey),
                  const SizedBox(height: 16),
                  const Text('No active payment requests', style: TextStyle(color: Colors.grey)),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => context.push('/chama/$chamaId/create-prompt'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2C2C2C),
                      foregroundColor: Colors.white,
                    ),
                    child: const Text('Create Request'),
                  ),
                ],
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.refresh(chamaPromptsProvider(chamaId)),
            color: const Color(0xFF00C853),
            child: ListView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              itemCount: prompts.length,
              itemBuilder: (context, index) {
                final prompt = prompts[index];
                final amount = prompt['amount'];

                return Card(
                  color: const Color(0xFF1e293b),
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    leading: const Icon(Icons.notifications_active, color: Colors.orange),
                    title: Text(prompt['title'], style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    subtitle: Text('Amount: KES $amount', style: const TextStyle(color: Colors.white70)),
                    trailing: ElevatedButton(
                      onPressed: () {
                        context.push('/chama/$chamaId/deposit'); 
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF00C853),
                        foregroundColor: Colors.white,
                      ),
                      child: const Text('Pay'),
                    ),
                  ),
                );
              },
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(child: Text('Error: $err', style: const TextStyle(color: Colors.red))),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/chama/$chamaId/create-prompt'),
        backgroundColor: const Color(0xFF00C853),
        label: const Text('New Request'),
        icon: const Icon(Icons.add_alert),
      ),
    );
  }
}
