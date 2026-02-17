import 'package:flutter/material.dart';
import 'dart:async';
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
import 'screens/updates_screen.dart';
import 'screens/standing_order_setup_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin = FlutterLocalNotificationsPlugin();

final GoRouter _router = GoRouter(
  initialLocation: '/login', // Default, will be updated in main
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
      path: '/chama/:id/automate',
      builder: (context, state) {
        final id = state.pathParameters['id']!;
        return StandingOrderSetupScreen(chamaId: id);
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
    GoRoute(
      path: '/updates',
      builder: (context, state) => const UpdatesScreen(),
    ),
  ],
);

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Supabase.initialize(
    url: SupabaseConfig.supabaseUrl,
    anonKey: SupabaseConfig.supabaseAnonKey,
  );

  // Initialize Local Notifications
  const AndroidInitializationSettings initializationSettingsAndroid = AndroidInitializationSettings('@mipmap/launcher_icon');
  const InitializationSettings initializationSettings = InitializationSettings(android: initializationSettingsAndroid);
  
  await flutterLocalNotificationsPlugin.initialize(
    initializationSettings,
    onDidReceiveNotificationResponse: (NotificationResponse response) {
      _router.push('/notifications');
    },
  );

  // Request Permissions (Android 13+)
  await flutterLocalNotificationsPlugin
      .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
      ?.requestNotificationsPermission();

  // Pre-create High Importance Channel for Android
  const AndroidNotificationChannel channel = AndroidNotificationChannel(
    'ratibu_alerts_v5',
    'Ratibu Alerts & Pop-ups',
    description: 'Main notification channel for all alerts',
    importance: Importance.max,
  );

  await flutterLocalNotificationsPlugin
      .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
      ?.createNotificationChannel(channel);

  final prefs = await SharedPreferences.getInstance();
  final onboardingComplete = prefs.getBool('onboarding_complete') ?? false;
  
  // Set initial location for the router
  final initialLocation = onboardingComplete ? '/login' : '/onboarding';
  _router.go(initialLocation);

  // Set up global error handling
  FlutterError.onError = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
    debugPrint('FLUTTER ERROR: ${details.exception}');
    debugPrint('STACK TRACE: ${details.stack}');
  };

  runZonedGuarded(() {
    runApp(ProviderScope(
      child: MyApp(),
    ));
  }, (error, stack) {
    debugPrint('ZONED ERROR: $error');
    debugPrint('STACK TRACE: $stack');
  });
}

// GoRouter configuration is now handled globally as _router

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Ratibu Mobile',
      routerConfig: _router,
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
