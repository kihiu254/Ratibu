import 'package:flutter/material.dart';

class RatibuLogo extends StatelessWidget {
  final double height;
  final double? width;
  final Color? color;

  const RatibuLogo({super.key, this.height = 60, this.width, this.color});

  @override
  Widget build(BuildContext context) {
    // ignore: unused_local_variable
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return SizedBox(
      height: height,
      width: width,
      child: Image.asset(
        'assets/images/app_logo_final.png',
        fit: BoxFit.contain,
        width: MediaQuery.of(context).size.width * 0.8,
      ),
    );
  }
}
