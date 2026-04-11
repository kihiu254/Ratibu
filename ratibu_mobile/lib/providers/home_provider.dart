import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/transaction.dart';
import '../services/transaction_service.dart';

class HomeState {
  final double totalBalance;
  final double savingsBalance;
  final List<Transaction> transactions;
  final int activeChamaCount;
  final double pendingPayments;
  final List<Map<String, dynamic>> upcomingMeetings;
  final bool isLoading;
  final String? error;

  HomeState({
    this.totalBalance = 0,
    this.savingsBalance = 0,
    this.transactions = const [],
    this.activeChamaCount = 0,
    this.pendingPayments = 0,
    this.upcomingMeetings = const [],
    this.isLoading = false,
    this.error,
  });

  HomeState copyWith({
    double? totalBalance,
    double? savingsBalance,
    List<Transaction>? transactions,
    int? activeChamaCount,
    double? pendingPayments,
    List<Map<String, dynamic>>? upcomingMeetings,
    bool? isLoading,
    String? error,
  }) {
    return HomeState(
      totalBalance: totalBalance ?? this.totalBalance,
      savingsBalance: savingsBalance ?? this.savingsBalance,
      transactions: transactions ?? this.transactions,
      activeChamaCount: activeChamaCount ?? this.activeChamaCount,
      pendingPayments: pendingPayments ?? this.pendingPayments,
      upcomingMeetings: upcomingMeetings ?? this.upcomingMeetings,
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
      final savingsBalance = await _transactionService.getSavingsBalance();
      final txs = await _transactionService.getRecentTransactions();
      final chamaCount = await _transactionService.getActiveChamaCount();
      final pending = await _transactionService.getPendingPayments();
      final upcomingMeetings = await _transactionService.getUpcomingMeetings();
      
      state = state.copyWith(
        totalBalance: balance,
        savingsBalance: savingsBalance,
        transactions: txs,
        activeChamaCount: chamaCount,
        pendingPayments: pending,
        upcomingMeetings: upcomingMeetings,
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
