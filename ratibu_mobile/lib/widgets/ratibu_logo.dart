import 'package:flutter/material.dart';

class RatibuLogo extends StatelessWidget {
  final double height;
  final Color? color;

  const RatibuLogo({super.key, this.height = 40, this.color});

  @override
  Widget build(BuildContext context) {
    // Aspect ratio of viewBox 0 0 400 120 is 400/120 = 3.33
    return CustomPaint(
      size: Size(height * 3.33, height),
      painter: _LogoPainter(color: color ?? Colors.white),
    );
  }
}

class _LogoPainter extends CustomPainter {
  final Color color;

  _LogoPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.height / 120.0;
    canvas.scale(scale, scale);

    final Paint paintMain = Paint()..color = color;
    final Paint paintAccent = Paint()..color = const Color(0xFFB91C1C); // Bolt
    final Paint paintBlue = Paint()..color = const Color(0xFF3B82F6); // ATIBU text

    // Path 1: Stylized R
    var pathR = Path();
    pathR.moveTo(70, 30);
    pathR.lineTo(30, 30);
    pathR.lineTo(30, 90);
    pathR.lineTo(45, 90);
    pathR.lineTo(45, 65);
    pathR.lineTo(70, 65);
    pathR.lineTo(85, 90);
    pathR.lineTo(100, 90);
    pathR.lineTo(85, 65);
    pathR.cubicTo(95, 60, 100, 50, 100, 40);
    pathR.cubicTo(100, 30, 90, 30, 70, 30);
    pathR.close();
    pathR.moveTo(45, 45);
    pathR.lineTo(70, 45);
    pathR.cubicTo(75, 45, 85, 45, 85, 55);
    pathR.cubicTo(85, 65, 75, 65, 70, 65);
    pathR.lineTo(45, 65);
    pathR.lineTo(45, 45);
    pathR.close();
    canvas.drawPath(pathR, paintMain);

    // Path 2: Lightning Bolt
    var pathBolt = Path();
    pathBolt.moveTo(125, 20);
    pathBolt.lineTo(100, 70);
    pathBolt.lineTo(120, 70);
    pathBolt.lineTo(110, 110);
    pathBolt.lineTo(140, 50);
    pathBolt.lineTo(120, 50);
    pathBolt.lineTo(130, 20);
    pathBolt.lineTo(125, 20);
    pathBolt.close();
    canvas.drawPath(pathBolt, paintAccent);

    // Path 3: A
    var pathA = Path();
    pathA.moveTo(170, 30);
    pathA.lineTo(145, 90);
    pathA.lineTo(160, 90);
    pathA.lineTo(165, 78);
    pathA.lineTo(185, 78);
    pathA.lineTo(190, 90);
    pathA.lineTo(205, 90);
    pathA.lineTo(180, 30);
    pathA.lineTo(170, 30);
    pathA.close();
    pathA.moveTo(168, 68);
    pathA.lineTo(175, 48);
    pathA.lineTo(182, 68);
    pathA.lineTo(168, 68);
    pathA.close();
    canvas.drawPath(pathA, paintBlue);

    // Path 4: T
    var pathT = Path();
    pathT.moveTo(220, 42);
    pathT.lineTo(205, 42);
    pathT.lineTo(205, 30);
    pathT.lineTo(250, 30);
    pathT.lineTo(250, 42);
    pathT.lineTo(235, 42);
    pathT.lineTo(235, 90);
    pathT.lineTo(220, 90);
    pathT.lineTo(220, 42);
    pathT.close();
    canvas.drawPath(pathT, paintBlue);

    // Path 5: I
    var pathI = Path();
    pathI.moveTo(260, 30);
    pathI.lineTo(275, 30);
    pathI.lineTo(275, 90);
    pathI.lineTo(260, 90);
    pathI.lineTo(260, 30);
    pathI.close();
    canvas.drawPath(pathI, paintBlue);

    // Path 6: B
    var pathB = Path();
    pathB.moveTo(285, 30);
    pathB.lineTo(315, 30);
    pathB.cubicTo(330, 30, 340, 40, 340, 55);
    pathB.cubicTo(340, 70, 330, 80, 315, 80);
    pathB.lineTo(300, 80);
    pathB.lineTo(300, 90);
    pathB.lineTo(285, 90);
    pathB.lineTo(285, 30);
    pathB.close();
    pathB.moveTo(300, 42);
    pathB.lineTo(300, 68);
    pathB.lineTo(315, 68);
    pathB.cubicTo(322, 68, 325, 65, 325, 55);
    pathB.cubicTo(325, 45, 322, 42, 315, 42);
    pathB.lineTo(300, 42);
    pathB.close();
    canvas.drawPath(pathB, paintBlue);

    // Path 7: U
    var pathU = Path();
    pathU.moveTo(350, 30);
    pathU.lineTo(350, 75);
    pathU.cubicTo(350, 85, 360, 90, 375, 90);
    pathU.cubicTo(390, 90, 400, 85, 400, 75);
    pathU.lineTo(400, 30);
    pathU.lineTo(385, 30);
    pathU.lineTo(385, 75);
    pathU.cubicTo(385, 78, 382, 80, 375, 80);
    pathU.cubicTo(368, 80, 365, 78, 365, 75);
    pathU.lineTo(365, 30);
    pathU.lineTo(350, 30);
    pathU.close();
    canvas.drawPath(pathU, paintBlue);

    // "WE COORDINATE" Tagline - Skipping text rendering for simplicity in CustomPainter
    // or approximating with TextPainter if needed, but logo usuall works without small tagline on mobile.
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
