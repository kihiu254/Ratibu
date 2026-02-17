import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

class RatibuToast extends StatefulWidget {
  final String title;
  final String message;
  final String type; // 'success', 'error', 'info', 'warning'
  final VoidCallback onDismiss;

  const RatibuToast({
    super.key,
    required this.title,
    required this.message,
    required this.type,
    required this.onDismiss,
  });

  static void show(BuildContext context, {
    required String title,
    required String message,
    String type = 'success',
  }) {
    final overlay = Overlay.of(context);
    late OverlayEntry overlayEntry;

    overlayEntry = OverlayEntry(
      builder: (context) => Positioned(
        top: MediaQuery.of(context).padding.top + 16,
        left: 16,
        right: 16,
        child: RatibuToast(
          title: title,
          message: message,
          type: type,
          onDismiss: () {
            overlayEntry.remove();
          },
        ),
      ),
    );

    overlay.insert(overlayEntry);
  }

  @override
  State<RatibuToast> createState() => _RatibuToastState();
}

class _RatibuToastState extends State<RatibuToast> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
      reverseDuration: const Duration(milliseconds: 400),
    );

    _scaleAnimation = CurvedAnimation(
      parent: _controller,
      curve: Curves.elasticOut,
      reverseCurve: Curves.easeInBack,
    );

    _fadeAnimation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOut,
    );

    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, -1.0),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.elasticOut,
      reverseCurve: Curves.easeInBack,
    ));

    _controller.forward();

    // Auto dismiss after 15 seconds (was 4)
    Future.delayed(const Duration(seconds: 15), () {
      if (mounted) {
        _dismiss();
      }
    });
  }

  void _dismiss() async {
    await _controller.reverse();
    widget.onDismiss();
  }

  Color _getColor() {
    switch (widget.type) {
      case 'success':
        return const Color(0xFF00C853);
      case 'error':
        return const Color(0xFFFF3D00);
      case 'warning':
        return const Color(0xFFFFD600);
      default: // info
        return const Color(0xFF2962FF);
    }
  }

  IconData _getIcon() {
    switch (widget.type) {
      case 'success':
        return LucideIcons.checkCircle;
      case 'error':
        return LucideIcons.alertCircle;
      case 'warning':
        return LucideIcons.alertTriangle;
      default: // info
        return LucideIcons.info;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = _getColor();
    
    return Material(
      color: Colors.transparent,
      child: SlideTransition(
        position: _slideAnimation,
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: ScaleTransition(
            scale: _scaleAnimation,
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 4),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B), // Dark slate/navy background
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: color.withOpacity(0.3),
                  width: 1,
                ),
                boxShadow: [
                  BoxShadow(
                    color: color.withOpacity(0.15),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                    spreadRadius: 0,
                  ),
                  const BoxShadow(
                    color: Colors.black45,
                    blurRadius: 15,
                    offset: Offset(0, 10),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: Stack(
                  children: [
                    // Glass effect gradient overlay
                    Positioned.fill(
                      child: Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              Colors.white.withOpacity(0.05),
                              Colors.white.withOpacity(0.01),
                            ],
                          ),
                        ),
                      ),
                    ),
                    
                    // Main Content
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          // Icon Container
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: color.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: color.withOpacity(0.2),
                              ),
                            ),
                            child: Icon(
                              _getIcon(),
                              color: color,
                              size: 24,
                            ),
                          ),
                          
                          const SizedBox(width: 16),
                          
                          // Text Content
                          Expanded(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  widget.title,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 0.2,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  widget.message,
                                  style: TextStyle(
                                    color: Colors.grey[400],
                                    fontSize: 13,
                                    height: 1.3,
                                  ),
                                  // Removed maxLines limit so full error shows
                                  // overflow: TextOverflow.ellipsis, 
                                ),
                              ],
                            ),
                          ),
                          
                          // Close Button
                          GestureDetector(
                            onTap: _dismiss,
                            child: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.05),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                LucideIcons.x,
                                color: Colors.grey,
                                size: 16,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    
                    // Progress Bar Indicator
                    Positioned(
                      bottom: 0,
                      left: 0,
                      right: 0,
                      child: AnimatedBuilder(
                        animation: _controller,
                        builder: (context, child) {
                          return LinearProgressIndicator(
                            value: 1.0 - _controller.value, // We are reversing this logic maybe?
                            // Actually implementing a timer based progress bar is complex within animation controller
                            // For now let's just show a static bottom line color accent
                            valueColor: AlwaysStoppedAnimation<Color>(color),
                            backgroundColor: Colors.transparent,
                            minHeight: 2,
                          );
                        },
                      ),
                    )
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
