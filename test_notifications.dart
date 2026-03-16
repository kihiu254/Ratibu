// Test script to verify notification implementation
import 'package:flutter/material.dart';
import 'ratibu_mobile/lib/utils/notification_helper.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  print('Testing Notification System...');
  
  // Test 1: Initialize FCM
  try {
    await NotificationHelper.initializeFCM();
    print('✓ FCM initialized successfully');
  } catch (e) {
    print('✗ FCM initialization failed: $e');
  }
  
  // Test 2: Send local notification
  try {
    await NotificationHelper.sendNotification(
      title: 'Test Notification',
      message: 'This is a test notification from Ratibu',
      type: 'info',
    );
    print('✓ Local notification sent successfully');
  } catch (e) {
    print('✗ Local notification failed: $e');
  }
  
  // Test 3: Schedule offline notification
  try {
    await NotificationHelper.scheduleOfflineNotification(
      title: 'Scheduled Test',
      message: 'This notification was scheduled for offline delivery',
      scheduledTime: DateTime.now().add(Duration(seconds: 10)),
    );
    print('✓ Offline notification scheduled successfully');
  } catch (e) {
    print('✗ Offline notification scheduling failed: $e');
  }
  
  print('Notification system test completed!');
}