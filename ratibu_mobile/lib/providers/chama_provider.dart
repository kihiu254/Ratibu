import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/chama_service.dart';

// 1. Service Provider (Stateless)
final chamaServiceProvider = Provider<ChamaService>((ref) {
  return ChamaService();
});

// 2. My Chamas List Provider (AsyncValue)
// This automatically fetches the list when watched and supports pull-to-refresh
final myChamasProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final service = ref.watch(chamaServiceProvider);
  return service.getMyChamas();
});

// 3. Chama Details Provider (Family)
// Usage: ref.watch(chamaDetailsProvider(chamaId))
final chamaDetailsProvider = FutureProvider.family.autoDispose<Map<String, dynamic>, String>((ref, chamaId) async {
  final service = ref.watch(chamaServiceProvider);
  return service.getChamaDetails(chamaId);
});

// 4. Chama Meetings Provider (Family)
final chamaMeetingsProvider = FutureProvider.family.autoDispose<List<Map<String, dynamic>>, String>((ref, chamaId) async {
  final service = ref.watch(chamaServiceProvider);
  return service.getChamaMeetings(chamaId);
});

// 5. Chama Prompts Provider (Family)
final chamaPromptsProvider = FutureProvider.family.autoDispose<List<Map<String, dynamic>>, String>((ref, chamaId) async {
  final service = ref.watch(chamaServiceProvider);
  return service.getChamaPrompts(chamaId);
});

// 6. Allocations Provider (Family with chamaId+month)
class ChamaMonthParams {
  final String chamaId;
  final DateTime month;
  const ChamaMonthParams(this.chamaId, this.month);
  @override
  bool operator ==(Object other) =>
      other is ChamaMonthParams && other.chamaId == chamaId &&
      other.month.year == month.year && other.month.month == month.month;
  @override
  int get hashCode => Object.hash(chamaId, month.year, month.month);
}

final chamaAllocationsProvider = FutureProvider.family.autoDispose<List<Map<String, dynamic>>, ChamaMonthParams>((ref, p) async {
  return ref.watch(chamaServiceProvider).getAllocations(p.chamaId, p.month);
});

final chamaSwapRequestsProvider = FutureProvider.family.autoDispose<List<Map<String, dynamic>>, ChamaMonthParams>((ref, p) async {
  return ref.watch(chamaServiceProvider).getSwapRequests(p.chamaId, p.month);
});

final chamaMeetingsByMonthProvider = FutureProvider.family.autoDispose<List<Map<String, dynamic>>, ChamaMonthParams>((ref, p) async {
  return ref.watch(chamaServiceProvider).getChamaMeetingsByMonth(p.chamaId, p.month);
});
