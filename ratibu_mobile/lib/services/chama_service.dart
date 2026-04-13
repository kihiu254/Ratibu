import 'dart:async';
import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter/foundation.dart';
import '../utils/notification_helper.dart';

class ChamaService {
  final SupabaseClient _supabase = Supabase.instance.client;

  Future<T> _retry<T>(
    Future<T> Function() action, {
    int attempts = 3,
    Duration delay = const Duration(milliseconds: 350),
  }) async {
    Object? lastError;
    for (var i = 0; i < attempts; i++) {
      try {
        return await action();
      } catch (e) {
        lastError = e;
        final message = e.toString().toLowerCase();
        if (i == attempts - 1 ||
            !(e is SocketException ||
                message.contains('connection reset by peer') ||
                message.contains('clientexception') ||
                message.contains('socketexception'))) {
          rethrow;
        }
        await Future.delayed(delay * (i + 1));
      }
    }
    throw lastError ?? Exception('Request failed');
  }

  Future<void> _ensureConnected() async {
    final connectivity = await Connectivity().checkConnectivity();
    if (connectivity.contains(ConnectivityResult.none)) {
      throw Exception('No internet connection. Reconnect and try again.');
    }
  }

  String _friendlyError(Object error, String fallback) {
    final message = error.toString().replaceFirst('Exception: ', '');
    final lower = message.toLowerCase();

    if (error is SocketException ||
        lower.contains('socketexception') ||
        lower.contains('failed host lookup') ||
        lower.contains('network') ||
        lower.contains('internet')) {
      return 'No internet connection. Reconnect and try again.';
    }

    if (lower.contains('uniq_meetings_chama_date')) {
      return 'A meeting for this chama is already scheduled at that date and time. Choose a different time.';
    }

    if (lower.contains('a chama with this name already exists')) {
      return 'A chama with this name already exists. Choose a different name.';
    }

    if (lower.contains('chama_allocation_schedule')) {
      return 'That allocation schedule changed while the swap was being approved. Refresh and try again.';
    }

    if (lower.contains('duplicate key value violates unique constraint')) {
      return 'This record already exists. Refresh and try again.';
    }

    return message.isEmpty ? fallback : message;
  }

  Future<void> _notifyUser({
    required String targetUserId,
    required String title,
    required String message,
    String type = 'info',
    String? link,
    String? emailSubject,
    String? emailHtml,
  }) async {
    try {
      await _supabase.functions.invoke(
        'notify-user',
        body: {
          'targetUserId': targetUserId,
          'title': title,
          'message': message,
          'type': type,
          if (link != null) 'link': link,
          if (emailSubject != null) 'emailSubject': emailSubject,
          if (emailHtml != null) 'emailHtml': emailHtml,
        },
      );
    } catch (e) {
      debugPrint('Notification dispatch failed: $e');
    }
  }

  Future<void> _sendSwapEmail({
    required String swapId,
    required String event,
  }) async {
    try {
      await _supabase.functions.invoke(
        'send-swap-email',
        body: {
          'swapId': swapId,
          'event': event,
        },
      );
    } catch (e) {
      if (e is FunctionException &&
          (e.status == 404 || e.details.toString().contains('NOT_FOUND'))) {
        debugPrint(
          'Swap email function is not deployed for this Supabase project. Skipping email send.',
        );
        return;
      }
      debugPrint('Error sending swap email: $e');
    }
  }

  /// Fetches the list of Chamas that the current user belongs to.
  Future<List<Map<String, dynamic>>> getMyChamas() async {
    try {
      final user = _supabase.auth.currentUser;
      if (user == null) return [];

      final rows = await _retry(() => _supabase
          .from('chama_members')
          .select('chama_id, chamas(*)')
          .eq('user_id', user.id));

      final memberships = List<Map<String, dynamic>>.from(rows);
      final chamaIds = memberships
          .map((row) => row['chama_id'] as String?)
          .whereType<String>()
          .toList();

      final counts = <String, int>{};
      if (chamaIds.isNotEmpty) {
        final countRows = await _retry(() => _supabase
            .from('chama_members')
            .select('chama_id')
            .inFilter('chama_id', chamaIds)
            .eq('status', 'active'));

        for (final row in countRows as List) {
          final chamaId = row['chama_id'] as String?;
          if (chamaId != null) {
            counts[chamaId] = (counts[chamaId] ?? 0) + 1;
          }
        }
      }

      return memberships.map((row) {
        final chama = Map<String, dynamic>.from(row['chamas'] as Map<String, dynamic>);
        chama['total_members'] = counts[chama['id']] ?? chama['total_members'] ?? 0;
        return chama;
      }).toList();
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
    try {
      final user = _supabase.auth.currentUser;
      if (user == null) throw Exception('Not authenticated');

      final chamaResponse = await _supabase
          .from('chamas')
          .insert({
            'name': name,
            'description': description,
            'created_by': user.id,
            'contribution_amount': contributionAmount,
            'contribution_frequency': frequency,
            'category': category,
            'member_limit': 30,
            'balance': 0,
          })
          .select()
          .single();

      final chamaId = chamaResponse['id'];

      await _supabase.from('chama_members').insert({
        'chama_id': chamaId,
        'user_id': user.id,
        'role': 'admin',
        'status': 'active',
      });

      await _notifyUser(
        targetUserId: user.id,
        title: 'Chama created',
        message: 'Your chama "$name" was created successfully.',
        type: 'success',
        link: '/chamas',
        emailSubject: 'Your chama is ready on Ratibu',
      );

      await NotificationHelper.notifyAudience(
        audience: 'admins',
        title: 'New chama created',
        message: 'A new chama called "$name" was created.',
        type: 'info',
        link: '/admin/chamas',
        emailSubject: 'A new chama was created',
      );
    } catch (e) {
      throw Exception(_friendlyError(e, 'Failed to create chama.'));
    }
  }

  /// Fetches details for a specific Chama, including members.
  Future<Map<String, dynamic>> getChamaDetails(String chamaId) async {
    try {
      final chamaNode = await _retry(() =>
          _supabase.from('chamas').select().eq('id', chamaId).single());

      final membersNode = await _retry(() => _supabase
          .from('chama_members')
          .select('*, users(first_name, last_name, phone)')
          .eq('chama_id', chamaId));

      return {
        'chama': {
          ...Map<String, dynamic>.from(chamaNode),
          'total_members': (membersNode as List).length,
        },
        'members': membersNode,
      };
    } catch (e) {
      throw Exception('Failed to load chama details: $e');
    }
  }

  /// Fetches meetings for a specific Chama.
  Future<List<Map<String, dynamic>>> getChamaMeetings(String chamaId) async {
    try {
      final response = await _retry(() => _supabase
          .from('meetings')
          .select()
          .eq('chama_id', chamaId)
          .order('date', ascending: true));
      return List<Map<String, dynamic>>.from(response);
    } catch (e) {
      throw Exception('Failed to load meetings: $e');
    }
  }

  /// Fetches payment prompts (requests) for a specific Chama.
  Future<List<Map<String, dynamic>>> getChamaPrompts(String chamaId) async {
    try {
      final response = await _retry(() => _supabase
          .from('payment_requests')
          .select()
          .eq('chama_id', chamaId)
          .eq('is_active', true)
          .order('created_at', ascending: false));
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
    try {
      await _ensureConnected();
      final user = _supabase.auth.currentUser;
      if (user == null) throw Exception('Not authenticated');

      await _supabase.from('meetings').insert({
        'chama_id': chamaId,
        'created_by': user.id,
        'title': title,
        'description': description,
        'date': date.toIso8601String(),
        'venue': venue,
        'video_link': videoLink,
      });

      final members = await _supabase
          .from('chama_members')
          .select('user_id')
          .eq('chama_id', chamaId)
          .eq('status', 'active');

      for (final member in (members as List)) {
        final memberId = member['user_id']?.toString();
        if (memberId == null) continue;
        await _notifyUser(
          targetUserId: memberId,
          title: 'New meeting scheduled',
          message: 'A new chama meeting has been scheduled.',
          type: 'info',
          link: '/meetings',
          emailSubject: 'New chama meeting scheduled',
        );
      }
    } catch (e) {
      throw Exception(_friendlyError(e, 'Failed to schedule meeting.'));
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

    final recipients = targetMemberIds ??
        (await _supabase
            .from('chama_members')
            .select('user_id')
            .eq('chama_id', chamaId)
            .eq('status', 'active'))
            as List;

    for (final row in recipients) {
      final memberId = row is Map ? row['user_id']?.toString() : null;
      if (memberId == null || memberId == user.id) continue;
      await _notifyUser(
        targetUserId: memberId,
        title: 'Payment request',
        message: 'You have a new payment request for your chama.',
        type: 'warning',
        link: '/chamas',
        emailSubject: 'New chama payment request',
      );
    }
  }

  /// Fetches monthly allocation schedule.
  Future<List<Map<String, dynamic>>> getAllocations(
      String chamaId, DateTime month) async {
    await _ensureConnected();
    final monthStart = DateTime(month.year, month.month, 1);
    final response = await _retry(() => _supabase
        .from('chama_allocation_schedule')
        .select('*, user:users(first_name, last_name)')
        .eq('chama_id', chamaId)
        .eq('allocation_month', monthStart.toIso8601String().substring(0, 10))
        .order('allocation_day', ascending: true));
    return List<Map<String, dynamic>>.from(response);
  }

  /// Fetches swap requests for a chama month.
  Future<List<Map<String, dynamic>>> getSwapRequests(
      String chamaId, DateTime month) async {
    await _ensureConnected();
    final monthStart = DateTime(month.year, month.month, 1);
    final response = await _retry(() => _supabase
        .from('allocation_swap_requests')
        .select(
            '*, requester:users!allocation_swap_requests_requester_id_fkey(first_name,last_name), target:users!allocation_swap_requests_target_user_id_fkey(first_name,last_name)')
        .eq('chama_id', chamaId)
        .eq('month', monthStart.toIso8601String().substring(0, 10))
        .order('created_at', ascending: false)
        .limit(20));
    return List<Map<String, dynamic>>.from(response);
  }

  /// Generates monthly allocations via RPC.
  Future<void> generateAllocations(String chamaId, DateTime month) async {
    await _ensureConnected();
    final monthStart = DateTime(month.year, month.month, 1);
    await _retry(() => _supabase.rpc('generate_monthly_allocations', params: {
      '_chama_id': chamaId,
      '_month': monthStart.toIso8601String().substring(0, 10),
    }));
  }

  /// Creates a swap request.
  Future<void> createSwapRequest({
    required String chamaId,
    required DateTime month,
    required String targetUserId,
    required int myDay,
    required int targetDay,
  }) async {
    try {
      await _ensureConnected();
      final user = _supabase.auth.currentUser;
      if (user == null) throw Exception('Not authenticated');
      final monthStart = DateTime(month.year, month.month, 1);
      final response = await _retry(() => _supabase
          .from('allocation_swap_requests')
          .insert({
            'chama_id': chamaId,
            'month': monthStart.toIso8601String().substring(0, 10),
            'requester_id': user.id,
            'requester_day': myDay,
            'target_user_id': targetUserId,
            'target_day': targetDay,
          })
          .select('id')
          .single());

      final swapId = response['id'] as String?;
      if (swapId != null) {
        await _sendSwapEmail(swapId: swapId, event: 'request_created');
      }
    } catch (e) {
      throw Exception(_friendlyError(e, 'Failed to send swap request.'));
    }
  }

  /// Approves a swap request via RPC.
  Future<void> approveSwap(String swapId) async {
    try {
      await _ensureConnected();
      await _supabase
          .rpc('approve_allocation_swap', params: {'_swap_id': swapId});
      await _sendSwapEmail(swapId: swapId, event: 'approved');
    } catch (e) {
      throw Exception(_friendlyError(e, 'Failed to approve swap.'));
    }
  }

  /// Rejects a swap request.
  Future<void> rejectSwap(String swapId) async {
    try {
      await _ensureConnected();
      final user = _supabase.auth.currentUser;
      if (user == null) throw Exception('Not authenticated');

      await _supabase
          .from('allocation_swap_requests')
          .update({
            'status': 'rejected',
            'updated_at': DateTime.now().toIso8601String(),
          })
          .eq('id', swapId)
          .eq('target_user_id', user.id)
          .eq('status', 'pending');

      await _sendSwapEmail(swapId: swapId, event: 'rejected');
    } catch (e) {
      throw Exception(_friendlyError(e, 'Failed to reject swap.'));
    }
  }

  /// Cancels a pending swap request created by the current user.
  Future<void> cancelSwap(String swapId) async {
    try {
      await _ensureConnected();
      final user = _supabase.auth.currentUser;
      if (user == null) throw Exception('Not authenticated');

      await _supabase
          .from('allocation_swap_requests')
          .update({
            'status': 'cancelled',
            'updated_at': DateTime.now().toIso8601String(),
          })
          .eq('id', swapId)
          .eq('requester_id', user.id)
          .eq('status', 'pending');
    } catch (e) {
      throw Exception(_friendlyError(e, 'Failed to cancel swap request.'));
    }
  }

  /// Fetches meetings for a specific month.
  Future<List<Map<String, dynamic>>> getChamaMeetingsByMonth(
      String chamaId, DateTime month) async {
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
      throw Exception(
          response.data['error'] ?? 'Failed to create standing order');
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
