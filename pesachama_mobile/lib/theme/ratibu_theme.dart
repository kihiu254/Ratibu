import 'package:flutter/material.dart';

class RatibuTheme {
  // Brand Colors
  static const Color navy = Color(0xFF0F2C59);
  static const Color green = Color(0xFF00B87C);
  static const Color orange = Color(0xFFFF6B35);
  static const Color offWhite = Color(0xFFF8F9FA);
  static const Color slate = Color(0xFF333333);

  static ThemeData get light {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: navy,
        primary: navy,
        secondary: green,
        tertiary: orange,
        surface: offWhite,
      ),
      scaffoldBackgroundColor: offWhite,
      appBarTheme: const AppBarTheme(
        backgroundColor: navy,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: green,
          foregroundColor: Colors.white,
          minimumSize: const Size(double.infinity, 56),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          textStyle: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
      textTheme: const TextTheme(
        headlineLarge: TextStyle(
          color: navy,
          fontSize: 32,
          fontWeight: FontWeight.bold,
        ),
        bodyLarge: TextStyle(
          color: slate,
          fontSize: 16,
        ),
      ),
    );
  }
}
