import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/marketplace_models.dart';

class CreditScoreService {
  final SupabaseClient _supabase;

  CreditScoreService({SupabaseClient? client}) : _supabase = client ?? Supabase.instance.client;

  Future<MarketplaceOverview?> fetchMarketplaceOverview() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return null;

    final response = await _supabase.rpc('get_marketplace_overview', params: {
      'p_user_id': user.id,
    });

    final overviewMap = response is Map
        ? Map<String, dynamic>.from(response)
        : <String, dynamic>{};

    if (overviewMap.isEmpty || overviewMap['ok'] != true) return null;
    return MarketplaceOverview.fromMap(overviewMap);
  }

  Future<CreditScoreBreakdown?> fetchCreditScoreBreakdown() async {
    final user = _supabase.auth.currentUser;
    if (user == null) return null;

    final response = await _supabase.rpc('get_credit_score_breakdown', params: {
      'p_user_id': user.id,
    });

    final breakdownMap = response is Map
        ? Map<String, dynamic>.from(response)
        : <String, dynamic>{};

    if (breakdownMap.isEmpty || breakdownMap['ok'] != true) return null;
    return CreditScoreBreakdown.fromMap(breakdownMap);
  }

  Future<Map<String, dynamic>> requestMarketplaceRole({
    required String role,
    String? businessName,
    String? displayName,
    String? serviceCategory,
    String? notes,
  }) async {
    final user = _supabase.auth.currentUser;
    if (user == null) throw Exception('Not authenticated');

    final response = await _supabase.rpc('request_marketplace_role', params: {
      'p_user_id': user.id,
      'p_role': role,
      'p_business_name': businessName,
      'p_display_name': displayName,
      'p_service_category': serviceCategory,
      'p_notes': notes,
    });

    if (response is Map<String, dynamic>) {
      return response;
    }
    return Map<String, dynamic>.from(response as Map);
  }
}
