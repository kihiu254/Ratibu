import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:timezone/timezone.dart' as tz;

import '../widgets/ratibu_toast.dart';

class NotificationHelper {
  static final _supabase = Supabase.instance.client;
  static final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();
  static final FirebaseMessaging _firebaseMessaging = FirebaseMessaging.instance;

  static Future<void> initializeFCM() async {
    // Request permission for iOS
    await _firebaseMessaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // Get FCM token
    final token = await _firebaseMessaging.getToken();
    if (token != null) {
      debugPrint('FCM Token: $token');
      // Store token in Supabase for push notifications
      final user = _supabase.auth.currentUser;
      if (user != null) {
        await _supabase.from('user_fcm_tokens').upsert({
          'user_id': user.id,
          'token': token,
          'updated_at': DateTime.now().toIso8601String(),
        });
      }
    }

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      _showLocalNotification(message);
    });
  }

  static Future<void> _showLocalNotification(RemoteMessage message) async {
    const AndroidNotificationDetails androidDetails = AndroidNotificationDetails(
      'ratibu_alerts_v5',
      'Ratibu Alerts & Pop-ups',
      importance: Importance.max,
      priority: Priority.high,
    );
    const NotificationDetails platformDetails = NotificationDetails(android: androidDetails);
    
    await _localNotifications.show(
      DateTime.now().millisecond,
      message.notification?.title ?? 'Ratibu',
      message.notification?.body ?? 'New notification',
      platformDetails,
    );
  }

  static Future<void> scheduleOfflineNotification({
    required String title,
    required String message,
    required DateTime scheduledTime,
  }) async {
    const AndroidNotificationDetails androidDetails = AndroidNotificationDetails(
      'ratibu_alerts_v5',
      'Ratibu Alerts & Pop-ups',
      importance: Importance.max,
      priority: Priority.high,
    );
    const NotificationDetails platformDetails = NotificationDetails(android: androidDetails);
    
    await _localNotifications.zonedSchedule(
      DateTime.now().millisecond,
      title,
      message,
      tz.TZDateTime.from(scheduledTime, tz.local),
      platformDetails,
      uiLocalNotificationDateInterpretation: UILocalNotificationDateInterpretation.absoluteTime,
    );
  }

  static Future<void> sendNotification({
    required String title,
    required String message,
    String type = 'info',
    String? userId,
  }) async {
    try {
      final targetUserId = userId ?? _supabase.auth.currentUser?.id;
      if (targetUserId == null) return;

      // 1. Save to Supabase (Mobile App Inbox)
      await _supabase.from('notifications').insert({
        'user_id': targetUserId,
        'title': title,
        'message': message,
        'type': type,
        'is_read': false,
        'created_at': DateTime.now().toIso8601String(),
      });

      // 2. Show Local OS Notification (Alert Banner)
      const AndroidNotificationDetails androidDetails = AndroidNotificationDetails(
        'ratibu_alerts_v5', 
        'Ratibu Alerts & Pop-ups',
        channelDescription: 'Main notification channel for all alerts',
        importance: Importance.max,
        priority: Priority.high,
        showWhen: true,
        fullScreenIntent: true,
        category: AndroidNotificationCategory.status,
      );
      const NotificationDetails platformDetails = NotificationDetails(
        android: androidDetails,
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      );
      
      await _localNotifications.show(
        DateTime.now().millisecond,
        title,
        message,
        platformDetails,
        payload: 'notifications',
      );
    } catch (e) {
      debugPrint('Error sending notification: $e');
    }
  }

  static Future<void> sendEmail({
    required String to,
    required String subject,
    String? body,
    String? html,
  }) async {
    try {
      final response = await _supabase.functions.invoke(
        'send-email',
        body: {
          'to': to,
          'subject': subject,
          'body': body,
          'html': html,
        },
      );

      if (response.status != 200) {
        debugPrint('Failed to send email: ${response.data}');
      } else {
        debugPrint('Email sent successfully to $to');
      }
    } on FunctionException catch (e) {
      if (e.status == 404 || e.details.toString().contains('NOT_FOUND')) {
        debugPrint('send-email function is not deployed for this Supabase project. Skipping email send.');
        return;
      }
      debugPrint('Error calling send-email function: $e');
    } catch (e) {
      debugPrint('Error calling send-email function: $e');
    }
  }

  // New method for in-app toasts
  static void showToast(BuildContext context, {required String title, required String message, String type = 'success'}) {
    RatibuToast.show(context, title: title, message: message, type: type);
  }
}
