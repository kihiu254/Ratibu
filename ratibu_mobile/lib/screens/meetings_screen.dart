import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:go_router/go_router.dart';

class MeetingsScreen extends StatefulWidget {
  const MeetingsScreen({super.key});

  @override
  State<MeetingsScreen> createState() => _MeetingsScreenState();
}

class _MeetingsScreenState extends State<MeetingsScreen> {
  bool _loading = true;
  List<Map<String, dynamic>> _meetings = [];

  @override
  void initState() {
    super.initState();
    _loadMeetings();
  }

  Future<void> _loadMeetings() async {
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) return;

      final membership = await Supabase.instance.client
          .from('chama_members')
          .select('chama_id')
          .eq('user_id', user.id);

      final chamaIds = (membership as List)
          .map((m) => m['chama_id'] as String)
          .toList();

      if (chamaIds.isEmpty) {
        setState(() {
          _meetings = [];
          _loading = false;
        });
        return;
      }

      final meetings = await Supabase.instance.client
          .from('meetings')
          .select('id, title, description, date, venue, video_link, chama_id, chamas(name)')
          .inFilter('chama_id', chamaIds)
          .order('date', ascending: true);

      setState(() {
        _meetings = List<Map<String, dynamic>>.from(meetings);
        _loading = false;
      });
    } catch (e) {
      debugPrint('Error loading meetings: $e');
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      appBar: AppBar(
        title: const Text('Meetings'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF00C853)))
          : RefreshIndicator(
              onRefresh: _loadMeetings,
              color: const Color(0xFF00C853),
              child: _meetings.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 120),
                        Center(child: Text('No meetings scheduled', style: TextStyle(color: Colors.white54))),
                      ],
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _meetings.length,
                      itemBuilder: (context, index) {
                        final m = _meetings[index];
                        final date = DateTime.tryParse(m['date'] ?? '');
                        final chama = m['chamas'] as Map<String, dynamic>?;
                        final isVirtual = (m['video_link'] ?? '').toString().isNotEmpty;
                        return Container(
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
                              Text(
                                m['title'] ?? 'Meeting',
                                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                chama?['name'] ?? 'Chama',
                                style: const TextStyle(color: Colors.white54, fontSize: 12),
                              ),
                              const SizedBox(height: 6),
                              if (date != null)
                                Text(
                                  DateFormat.yMMMd().add_jm().format(date),
                                  style: const TextStyle(color: Colors.white54, fontSize: 12),
                                ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  Icon(isVirtual ? Icons.videocam : Icons.place, color: Colors.white54, size: 16),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      isVirtual ? 'Virtual Meeting' : (m['venue'] ?? 'TBD'),
                                      style: const TextStyle(color: Colors.white54, fontSize: 12),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  TextButton(
                                    onPressed: () => context.push('/chama/${m['chama_id']}'),
                                    child: const Text('Open', style: TextStyle(color: Color(0xFF00C853))),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
