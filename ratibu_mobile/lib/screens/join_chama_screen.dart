import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
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
  String _selectedCategory = 'All';

  final List<String> _categories = [
    'All', 'Bodabodas', 'House-helps', 'Sales-people', 'Grocery Owners', 
    'Waiters', 'Health Workers', 'Caretakers', 'Drivers', 
    'Fundis', 'Conductors', 'Others'
  ];

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

      final user = _supabase.auth.currentUser;
      if (user != null) {
        final chamaNode = _chamas.firstWhere((c) => c['id'] == chamaId);
        await NotificationHelper.notifyUser(
          targetUserId: user.id,
          title: 'Joined chama',
          message: 'You successfully joined ${chamaNode['name']}.',
          type: 'success',
          link: '/chamas',
          emailSubject: 'You joined a chama on Ratibu',
        );
      }

      await NotificationHelper.notifyAudience(
        audience: 'chama_admins',
        chamaId: chamaId,
        title: 'New chama member',
        message: 'A member joined your chama.',
        type: 'info',
        link: '/chamas',
        emailSubject: 'A member joined your chama',
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
      final matchesSearch = (c['name'] as String).toLowerCase().contains(query) ||
          (c['description'] as String?)?.toLowerCase().contains(query) == true;
      
      final matchesCategory = _selectedCategory == 'All' || c['category'] == _selectedCategory;
      
      return matchesSearch && matchesCategory;
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
                fillColor: Colors.white.withValues(alpha: 0.05),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          
          // Categories Horizontal Scroll
          SizedBox(
            height: 50,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _categories.length,
              itemBuilder: (context, index) {
                final cat = _categories[index];
                final isSelected = _selectedCategory == cat;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(cat),
                    selected: isSelected,
                    onSelected: (selected) {
                      if (selected) {
                        setState(() => _selectedCategory = cat);
                      }
                    },
                    selectedColor: const Color(0xFF00C853),
                    backgroundColor: Colors.white.withValues(alpha: 0.05),
                    labelStyle: TextStyle(
                      color: isSelected ? Colors.white : Colors.white70,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                      fontSize: 12,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(100),
                      side: BorderSide(
                        color: isSelected ? const Color(0xFF00C853) : Colors.white10,
                      ),
                    ),
                    showCheckmark: false,
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 8),

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
                                color: Colors.white.withValues(alpha: 0.03),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
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
                                          color: const Color(0xFF00C853).withValues(alpha: 0.1),
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

