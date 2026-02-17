import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:go_router/go_router.dart';
import '../utils/notification_helper.dart';

class JoinChamaScreen extends StatefulWidget {
  const JoinChamaScreen({super.key});

  @override
  State<JoinChamaScreen> createState() => _JoinChamaScreenState();
}

class _JoinChamaScreenState extends State<JoinChamaScreen> {
  final _supabase = Supabase.instance.client;
  final _searchController = TextEditingController();
  List<Map<String, dynamic>> _chamas = [];
  Set<String> _joinedIds = {};
  bool _loading = true;
  String? _joiningId;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    try {
      setState(() => _loading = true);
      final userId = _supabase.auth.currentUser?.id;
      if (userId == null) return;

      // Fetch all chamas
      final chamas = await _supabase
          .from('chamas')
          .select()
          .order('created_at', ascending: false);

      // Fetch user's joined IDs
      final members = await _supabase
          .from('chama_members')
          .select('chama_id')
          .eq('user_id', userId);

      setState(() {
        _chamas = List<Map<String, dynamic>>.from(chamas);
        _joinedIds = (members as List).map((m) => m['chama_id'] as String).toSet();
        _loading = false;
      });
    } catch (e) {
      debugPrint('Error fetching chamas: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to load groups')),
        );
      }
      setState(() => _loading = false);
    }
  }

  Future<void> _joinChama(String chamaId) async {
    try {
      setState(() => _joiningId = chamaId);
      final userId = _supabase.auth.currentUser?.id;
      if (userId == null) return;

      await _supabase.from('chama_members').insert({
        'chama_id': chamaId,
        'user_id': userId,
        'role': 'member',
        'status': 'active',
      });

      NotificationHelper.sendNotification(
        title: 'Successfully Joined!',
        message: 'You have joined a new Chama. Check your dashboard to see updates.',
        type: 'success',
      );

      setState(() {
        _joinedIds.add(chamaId);
        _joiningId = null;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Joined successfully! Reward points added to your profile.'),
            backgroundColor: Color(0xFF00C853),
          ),
        );
      }
    } catch (e) {
      debugPrint('Error joining chama: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to join group')),
        );
      }
      setState(() => _joiningId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filteredChamas = _chamas.where((c) {
      final query = _searchController.text.toLowerCase();
      return (c['name'] as String).toLowerCase().contains(query) ||
          (c['description'] as String?)?.toLowerCase().contains(query) == true;
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('Discover Chamas', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: TextField(
              controller: _searchController,
              onChanged: (_) => setState(() {}),
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Search groups...',
                hintStyle: const TextStyle(color: Colors.white54),
                prefixIcon: const Icon(Icons.search, color: Color(0xFF00C853)),
                filled: true,
                fillColor: Colors.white.withOpacity(0.05),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _fetchData,
              color: const Color(0xFF00C853),
              child: _loading && _chamas.isEmpty
                  ? const Center(child: CircularProgressIndicator(color: Color(0xFF00C853)))
                  : filteredChamas.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: [
                            SizedBox(height: MediaQuery.of(context).size.height * 0.3),
                            const Center(
                              child: Text(
                                'No groups found',
                                style: TextStyle(color: Colors.white54),
                              ),
                            ),
                          ],
                        )
                      : ListView.builder(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.all(16),
                          itemCount: filteredChamas.length,
                          itemBuilder: (context, index) {
                            final chama = filteredChamas[index];
                            final id = chama['id'] as String;
                            final isJoined = _joinedIds.contains(id);
                            final isJoining = _joiningId == id;

                            return Container(
                              margin: const EdgeInsets.only(bottom: 16),
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.03),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(color: Colors.white.withOpacity(0.05)),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Container(
                                        width: 48,
                                        height: 48,
                                        decoration: BoxDecoration(
                                          color: const Color(0xFF00C853).withOpacity(0.1),
                                          borderRadius: BorderRadius.circular(12),
                                        ),
                                        child: const Icon(Icons.group, color: Color(0xFF00C853)),
                                      ),
                                      const SizedBox(width: 16),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              chama['name'],
                                              style: const TextStyle(
                                                color: Colors.white,
                                                fontSize: 18,
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                            Text(
                                              '${chama['total_members'] ?? 0} members',
                                              style: const TextStyle(color: Colors.white54, fontSize: 13),
                                            ),
                                          ],
                                        ),
                                      ),
                                      if (isJoined)
                                        const Icon(Icons.check_circle, color: Color(0xFF00C853))
                                      else
                                        ElevatedButton(
                                          onPressed: isJoining ? null : () => _joinChama(id),
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: const Color(0xFF00C853),
                                            foregroundColor: Colors.white,
                                            shape: RoundedRectangleBorder(
                                              borderRadius: BorderRadius.circular(12),
                                            ),
                                          ),
                                          child: isJoining
                                              ? const SizedBox(
                                                  width: 16,
                                                  height: 16,
                                                  child: CircularProgressIndicator(
                                                    strokeWidth: 2,
                                                    color: Colors.white,
                                                  ),
                                                )
                                              : const Text('Join'),
                                        ),
                                    ],
                                  ),
                                  if (chama['description'] != null) ...[
                                    const SizedBox(height: 12),
                                    Text(
                                      chama['description'],
                                      style: const TextStyle(color: Colors.white70, fontSize: 14),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ],
                              ),
                            );
                          },
                        ),
            ),
          ),
        ],
      ),
    );
  }
}
