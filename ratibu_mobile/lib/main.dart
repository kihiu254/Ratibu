import 'package:flutter/material.dart';
import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'config/supabase_config.dart';
import 'utils/notification_helper.dart';
import 'package:ratibu_mobile/screens/login_screen.dart';
import 'package:ratibu_mobile/screens/register_screen.dart';
import 'package:ratibu_mobile/screens/dashboard_screen.dart';
import 'package:ratibu_mobile/screens/deposit_screen.dart';
import 'package:ratibu_mobile/screens/create_chama_screen.dart';
import 'package:ratibu_mobile/screens/chama_details_screen.dart';
import 'package:ratibu_mobile/screens/create_payment_prompt_screen.dart';
import 'package:ratibu_mobile/screens/create_meeting_screen.dart';
import 'package:ratibu_mobile/screens/profile_screen.dart';
import 'package:ratibu_mobile/screens/notifications_screen.dart';
import 'package:ratibu_mobile/screens/join_chama_screen.dart';
import 'package:ratibu_mobile/screens/leaderboard_screen.dart';
import 'package:ratibu_mobile/screens/onboarding_screen.dart';
import 'package:ratibu_mobile/screens/referrals_screen.dart';
import 'package:ratibu_mobile/screens/updates_screen.dart';
import 'package:ratibu_mobile/screens/standing_order_setup_screen.dart';
import 'package:ratibu_mobile/screens/processing_screen.dart';
import 'package:ratibu_mobile/screens/onboarding_success_screen.dart';
import 'package:ratibu_mobile/screens/otp_verification_screen.dart';
import 'package:ratibu_mobile/screens/two_factor_screen.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:ratibu_mobile/providers/auth_provider.dart';
import 'package:ratibu_mobile/screens/kyc_form_screen.dart';
import 'package:ratibu_mobile/screens/products_screen.dart';
import 'package:ratibu_mobile/screens/opportunities_screen.dart';
import 'package:ratibu_mobile/screens/features_screen.dart';
import 'package:ratibu_mobile/screens/pricing_screen.dart';
import 'package:ratibu_mobile/screens/legal_screen.dart';

final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin = FlutterLocalNotificationsPlugin();

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  print('Handling background message: ${message.messageId}');
}

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/processing',
    redirect: (context, state) {
      final isLoggingIn = state.matchedLocation == '/login';
      final isRegistering = state.matchedLocation == '/register';
      final isOnboarding = state.matchedLocation == '/onboarding';
      final isProcessing = state.matchedLocation == '/processing';
      final is2FA = state.matchedLocation == '/2fa';

      return authState.mapState<String?>(
        initial: (s) => null,
        loading: (s) => null,
        unauthenticated: (s) {
          if (isLoggingIn || isRegistering || isOnboarding || isProcessing) return null;
          // Mark onboarding as seen so returning users skip the slides
          SharedPreferences.getInstance().then((p) => p.setBool('onboarding_complete', true));
          return '/login';
        },
        awaiting2FA: (s) {
          if (is2FA) return null;
          return '/2fa?email=${s.user.email}';
        },
        authenticated: (s) {
          // Strict KYC Guard — only force KYC if never started
          if (s.kycStatus == 'not_started') {
            if (state.matchedLocation == '/kyc-form') return null;
            return '/kyc-form';
          }

          // Prevent re-entering KYC flow once submitted
          if (state.matchedLocation == '/kyc-form' ||
              state.matchedLocation == '/onboarding-success' ||
              state.matchedLocation == '/otp-verification') {
            if (s.kycStatus == 'pending' || s.kycStatus == 'approved') {
              return '/dashboard';
            }
          }

          if (isLoggingIn || isRegistering || isOnboarding || isProcessing || is2FA) {
            return '/dashboard';
          }
          return null;
        },
        error: (s) => isLoggingIn ? null : '/login',
      );
    },
    routes: [
      GoRoute(
        path: '/2fa',
        builder: (context, state) {
          final email = state.uri.queryParameters['email'] ?? '';
          return TwoFactorScreen(email: email);
        },
      ),
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
      path: '/processing',
      builder: (context, state) => const ProcessingScreen(),
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
    GoRoute(
      path: '/onboarding-success',
      builder: (context, state) {
        final email = state.uri.queryParameters['email'];
        return OnboardingSuccessScreen(email: email);
      },
    ),
    GoRoute(
      path: '/otp-verification',
      builder: (context, state) {
        final email = state.uri.queryParameters['email'];
        return OtpVerificationScreen(email: email);
      },
    ),
    GoRoute(
      path: '/kyc-form',
      builder: (context, state) => const KycFormScreen(),
    ),
    GoRoute(
      path: '/products',
      builder: (context, state) => const ProductsScreen(),
    ),
    GoRoute(
      path: '/opportunities',
      builder: (context, state) => const OpportunitiesScreen(),
    ),
    GoRoute(
      path: '/features',
      builder: (context, state) => const FeaturesScreen(),
    ),
    GoRoute(
      path: '/pricing',
      builder: (context, state) => const PricingScreen(),
    ),
    GoRoute(
      path: '/legal/:type',
      builder: (context, state) {
        final type = state.pathParameters['type'] ?? 'Legal Information';
        return LegalScreen(documentType: type);
      }
    ),
  ],
);
});

void main() {
  runZonedGuarded(() async {
    WidgetsFlutterBinding.ensureInitialized();

    await Supabase.initialize(
      url: SupabaseConfig.supabaseUrl,
      anonKey: SupabaseConfig.supabaseAnonKey,
    );

    // Initialize Firebase Messaging
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
    
    // Initialize Local Notifications
    const AndroidInitializationSettings initializationSettingsAndroid = AndroidInitializationSettings('@mipmap/launcher_icon');
    const InitializationSettings initializationSettings = InitializationSettings(android: initializationSettingsAndroid);
    
    await flutterLocalNotificationsPlugin.initialize(
      initializationSettings,
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        // Logic for notification tap, could use ref.read(routerProvider) if in a widget
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

    // Set up global error handling
    FlutterError.onError = (FlutterErrorDetails details) {
      FlutterError.presentError(details);
      debugPrint('FLUTTER ERROR: ${details.exception}');
      debugPrint('STACK TRACE: ${details.stack}');
    };

    runApp(ProviderScope(
      child: const MyApp(),
    ));
  }, (error, stack) {
    debugPrint('ZONED ERROR: $error');
    debugPrint('STACK TRACE: $stack');
  });
}

class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    
    // Initialize FCM when app starts
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initializeFCM();
    });
    
    return MaterialApp.router(
      title: 'Ratibu Mobile',
      routerConfig: router,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF020617), // Midnight from web
        fontFamily: GoogleFonts.outfit().fontFamily,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF00C853), // Ratibu Green
          primary: const Color(0xFF00C853),
          secondary: const Color(0xFF06b6d4), // Cyan from web
          surface: const Color(0xFF0f172a), // Slate 900
          brightness: Brightness.dark,
        ),
        textTheme: GoogleFonts.outfitTextTheme(ThemeData.dark().textTheme),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF020617),
          elevation: 0,
          centerTitle: true,
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            elevation: 0,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
        ),
      ),
    );
  }
  
  Future<void> _initializeFCM() async {
    try {
      await NotificationHelper.initializeFCM();
    } catch (e) {
      print('Error initializing FCM: $e');
    }
  }
}
