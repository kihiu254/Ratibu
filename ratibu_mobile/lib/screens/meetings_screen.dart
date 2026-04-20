import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:go_router/go_router.dart';
import '../providers/chama_provider.dart';
import '../utils/jitsi_meeting_helper.dart';

class MeetingsScreen extends ConsumerStatefulWidget {
  const MeetingsScreen({super.key});

  @override
  ConsumerState<MeetingsScreen> createState() => _MeetingsScreenState();
}

class _MeetingsScreenState extends ConsumerState<MeetingsScreen> {
  bool _loading = true;
  List<Map<String, dynamic>> _meetings = [];

  @override
  void initState() {
    super.initState();
    _loadMeetings();
  }

  Future<void> _loadMeetings() async {
    setState(() => _loading = true);
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) {
        return;
      }

      final membership = await Supabase.instance.client
          .from('chama_members')
          .select('chama_id')
          .eq('user_id', user.id);

      final chamaIds =
          (membership as List).map((m) => m['chama_id'] as String).toList();

      if (chamaIds.isEmpty) {
        if (mounted) {
          setState(() {
            _meetings = [];
            _loading = false;
          });
        }
        return;
      }

      final meetings = await Supabase.instance.client
          .from('meetings')
          .select(
              'id, title, description, date, venue, video_link, chama_id, chamas(name)')
          .inFilter('chama_id', chamaIds)
          .order('date', ascending: true);

      if (mounted) {
        setState(() {
          _meetings = List<Map<String, dynamic>>.from(meetings);
          _loading = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading meetings: $e');
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _joinMeetingRoom(String videoLink, String title) async {
    final uri = Uri.tryParse(videoLink);
    final roomName = uri?.pathSegments.isNotEmpty == true
        ? uri!.pathSegments.last
        : videoLink;
    final user = Supabase.instance.client.auth.currentUser;

    await joinRatibuMeeting(
      context: context,
      roomName: roomName,
      title: title,
      displayName: user?.email,
      email: user?.email,
    );
  }

  Future<void> _showChamaPicker() async {
    try {
      final chamas = await ref.read(chamaServiceProvider).getMyChamas();
      if (!mounted) return;

      if (chamas.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Join or create a chama first.')),
        );
        return;
      }

      // If only one chama, go directly
      if (chamas.length == 1) {
        context.push('/chama/${chamas.first['id']}/create-meeting');
        return;
      }

      // Show picker
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
                    padding: EdgeInsets.fromLTRB(20, 20, 20, 8),
                    child: Text(
                      'Select Chama',
                      style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 16),
                    ),
                  ),
                  const Divider(color: Colors.white10),
                  ...chamas.map((c) => ListTile(
                        leading: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.blue.withValues(alpha: 0.12),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.group,
                              color: Colors.blue, size: 18),
                        ),
                        title: Text(c['name'] ?? 'Chama',
                            style: const TextStyle(color: Colors.white)),
                        subtitle: Text(
                          c['contribution_frequency'] ?? '',
                          style: const TextStyle(
                              color: Colors.white54, fontSize: 12),
                        ),
                        onTap: () {
                          Navigator.pop(ctx);
                          context.push('/chama/${c['id']}/create-meeting');
                        },
                      )),
                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load chamas: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final upcoming = _meetings.where((m) {
      final date = DateTime.tryParse(m['date'] ?? '');
      return date != null && date.isAfter(DateTime.now());
    }).toList();

    final past = _meetings.where((m) {
      final date = DateTime.tryParse(m['date'] ?? '');
      return date != null && !date.isAfter(DateTime.now());
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      appBar: AppBar(
        title: const Text('Meetings'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showChamaPicker,
        backgroundColor: const Color(0xFF00C853),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('New Meeting',
            style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFF00C853)))
          : RefreshIndicator(
              onRefresh: _loadMeetings,
              color: const Color(0xFF00C853),
              child: _meetings.isEmpty
                  ? ListView(
                      children: [
                        const SizedBox(height: 80),
                        Center(
                          child: Column(
                            children: [
                              const Icon(Icons.event_outlined,
                                  color: Colors.white24, size: 64),
                              const SizedBox(height: 16),
                              const Text('No meetings scheduled',
                                  style: TextStyle(
                                      color: Colors.white54, fontSize: 16)),
                              const SizedBox(height: 8),
                              const Text('Tap + to schedule one for your chama',
                                  style: TextStyle(
                                      color: Colors.white38, fontSize: 13)),
                              const SizedBox(height: 24),
                              ElevatedButton.icon(
                                onPressed: _showChamaPicker,
                                icon: const Icon(Icons.add),
                                label: const Text('Schedule Meeting'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF00C853),
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12)),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    )
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                      children: [
                        if (upcoming.isNotEmpty) ...[
                          _sectionLabel('Upcoming'),
                          const SizedBox(height: 8),
                          ...upcoming.map((m) => _MeetingCard(
                                meeting: m,
                                onOpen: () =>
                                    context.push('/chama/${m['chama_id']}'),
                                onJoin: (m['video_link'] ?? '')
                                        .toString()
                                        .isNotEmpty
                                    ? () => _joinMeetingRoom(
                                        m['video_link'].toString(),
                                        m['title'] ?? 'Meeting')
                                    : null,
                              )),
                          const SizedBox(height: 20),
                        ],
                        if (past.isNotEmpty) ...[
                          _sectionLabel('Past'),
                          const SizedBox(height: 8),
                          ...past.map((m) => _MeetingCard(
                                meeting: m,
                                isPast: true,
                                onOpen: () =>
                                    context.push('/chama/${m['chama_id']}'),
                                onJoin: (m['video_link'] ?? '')
                                        .toString()
                                        .isNotEmpty
                                    ? () => _joinMeetingRoom(
                                        m['video_link'].toString(),
                                        m['title'] ?? 'Meeting')
                                    : null,
                              )),
                        ],
                      ],
                    ),
            ),
    );
  }

  Widget _sectionLabel(String label) => Text(
        label.toUpperCase(),
        style: const TextStyle(
            color: Colors.white38,
            fontSize: 11,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.2),
      );
}

class _MeetingCard extends StatelessWidget {
  final Map<String, dynamic> meeting;
  final bool isPast;
  final VoidCallback onOpen;
  final VoidCallback? onJoin;

  const _MeetingCard({
    required this.meeting,
    this.isPast = false,
    required this.onOpen,
    this.onJoin,
  });

  @override
  Widget build(BuildContext context) {
    final date = DateTime.tryParse(meeting['date'] ?? '');
    final chama = meeting['chamas'] as Map<String, dynamic>?;
    final isVirtual = (meeting['video_link'] ?? '').toString().isNotEmpty;

    return Opacity(
      opacity: isPast ? 0.6 : 1.0,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFF1e293b),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white10),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        meeting['title'] ?? 'Meeting',
                        style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 15),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        chama?['name'] ?? 'Chama',
                        style: const TextStyle(
                            color: Color(0xFF00C853), fontSize: 12),
                      ),
                    ],
                  ),
                ),
                if (date != null)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        DateFormat('MMM d').format(date),
                        style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 13),
                      ),
                      Text(
                        DateFormat('h:mm a').format(date),
                        style: const TextStyle(
                            color: Colors.white54, fontSize: 11),
                      ),
                    ],
                  ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Icon(
                  isVirtual ? Icons.videocam : Icons.place,
                  color: Colors.white38,
                  size: 14,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    isVirtual ? 'Virtual Meeting' : (meeting['venue'] ?? 'TBD'),
                    style: const TextStyle(color: Colors.white38, fontSize: 12),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (onJoin != null)
                  ElevatedButton.icon(
                    onPressed: onJoin,
                    icon: const Icon(Icons.videocam, size: 14),
                    label: Text(isPast ? 'Rejoin' : 'Join',
                        style: const TextStyle(
                            fontSize: 12, fontWeight: FontWeight.bold)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF00C853),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                      elevation: 0,
                    ),
                  )
                else
                  TextButton(
                    onPressed: onOpen,
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      backgroundColor:
                          const Color(0xFF00C853).withValues(alpha: 0.1),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text('Open Chama',
                        style: TextStyle(
                            color: Color(0xFF00C853),
                            fontSize: 12,
                            fontWeight: FontWeight.bold)),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
