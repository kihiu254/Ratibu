import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/transaction.dart';
import '../services/transaction_service.dart';

class HomeState {
  final double totalBalance;
  final List<Transaction> transactions;
  final int activeChamaCount;
  final double pendingPayments;
  final bool isLoading;
  final String? error;

  HomeState({
    this.totalBalance = 0,
    this.transactions = const [],
    this.activeChamaCount = 0,
    this.pendingPayments = 0,
    this.isLoading = false,
    this.error,
  });

  HomeState copyWith({
    double? totalBalance,
    List<Transaction>? transactions,
    int? activeChamaCount,
    double? pendingPayments,
    bool? isLoading,
    String? error,
  }) {
    return HomeState(
      totalBalance: totalBalance ?? this.totalBalance,
      transactions: transactions ?? this.transactions,
      activeChamaCount: activeChamaCount ?? this.activeChamaCount,
      pendingPayments: pendingPayments ?? this.pendingPayments,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class HomeNotifier extends StateNotifier<HomeState> {
  final TransactionService _transactionService = TransactionService();

  HomeNotifier() : super(HomeState()) {
    refresh();
  }

  Future<void> refresh() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final balance = await _transactionService.getTotalBalance();
      final txs = await _transactionService.getRecentTransactions();
      final chamaCount = await _transactionService.getActiveChamaCount();
      final pending = await _transactionService.getPendingPayments();
      
      state = state.copyWith(
        totalBalance: balance,
        transactions: txs,
        activeChamaCount: chamaCount,
        pendingPayments: pending,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }
}

final homeProvider = StateNotifierProvider<HomeNotifier, HomeState>((ref) {
  return HomeNotifier();
});
