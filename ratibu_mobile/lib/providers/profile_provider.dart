import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/user_service.dart';

final userServiceProvider = Provider<UserService>((ref) => UserService());

final userProfileProvider = FutureProvider<Map<String, dynamic>?>((ref) async {
  final service = ref.watch(userServiceProvider);
  return service.getUserProfile();
});
