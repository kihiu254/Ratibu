import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'config/supabase_config.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/deposit_screen.dart';
import 'screens/create_chama_screen.dart';
import 'screens/chama_details_screen.dart';
import 'screens/create_payment_prompt_screen.dart';
import 'screens/create_meeting_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/notifications_screen.dart';
import 'screens/join_chama_screen.dart';
import 'screens/leaderboard_screen.dart';
import 'screens/onboarding_screen.dart';
import 'screens/referrals_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin = FlutterLocalNotificationsPlugin();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Supabase.initialize(
    url: SupabaseConfig.supabaseUrl,
    anonKey: SupabaseConfig.supabaseAnonKey,
  );

  // Initialize Local Notifications
  const AndroidInitializationSettings initializationSettingsAndroid = AndroidInitializationSettings('@mipmap/launcher_icon');
  const InitializationSettings initializationSettings = InitializationSettings(android: initializationSettingsAndroid);
  await flutterLocalNotificationsPlugin.initialize(initializationSettings);

  // Request Permissions (Android 13+)
  await flutterLocalNotificationsPlugin
      .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
      ?.requestNotificationsPermission();

  final prefs = await SharedPreferences.getInstance();
  final onboardingComplete = prefs.getBool('onboarding_complete') ?? false;

  runApp(ProviderScope(
    child: MyApp(initialLocation: onboardingComplete ? '/login' : '/onboarding'),
  ));
}

// GoRouter configuration
GoRouter _createRouter(String initialLocation) => GoRouter(
  initialLocation: initialLocation,
  routes: [
    GoRoute(
      path: '/onboarding',
      builder: (context, state) => const OnboardingScreen(),
    ),
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/register',
      builder: (context, state) => const RegisterScreen(),
    ),
    GoRoute(
      path: '/dashboard',
      builder: (context, state) => const DashboardScreen(),
    ),
    GoRoute(
      path: '/deposit',
      builder: (context, state) => const DepositScreen(),
    ),
    GoRoute(
      path: '/create-chama',
      builder: (context, state) => const CreateChamaScreen(),
    ),
    GoRoute(
      path: '/chama/:id',
      builder: (context, state) {
        final id = state.pathParameters['id']!;
        return ChamaDetailsScreen(chamaId: id);
      },
    ),
    GoRoute(
      path: '/chama/:id/create-prompt',
      builder: (context, state) {
        final id = state.pathParameters['id']!;
        return CreatePaymentPromptScreen(chamaId: id);
      },
    ),
    GoRoute(
      path: '/chama/:id/create-meeting',
      builder: (context, state) {
        final id = state.pathParameters['id']!;
        return CreateMeetingScreen(chamaId: id);
      },
    ),
    GoRoute(
      path: '/chama/:id/deposit',
      builder: (context, state) {
        final id = state.pathParameters['id']!;
        return DepositScreen(chamaId: id);
      },
    ),
    GoRoute(
      path: '/profile',
      builder: (context, state) => const ProfileScreen(),
    ),
    GoRoute(
      path: '/notifications',
      builder: (context, state) => const NotificationsScreen(),
    ),
    GoRoute(
      path: '/join-chama',
      builder: (context, state) => const JoinChamaScreen(),
    ),
    GoRoute(
      path: '/leaderboard',
      builder: (context, state) => const LeaderboardScreen(),
    ),
    GoRoute(
      path: '/referrals',
      builder: (context, state) => const ReferralsScreen(),
    ),
  ],
);

class MyApp extends StatelessWidget {
  final String initialLocation;
  const MyApp({super.key, required this.initialLocation});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Ratibu Mobile',
      routerConfig: _createRouter(initialLocation),
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF00C853), // Ratibu Green
          primary: const Color(0xFF00C853),
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFF0f172a),
      ),
    );
  }
}
