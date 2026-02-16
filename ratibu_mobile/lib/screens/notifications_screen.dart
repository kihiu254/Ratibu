import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:intl/intl.dart';

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  late final Stream<List<Map<String, dynamic>>> _notificationsStream;

  @override
  void initState() {
    super.initState();
    final userId = Supabase.instance.client.auth.currentUser!.id;
    _notificationsStream = Supabase.instance.client
        .from('notifications')
        .stream(primaryKey: ['id'])
        .eq('user_id', userId)
        .order('created_at', ascending: false);
  }

  Future<void> _markAsRead(String id) async {
    await Supabase.instance.client
        .from('notifications')
        .update({'is_read': true})
        .eq('id', id);
  }

  Future<void> _markAllAsRead() async {
    final userId = Supabase.instance.client.auth.currentUser!.id;
    await Supabase.instance.client
        .from('notifications')
        .update({'is_read': true})
        .eq('user_id', userId)
        .eq('is_read', false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            onPressed: _markAllAsRead,
            child: const Text('Mark all read'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          // Streams naturally update, but we can nudge the provider or just wait
           return Future.delayed(const Duration(milliseconds: 500));
        },
        color: const Color(0xFF00C853),
        child: StreamBuilder<List<Map<String, dynamic>>>(
          stream: _notificationsStream,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return Center(child: Text('Error: ${snapshot.error}'));
            }
            
            final notifications = snapshot.data ?? [];
            
            if (notifications.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  SizedBox(height: MediaQuery.of(context).size.height * 0.3),
                  Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.notifications_none, size: 64, color: Colors.grey[700]),
                        const SizedBox(height: 16),
                        const Text(
                          'No notifications yet',
                          style: TextStyle(color: Colors.grey, fontSize: 16),
                        ),
                      ],
                    ),
                  ),
                ],
              );
            }

            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              itemCount: notifications.length,
              separatorBuilder: (context, index) => Divider(color: Colors.white.withOpacity(0.05), height: 1),
              itemBuilder: (context, index) {
                final n = notifications[index];
                final bool isRead = n['is_read'] ?? false;
                final String type = n['type'] ?? 'info';
                final DateTime createdAt = DateTime.parse(n['created_at']);

                return ListTile(
                  onTap: () => _markAsRead(n['id']),
                  tileColor: isRead ? Colors.transparent : Colors.green.withOpacity(0.05),
                  leading: _buildIcon(type),
                  title: Text(
                    n['title'],
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: isRead ? FontWeight.normal : FontWeight.bold,
                    ),
                  ),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 4),
                      Text(
                        n['message'],
                        style: TextStyle(color: Colors.grey[400], fontSize: 13),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        DateFormat('MMM d, h:mm a').format(createdAt),
                        style: TextStyle(color: Colors.grey[600], fontSize: 11),
                      ),
                    ],
                  ),
                  trailing: !isRead ? Container(width: 8, height: 8, decoration: const BoxDecoration(color: Color(0xFF00C853), shape: BoxShape.circle)) : null,
                );
              },
            );
          },
        ),
      ),
    );
  }

  Widget _buildIcon(String type) {
    IconData iconData;
    Color color;

    switch (type) {
      case 'success':
        iconData = Icons.check_circle;
        color = Colors.green;
        break;
      case 'warning':
        iconData = Icons.warning;
        color = Colors.orange;
        break;
      case 'error':
        iconData = Icons.error;
        color = Colors.red;
        break;
      default:
        iconData = Icons.info;
        color = const Color(0xFF00C853);
    }

    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        shape: BoxShape.circle,
      ),
      child: Icon(iconData, color: color, size: 20),
    );
  }
}
