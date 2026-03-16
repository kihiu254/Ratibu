import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter/foundation.dart';
import '../utils/notification_helper.dart';

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
    required String category,
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
      'category': category,
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

    // Notify Members via Email
    try {
      final members = await _supabase
          .from('chama_members')
          .select('users(email)')
          .eq('chama_id', chamaId);
      
      for (var member in members) {
        final email = member['users']['email'];
        if (email != null) {
          NotificationHelper.sendEmail(
            to: email,
            subject: 'New Meeting Scheduled: $title',
            html: '''
              <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
                <h2 style="color: #00C853;">New Meeting for your Chama</h2>
                <p><b>Title:</b> $title</p>
                <p><b>Date:</b> ${date.toLocal().toString()}</p>
                <p><b>Venue:</b> $venue</p>
                <p><b>Description:</b> $description</p>
                ${videoLink != null ? '<p><b>Join Link:</b> <a href="$videoLink">$videoLink</a></p>' : ''}
                <p>Log in to the Ratibu app for more details.</p>
              </div>
            ''',
          );
        }
      }
    } catch (e) {
      debugPrint('Error sending meeting notification emails: $e');
    }
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

    // Notify Targeted Members via Email
    try {
      if (targetMemberIds != null && targetMemberIds.isNotEmpty) {
        final users = await _supabase
            .from('users')
            .select('email')
            .inFilter('id', targetMemberIds);

        for (var user in users) {
          final email = user['email'];
          if (email != null) {
            NotificationHelper.sendEmail(
              to: email,
              subject: 'Payment Requested: $title',
              html: '''
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
                  <h2 style="color: #00C853;">Payment Prompt</h2>
                  <p>You have a new payment request for your Chama.</p>
                  <p><b>Title:</b> $title</p>
                  <p><b>Amount:</b> KES $amount</p>
                  ${dueDate != null ? '<p><b>Due Date:</b> ${dueDate.toString()}</p>' : ''}
                  <p>Please open the Ratibu app to complete the transaction.</p>
                </div>
              ''',
            );
          }
        }
      }
    } catch (e) {
      debugPrint('Error sending payment prompt emails: $e');
    }
  }

  /// Fetches monthly allocation schedule.
  Future<List<Map<String, dynamic>>> getAllocations(String chamaId, DateTime month) async {
    final monthStart = DateTime(month.year, month.month, 1);
    final response = await _supabase
        .from('chama_allocation_schedule')
        .select('*, user:users(first_name, last_name)')
        .eq('chama_id', chamaId)
        .eq('allocation_month', monthStart.toIso8601String().substring(0, 10))
        .order('allocation_day', ascending: true);
    return List<Map<String, dynamic>>.from(response);
  }

  /// Fetches swap requests for a chama month.
  Future<List<Map<String, dynamic>>> getSwapRequests(String chamaId, DateTime month) async {
    final monthStart = DateTime(month.year, month.month, 1);
    final response = await _supabase
        .from('allocation_swap_requests')
        .select('*, requester:users!allocation_swap_requests_requester_id_fkey(first_name,last_name), target:users!allocation_swap_requests_target_user_id_fkey(first_name,last_name)')
        .eq('chama_id', chamaId)
        .eq('month', monthStart.toIso8601String().substring(0, 10))
        .order('created_at', ascending: false)
        .limit(20);
    return List<Map<String, dynamic>>.from(response);
  }

  /// Generates monthly allocations via RPC.
  Future<void> generateAllocations(String chamaId, DateTime month) async {
    final monthStart = DateTime(month.year, month.month, 1);
    final response = await _supabase.rpc('generate_monthly_allocations', params: {
      '_chama_id': chamaId,
      '_month': monthStart.toIso8601String().substring(0, 10),
    });
    if (response.error != null) throw Exception(response.error!.message);
  }

  /// Creates a swap request.
  Future<void> createSwapRequest({
    required String chamaId,
    required DateTime month,
    required String targetUserId,
    required int myDay,
    required int targetDay,
  }) async {
    final user = _supabase.auth.currentUser;
    if (user == null) throw Exception('Not authenticated');
    final monthStart = DateTime(month.year, month.month, 1);
    await _supabase.from('allocation_swap_requests').insert({
      'chama_id': chamaId,
      'month': monthStart.toIso8601String().substring(0, 10),
      'requester_id': user.id,
      'requester_day': myDay,
      'target_user_id': targetUserId,
      'target_day': targetDay,
    });
  }

  /// Approves a swap request via RPC.
  Future<void> approveSwap(String swapId) async {
    await _supabase.rpc('approve_allocation_swap', params: {'_swap_id': swapId});
  }

  /// Rejects a swap request.
  Future<void> rejectSwap(String swapId) async {
    await _supabase.from('allocation_swap_requests').update({
      'status': 'rejected',
      'updated_at': DateTime.now().toIso8601String(),
    }).eq('id', swapId);
  }

  /// Fetches meetings for a specific month.
  Future<List<Map<String, dynamic>>> getChamaMeetingsByMonth(String chamaId, DateTime month) async {
    final start = DateTime(month.year, month.month, 1);
    final end = DateTime(month.year, month.month + 1, 1);
    final response = await _supabase
        .from('meetings')
        .select()
        .eq('chama_id', chamaId)
        .gte('date', start.toIso8601String())
        .lt('date', end.toIso8601String())
        .order('date', ascending: true);
    return List<Map<String, dynamic>>.from(response);
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

  /// Invites a new member via email.
  Future<void> inviteMember({
    required String chamaId,
    required String email,
    required String chamaName,
  }) async {
    final user = _supabase.auth.currentUser;
    if (user == null) throw Exception('Not authenticated');

    // Send Invitation Email
    NotificationHelper.sendEmail(
      to: email,
      subject: 'You\'ve been invited to join $chamaName on Ratibu! 🎊',
      html: '''
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px; margin: auto;">
          <h2 style="color: #00C853;">Chama Invitation</h2>
          <p>Hello!</p>
          <p>You have been invited by <b>${user.email}</b> to join their Chama, <b>$chamaName</b>, on the Ratibu Neobank platform.</p>
          <p>Ratibu helps you manage your Chamas, track contributions, and grow your wealth communally.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://chama.ratibuneobank.com" style="background-color: #00C853; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Join Ratibu Now</a>
          </div>
          <p>If you already have an account, simply log in and search for <b>$chamaName</b> in the "Discover" tab.</p>
          <br>
          <p>Best regards,<br>The Ratibu Team</p>
        </div>
      ''',
    );
  }
}
