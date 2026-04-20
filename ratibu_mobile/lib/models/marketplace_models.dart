class MarketplaceUserSnapshot {
  final String id;
  final String firstName;
  final String lastName;
  final String phone;
  final double walletBalance;
  final int creditScore;
  final String creditTier;
  final Map<String, dynamic> marketplaceStatus;

  const MarketplaceUserSnapshot({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.phone,
    required this.walletBalance,
    required this.creditScore,
    required this.creditTier,
    required this.marketplaceStatus,
  });

  factory MarketplaceUserSnapshot.fromMap(Map<String, dynamic> map) {
    return MarketplaceUserSnapshot(
      id: map['id']?.toString() ?? '',
      firstName: map['first_name']?.toString() ?? '',
      lastName: map['last_name']?.toString() ?? '',
      phone: map['phone']?.toString() ?? '',
      walletBalance: (map['wallet_balance'] as num?)?.toDouble() ?? 0,
      creditScore: (map['credit_score'] as num?)?.toInt() ?? 500,
      creditTier: map['credit_tier']?.toString() ?? 'starter',
      marketplaceStatus: map['marketplace_status'] is Map
          ? Map<String, dynamic>.from(map['marketplace_status'] as Map)
          : <String, dynamic>{},
    );
  }
}

class MarketplaceRoleEligibility {
  final bool vendor;
  final bool rider;
  final bool agent;

  const MarketplaceRoleEligibility({
    required this.vendor,
    required this.rider,
    required this.agent,
  });

  factory MarketplaceRoleEligibility.fromMap(Map<String, dynamic> map) {
    return MarketplaceRoleEligibility(
      vendor: map['vendor'] as bool? ?? false,
      rider: map['rider'] as bool? ?? false,
      agent: map['agent'] as bool? ?? false,
    );
  }
}

class ChamaRoleSummary {
  static const Map<String, int> scoreWeights = {
    'admin': 20,
    'treasurer': 15,
    'secretary': 10,
    'member': 0,
  };

  final String chamaId;
  final String chamaName;
  final String role;
  final int scoreWeight;

  const ChamaRoleSummary({
    required this.chamaId,
    required this.chamaName,
    required this.role,
    required this.scoreWeight,
  });

  factory ChamaRoleSummary.fromMap(Map<String, dynamic> map) {
    final role = map['role']?.toString() ?? 'member';
    return ChamaRoleSummary(
      chamaId: map['chama_id']?.toString() ?? '',
      chamaName: map['chama_name']?.toString() ?? 'Chama',
      role: role,
      scoreWeight: (map['score_weight'] as num?)?.toInt() ?? scoreWeights[role] ?? 0,
    );
  }
}

class MarketplaceApplicationRecord {
  final String role;
  final String? businessName;
  final String? displayName;
  final String? serviceCategory;
  final String status;
  final int requiredScore;
  final int scoreSnapshot;
  final DateTime? createdAt;

  const MarketplaceApplicationRecord({
    required this.role,
    required this.businessName,
    required this.displayName,
    required this.serviceCategory,
    required this.status,
    required this.requiredScore,
    required this.scoreSnapshot,
    required this.createdAt,
  });

  factory MarketplaceApplicationRecord.fromMap(Map<String, dynamic> map) {
    return MarketplaceApplicationRecord(
      role: map['role']?.toString() ?? '',
      businessName: map['business_name']?.toString(),
      displayName: map['display_name']?.toString(),
      serviceCategory: map['service_category']?.toString(),
      status: map['status']?.toString() ?? 'pending',
      requiredScore: (map['required_score'] as num?)?.toInt() ?? 0,
      scoreSnapshot: (map['score_snapshot'] as num?)?.toInt() ?? 0,
      createdAt: map['created_at'] != null
          ? DateTime.tryParse(map['created_at'].toString())
          : null,
    );
  }
}

class MarketplaceProfileRecord {
  final String role;
  final String? businessName;
  final String? displayName;
  final String? tillNumber;
  final String? agentNumber;
  final String? riderCode;
  final String? deliveryZone;
  final bool isActive;

  const MarketplaceProfileRecord({
    required this.role,
    required this.businessName,
    required this.displayName,
    required this.tillNumber,
    required this.agentNumber,
    required this.riderCode,
    required this.deliveryZone,
    required this.isActive,
  });

  factory MarketplaceProfileRecord.fromMap(Map<String, dynamic> map) {
    return MarketplaceProfileRecord(
      role: map['role']?.toString() ?? '',
      businessName: map['business_name']?.toString(),
      displayName: map['display_name']?.toString(),
      tillNumber: map['till_number']?.toString(),
      agentNumber: map['agent_number']?.toString(),
      riderCode: map['rider_code']?.toString(),
      deliveryZone: map['delivery_zone']?.toString(),
      isActive: map['is_active'] as bool? ?? false,
    );
  }
}

class CreditScoreBreakdown {
  final MarketplaceUserSnapshot user;
  final MarketplaceRoleEligibility eligibleRoles;
  final List<ChamaRoleSummary> chamaRoles;
  final Map<String, dynamic> components;
  final List<Map<String, dynamic>> roleRules;
  final String summary;

  const CreditScoreBreakdown({
    required this.user,
    required this.eligibleRoles,
    required this.chamaRoles,
    required this.components,
    required this.roleRules,
    required this.summary,
  });

  factory CreditScoreBreakdown.fromMap(Map<String, dynamic> map) {
    final userMap = map['user'] is Map
        ? Map<String, dynamic>.from(map['user'] as Map)
        : <String, dynamic>{};
    final eligibleMap = map['eligible_roles'] is Map
        ? Map<String, dynamic>.from(map['eligible_roles'] as Map)
        : <String, dynamic>{};
    final components = map['components'] is Map
        ? Map<String, dynamic>.from(map['components'] as Map)
        : <String, dynamic>{};
    final chamaRoles = (map['chama_roles'] as List? ?? const [])
        .map((entry) => ChamaRoleSummary.fromMap(Map<String, dynamic>.from(entry as Map)))
        .toList();
    final roleRules = (map['role_rules'] as List? ?? const [])
        .map((entry) => Map<String, dynamic>.from(entry as Map))
        .toList();

    return CreditScoreBreakdown(
      user: MarketplaceUserSnapshot.fromMap(userMap),
      eligibleRoles: MarketplaceRoleEligibility.fromMap(eligibleMap),
      chamaRoles: chamaRoles,
      components: components,
      roleRules: roleRules,
      summary: map['summary']?.toString() ?? '',
    );
  }
}

class MarketplaceOverview {
  final MarketplaceUserSnapshot user;
  final MarketplaceRoleEligibility eligibleRoles;
  final List<ChamaRoleSummary> chamaRoles;
  final List<MarketplaceApplicationRecord> applications;
  final List<MarketplaceProfileRecord> profiles;

  const MarketplaceOverview({
    required this.user,
    required this.eligibleRoles,
    required this.chamaRoles,
    required this.applications,
    required this.profiles,
  });

  factory MarketplaceOverview.fromMap(Map<String, dynamic> map) {
    final userMap = map['user'] is Map
        ? Map<String, dynamic>.from(map['user'] as Map)
        : <String, dynamic>{};
    final eligibleMap = map['eligible_roles'] is Map
        ? Map<String, dynamic>.from(map['eligible_roles'] as Map)
        : <String, dynamic>{};
    final chamaRoles = (map['chama_roles'] as List? ?? const [])
        .map((entry) => ChamaRoleSummary.fromMap(Map<String, dynamic>.from(entry as Map)))
        .toList();
    final applications = (map['applications'] as List? ?? const [])
        .map((entry) => MarketplaceApplicationRecord.fromMap(Map<String, dynamic>.from(entry as Map)))
        .toList();
    final profiles = (map['profiles'] as List? ?? const [])
        .map((entry) => MarketplaceProfileRecord.fromMap(Map<String, dynamic>.from(entry as Map)))
        .toList();

    return MarketplaceOverview(
      user: MarketplaceUserSnapshot.fromMap(userMap),
      eligibleRoles: MarketplaceRoleEligibility.fromMap(eligibleMap),
      chamaRoles: chamaRoles,
      applications: applications,
      profiles: profiles,
    );
  }
}
