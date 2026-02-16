import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../providers/chama_provider.dart';

class ChamasTab extends ConsumerWidget {
  const ChamasTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chamasAsync = ref.watch(myChamasProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: chamasAsync.when(
        data: (chamas) {
          if (chamas.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.group_off, size: 64, color: Colors.grey[700]),
                  const SizedBox(height: 16),
                  const Text(
                    'No Chamas yet',
                    style: TextStyle(color: Colors.grey, fontSize: 18),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Create one to get started!',
                    style: TextStyle(color: Colors.grey),
                  ),
                ],
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.refresh(myChamasProvider),
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: chamas.length,
              itemBuilder: (context, index) {
                final chama = chamas[index];
                return _ChamaCard(chama: chama);
              },
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF00C853))),
        error: (err, stack) => Center(
          child: Text('Error: $err', style: const TextStyle(color: Colors.red)),
        ),
      ),
      floatingActionButton: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          FloatingActionButton.extended(
            heroTag: 'discover',
            onPressed: () => context.push('/join-chama'),
            backgroundColor: const Color(0xFF1e293b),
            icon: const Icon(Icons.search, color: Color(0xFF00C853)),
            label: const Text('Discover', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
          const SizedBox(width: 16),
          FloatingActionButton.extended(
            heroTag: 'create',
            onPressed: () => context.push('/create-chama'),
            backgroundColor: const Color(0xFF00C853),
            icon: const Icon(Icons.add, color: Colors.white),
            label: const Text('New Chama', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}

class _ChamaCard extends StatelessWidget {
  final Map<String, dynamic> chama;

  const _ChamaCard({required this.chama});

  @override
  Widget build(BuildContext context) {
    return Card(
      color: const Color(0xFF1e293b),
      margin: const EdgeInsets.only(bottom: 16),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: InkWell(
        onTap: () {
          context.push('/chama/${chama['id']}');
        },
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    chama['name'] ?? 'Unnamed Chama',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF00C853).withOpacity(0.2),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      chama['status']?.toUpperCase() ?? 'ACTIVE',
                      style: const TextStyle(
                        color: Color(0xFF00C853),
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                chama['description'] ?? 'No description',
                style: TextStyle(color: Colors.grey[400], fontSize: 14),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _InfoBadge(
                    icon: Icons.monetization_on,
                    label: 'KES ${chama['contribution_amount']}/${chama['contribution_frequency']}',
                  ),
                  _InfoBadge(
                    icon: Icons.people,
                    label: '${chama['total_members']} Members',
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoBadge extends StatelessWidget {
  final IconData icon;
  final String label;

  const _InfoBadge({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 16, color: Colors.grey),
        const SizedBox(width: 4),
        Text(
          label,
          style: const TextStyle(color: Colors.grey, fontSize: 12),
        ),
      ],
    );
  }
}
