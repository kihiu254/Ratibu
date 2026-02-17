import 'package:supabase_flutter/supabase_flutter.dart';

class ChamaService {
  final SupabaseClient _supabase = Supabase.instance.client;

  /// Fetches the list of Chamas that the current user belongs to.
  Future<List<Map<String, dynamic>>> getMyChamas() async {
    try {
      final user = _supabase.auth.currentUser;
      if (user == null) return [];

      // Fetch chama_members records for this user, joining the chamas table
      final response = await _supabase
          .from('chama_members')
          .select('chamas(*)')
          .eq('user_id', user.id);

      // The response is a list of objects like: { "chamas": { "id": "...", "name": "..." } }
      // We extract the inner "chamas" object.
      final data = List<Map<String, dynamic>>.from(response);
      return data.map((e) => e['chamas'] as Map<String, dynamic>).toList();
    } catch (e) {
      throw Exception('Failed to load chamas: $e');
    }
  }

  /// Creates a new Chama and adds the creator as an Admin member.
  Future<void> createChama({
    required String name,
    required String description,
    required double contributionAmount,
    required String frequency,
  }) async {
    final user = _supabase.auth.currentUser;
    if (user == null) throw Exception('Not authenticated');

    // 1. Create Chama
    final chamaResponse = await _supabase.from('chamas').insert({
      'name': name,
      'description': description,
      'created_by': user.id,
      'contribution_amount': contributionAmount,
      'contribution_frequency': frequency,
      'member_limit': 50, // Default
      'balance': 0,
    }).select().single();

    final chamaId = chamaResponse['id'];

    // 2. Add Creator as Admin Member
    await _supabase.from('chama_members').insert({
      'chama_id': chamaId,
      'user_id': user.id,
      'role': 'admin',
      'status': 'active',
    });
  }

  /// Fetches details for a specific Chama, including members.
  Future<Map<String, dynamic>> getChamaDetails(String chamaId) async {
      try {
        final chamaNode = await _supabase.from('chamas').select().eq('id', chamaId).single();
        
        final membersNode = await _supabase
            .from('chama_members')
            .select('*, users(first_name, last_name, phone)')
            .eq('chama_id', chamaId);

        return {
          'chama': chamaNode,
          'members': membersNode,
        };
      } catch (e) {
        throw Exception('Failed to load chama details: $e');
      }
  }

  /// Fetches meetings for a specific Chama.
  Future<List<Map<String, dynamic>>> getChamaMeetings(String chamaId) async {
    try {
      final response = await _supabase
          .from('meetings')
          .select()
          .eq('chama_id', chamaId)
          .order('date', ascending: true); // Upcoming first (needs filtering logic in UI or here)
      return List<Map<String, dynamic>>.from(response);
    } catch (e) {
      throw Exception('Failed to load meetings: $e');
    }
  }

  /// Fetches payment prompts (requests) for a specific Chama.
  Future<List<Map<String, dynamic>>> getChamaPrompts(String chamaId) async {
    try {
      final response = await _supabase
          .from('payment_requests')
          .select()
          .eq('chama_id', chamaId)
          .eq('is_active', true)
          .order('created_at', ascending: false);
      return List<Map<String, dynamic>>.from(response);
    } catch (e) {
      throw Exception('Failed to load payment prompts: $e');
    }
  }

  /// Creates a new meeting.
  Future<void> createMeeting({
    required String chamaId,
    required String title,
    required String description,
    required DateTime date,
    required String venue,
    String? videoLink,
  }) async {
    await _supabase.from('meetings').insert({
      'chama_id': chamaId,
      'title': title,
      'description': description,
      'date': date.toIso8601String(),
      'venue': venue,
      'video_link': videoLink,
    });
  }

  /// Creates a new payment prompt.
  Future<void> createPaymentPrompt({
    required String chamaId,
    required String title,
    required double amount,
    DateTime? dueDate,
    List<String>? targetMemberIds, // New: support targeted members
  }) async {
    final user = _supabase.auth.currentUser;
    if (user == null) throw Exception('Not authenticated');

    await _supabase.from('payment_requests').insert({
      'chama_id': chamaId,
      'created_by': user.id,
      'title': title,
      'amount': amount,
      'due_date': dueDate?.toIso8601String(),
      'target_member_ids': targetMemberIds,
    });
  }

  /// Updates a member's role (Admin only).
  Future<void> updateMemberRole({
    required String memberId,
    required String role,
  }) async {
    await _supabase.from('chama_members').update({
      'role': role,
    }).eq('id', memberId);
  }

  /// Creates a new standing order (Ratiba) via Edge Function.
  Future<Map<String, dynamic>> createStandingOrder({
    required String chamaId,
    required String name,
    required double amount,
    required String startDate,
    required String endDate,
    required String frequency,
    required String phoneNumber,
  }) async {
    final user = _supabase.auth.currentUser;
    if (user == null) throw Exception('Not authenticated');

    final response = await _supabase.functions.invoke(
      'create-standing-order',
      body: {
        'amount': amount,
        'phoneNumber': phoneNumber,
        'userId': user.id,
        'chamaId': chamaId,
        'standingOrderName': name,
        'startDate': startDate,
        'endDate': endDate,
        'frequency': frequency,
      },
    );

    if (response.status != 200) {
      throw Exception(response.data['error'] ?? 'Failed to create standing order');
    }

    return Map<String, dynamic>.from(response.data);
  }
}
