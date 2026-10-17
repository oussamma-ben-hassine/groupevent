import React, { useState } from 'react';
import { EventItem, BalancesData, Settlement } from '../types';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';
import { api } from '../api/client';

interface BalancesTabProps {
  event: EventItem;
  balances: BalancesData | null;
  settlements: Settlement[];
  loading: boolean;
  onRefresh: () => void;
}

export const BalancesTab: React.FC<BalancesTabProps> = ({
  event,
  balances,
  settlements,
  loading,
  onRefresh
}) => {
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [fromMemberId, setFromMemberId] = useState('');
  const [toMemberId, setToMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const openSettleModalWithSuggestion = (fromId: string, toId: string, sugAmount: number) => {
    setFromMemberId(fromId);
    setToMemberId(toId);
    setAmount(sugAmount.toFixed(2));
    setIsSettleModalOpen(true);
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromMemberId || !toMemberId || !amount) return;
    if (fromMemberId === toMemberId) {
      setError('L’émetteur et le destinataire doivent être différents.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await api.recordSettlement(event.id, {
        from_member_id: fromMemberId,
        to_member_id: toMemberId,
        amount: parseFloat(amount),
        currency: event.currency,
        notes: notes.trim() || undefined
      });

      setIsSettleModalOpen(false);
      setNotes('');
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l’enregistrement du remboursement.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !balances) {
    return (
      <div className="py-16 text-center text-slate-400">
        <span className="material-symbols-outlined animate-spin text-2xl mb-1 text-blue-600">refresh</span>
        <p className="text-xs">Calcul des soldes et équilibrage...</p>
      </div>
    );
  }

  const hasExpenses = balances.total_spent > 0;

  return (
    <div className="space-y-6">
      {/* Top Balances Overview */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-xl">balance</span>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
              Équilibrage & Soldes des Comptes
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Dépenses totales analysées : <span className="font-bold text-slate-900 dark:text-white font-mono">{balances.total_spent.toFixed(2)} {balances.currency}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (event.members && event.members.length >= 2) {
              setFromMemberId(event.members[0].id);
              setToMemberId(event.members[1].id);
            }
            setIsSettleModalOpen(true);
          }}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 cursor-pointer flex-shrink-0"
        >
          <span className="material-symbols-outlined text-base">check_circle</span>
          <span>Enregistrer un remboursement</span>
        </button>
      </div>

      {!hasExpenses ? (
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700 p-8 shadow-xs">
          <EmptyState
            icon="account_balance_wallet"
            title="Aucun solde à équilibrer."
            description="Dès que vous enregistrez une dépense ou des courses, l'algorithme calculera automatiquement qui doit combien à qui."
          />
        </div>
      ) : (
        <>
          {/* Member Balance Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {balances.members.map((m) => {
              const isPositive = m.net_balance > 0.009;
              const isNegative = m.net_balance < -0.009;

              return (
                <div
                  key={m.member_id}
                  className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-xs flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {m.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                        {m.display_name}
                      </h4>
                      <span className="text-[10px] text-slate-400 block">
                        Payé : {m.paid_total.toFixed(2)} {balances.currency}
                      </span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className={`text-xs sm:text-sm font-mono font-extrabold block ${
                      isPositive
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : isNegative
                        ? 'text-red-500 dark:text-red-400'
                        : 'text-slate-500'
                    }`}>
                      {isPositive ? `+${m.net_balance.toFixed(2)}` : m.net_balance.toFixed(2)} {balances.currency}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 block">
                      {isPositive ? 'À recevoir' : isNegative ? 'À rembourser' : 'À jour'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Suggested Minimal Debt Settlements */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-purple-600 text-xl">auto_fix_high</span>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Remboursements Optimisés Suggérés
                </h3>
                <p className="text-[11px] text-slate-400">
                  L'algorithme simplifie les dettes croisées pour minimiser le nombre de virements entre participants.
                </p>
              </div>
            </div>

            {balances.suggested_settlements.length === 0 ? (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded-2xl text-xs font-bold text-center border border-emerald-100 dark:border-emerald-800">
                🎉 Tous les comptes sont parfaitement équilibrés ! Aucun remboursement requis.
              </div>
            ) : (
              <div className="space-y-2">
                {balances.suggested_settlements.map((tx, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                      <span className="text-red-600 dark:text-red-400">{tx.from_member_name}</span>
                      <span className="material-symbols-outlined text-slate-400 text-base">arrow_forward</span>
                      <span className="text-emerald-600 dark:text-emerald-400">{tx.to_member_name}</span>
                    </div>

                    <div className="flex items-center gap-3 justify-between sm:justify-end">
                      <span className="font-mono font-extrabold text-slate-900 dark:text-white text-sm">
                        {tx.amount.toFixed(2)} {tx.currency}
                      </span>
                      <button
                        type="button"
                        onClick={() => openSettleModalWithSuggestion(tx.from_member_id, tx.to_member_id, tx.amount)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[11px] font-bold shadow-xs transition-colors cursor-pointer"
                      >
                        Marquer Remboursé
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Settlements History */}
          {settlements.length > 0 && (
            <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Historique des remboursements effectués ({settlements.length})
              </h4>
              <div className="space-y-2">
                {settlements.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-2xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <span className="material-symbols-outlined text-xs">done</span>
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {s.from_member_name} a remboursé {s.to_member_name}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        ({new Date(s.settled_at).toLocaleDateString('fr-FR')})
                      </span>
                    </div>
                    <span className="font-mono font-extrabold text-slate-900 dark:text-white">
                      {s.amount.toFixed(2)} {s.currency}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal Enregistrer un remboursement */}
      <Modal
        isOpen={isSettleModalOpen}
        onClose={() => setIsSettleModalOpen(false)}
        title="Enregistrer un remboursement"
        subtitle="Confirmez le règlement direct entre deux participants"
      >
        <form onSubmit={handleSettleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-2xl text-xs font-medium border border-red-100">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
                Qui a payé ? *
              </label>
              <select
                value={fromMemberId}
                onChange={(e) => setFromMemberId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-hidden"
              >
                {event.members?.map((m) => (
                  <option key={m.id} value={m.id}>{m.display_title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
                À qui ? *
              </label>
              <select
                value={toMemberId}
                onChange={(e) => setToMemberId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-hidden"
              >
                {event.members?.map((m) => (
                  <option key={m.id} value={m.id}>{m.display_title}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Montant remboursé ({event.currency}) *
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-mono font-bold text-slate-800 dark:text-slate-100 outline-hidden focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Note (Virement, Espèces, Lydia, etc.)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Virement bancaire, Lydia..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-100 outline-hidden focus:border-blue-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsSettleModalOpen(false)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Validation...' : 'Valider le remboursement'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
