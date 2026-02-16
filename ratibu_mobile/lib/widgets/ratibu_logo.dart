import 'package:flutter/material.dart';

class RatibuLogo extends StatelessWidget {
  final double height;
  final Color? color;

  const RatibuLogo({super.key, this.height = 40, this.color});

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      'assets/images/logo.png',
      height: height,
      fit: BoxFit.contain,
    );
  }
}
