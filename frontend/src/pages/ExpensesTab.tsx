import React, { useState } from 'react';
import { EventItem, Expense, BalancesData, Settlement } from '../types';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { api } from '../api/client';

interface ExpensesTabProps {
  event: EventItem;
  expenses: Expense[];
  balances: BalancesData | null;
  settlements?: Settlement[];
  loading: boolean;
  onRefresh: () => void;
  onNavigateBalances?: () => void;
}

export const ExpensesTab: React.FC<ExpensesTabProps> = ({
  event,
  expenses,
  balances,
  settlements = [],
  loading,
  onRefresh,
  onNavigateBalances
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedExpenseDetail, setSelectedExpenseDetail] = useState<Expense | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [payerId, setPayerId] = useState(event.current_member_id || event.members?.[0]?.id || '');
  const [category, setCategory] = useState('Courses');
  const [splitMode, setSplitMode] = useState<'equal' | 'exact' | 'shares'>('equal');
  const [notes, setNotes] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  // Tricount Participant Selection
  // memberId -> boolean (is included)
  const [includedMembers, setIncludedMembers] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    (event.members || []).forEach(m => {
      map[m.id] = true;
    });
    return map;
  });

  // Custom amounts or shares per member (for exact/shares mode)
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Quick Settlement Modal (Tricount Reimbursement)
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleFromId, setSettleFromId] = useState('');
  const [settleToId, setSettleToId] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNotes, setSettleNotes] = useState('');
  const [settleSubmitting, setSettleSubmitting] = useState(false);

  const categories = ['Courses', 'Nourriture', 'Transport', 'Hébergement', 'Loisirs', 'Matériel', 'Autre'];

  // Initialize or reset participant selections
  const handleOpenAddModal = () => {
    setPayerId(event.current_member_id || event.members?.[0]?.id || '');
    const map: Record<string, boolean> = {};
    const splitsMap: Record<string, string> = {};
    (event.members || []).forEach(m => {
      map[m.id] = true;
      splitsMap[m.id] = '';
    });
    setIncludedMembers(map);
    setCustomSplits(splitsMap);
    setError('');
    setIsAddModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReceiptFile(e.target.files[0]);
    }
  };

  // Participant selection helpers
  const selectedMemberCount = Object.values(includedMembers).filter(Boolean).length;
  const numAmount = parseFloat(amount) || 0;
  const equalPerPerson = selectedMemberCount > 0 ? (numAmount / selectedMemberCount) : 0;

  const handleSelectAll = (select: boolean) => {
    const updated: Record<string, boolean> = {};
    (event.members || []).forEach(m => {
      updated[m.id] = select;
    });
    setIncludedMembers(updated);
  };

  const handleAddExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount) return;

    if (selectedMemberCount === 0) {
      setError('Veuillez sélectionner au moins un participant pour cette dépense.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      let receiptUrl: string | undefined = undefined;
      let receiptDriveId: string | undefined = undefined;

      if (receiptFile) {
        setUploading(true);
        const upRes = await api.uploadReceipt(receiptFile);
        receiptUrl = upRes.url;
        receiptDriveId = upRes.drive_id;
        setUploading(false);
      }

      // Build splits array
      let splitsPayload: any[] | undefined = undefined;

      if (splitMode === 'exact') {
        splitsPayload = Object.entries(includedMembers)
          .filter(([_, inc]) => inc)
          .map(([mid]) => ({
            member_id: mid,
            amount: parseFloat(customSplits[mid]) || 0,
            shares: 1.0
          }));
      } else if (splitMode === 'shares') {
        splitsPayload = Object.entries(includedMembers)
          .filter(([_, inc]) => inc)
          .map(([mid]) => ({
            member_id: mid,
            shares: parseFloat(customSplits[mid]) || 1.0
          }));
      } else {
        // Equal split among checked members
        splitsPayload = Object.entries(includedMembers)
          .filter(([_, inc]) => inc)
          .map(([mid]) => ({
            member_id: mid,
            shares: 1.0
          }));
      }

      await api.createExpense(event.id, {
        title: title.trim(),
        amount: numAmount,
        currency: event.currency,
        payer_id: payerId || event.members?.[0]?.id,
        category,
        split_mode: splitMode,
        splits: splitsPayload,
        notes: notes.trim() || undefined,
        receipt_url: receiptUrl,
        receipt_drive_id: receiptDriveId
      });

      setTitle('');
      setAmount('');
      setNotes('');
      setReceiptFile(null);
      setIsAddModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'enregistrement de la dépense.");
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  const handleDeleteExpense = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Voulez-vous supprimer cette dépense ?')) {
      try {
        await api.deleteExpense(event.id, id);
        if (selectedExpenseDetail?.id === id) {
          setSelectedExpenseDetail(null);
        }
        onRefresh();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Quick Settlement submit
  const handleQuickSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleFromId || !settleToId || !settleAmount) return;
    setSettleSubmitting(true);
    try {
      await api.recordSettlement(event.id, {
        from_member_id: settleFromId,
        to_member_id: settleToId,
        amount: parseFloat(settleAmount),
        currency: event.currency,
        notes: settleNotes.trim() || 'Remboursement direct'
      });
      setIsSettleModalOpen(false);
      setSettleNotes('');
      onRefresh();
      alert('Remboursement validé ! Les soldes ont été mis à jour.');
    } catch (err: any) {
      alert(err.message || 'Erreur lors du remboursement.');
    } finally {
      setSettleSubmitting(false);
    }
  };

  // Find current user's balance
  const currentMemberBalance = balances?.members.find(m => m.member_id === event.current_member_id);
  const myNet = currentMemberBalance ? currentMemberBalance.net_balance : 0;
  const isOwed = myNet > 0.009;
  const isDebtor = myNet < -0.009;

  // Find who I owe and who owes me from suggested_settlements
  const settlementsIOwe = balances?.suggested_settlements.filter(s => s.from_member_id === event.current_member_id) || [];
  const settlementsOwedToMe = balances?.suggested_settlements.filter(s => s.to_member_id === event.current_member_id) || [];

  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-5">
      {/* Tricount Personal Summary Banner */}
      {balances && (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                isOwed
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                  : isDebtor
                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
              }`}>
                <span className="material-symbols-outlined text-2xl">
                  {isOwed ? 'trending_up' : isDebtor ? 'trending_down' : 'balance'}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Mon Bilan Équitable (Tricount)
                </span>
                <div className="flex items-baseline gap-2">
                  <span className={`text-xl sm:text-2xl font-extrabold font-mono ${
                    isOwed
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : isDebtor
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {isOwed ? `+${myNet.toFixed(2)}` : myNet.toFixed(2)} {event.currency}
                  </span>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {isOwed ? 'à recevoir' : isDebtor ? 'à rembourser' : 'à l’équilibre'}
                  </span>
                </div>

                {/* Sub details */}
                {isDebtor && settlementsIOwe.length > 0 && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                    Tu dois {settlementsIOwe.map(s => `${s.amount.toFixed(2)} ${s.currency} à ${s.to_member_name}`).join(', ')}
                  </p>
                )}
                {isOwed && settlementsOwedToMe.length > 0 && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                    {settlementsOwedToMe.map(s => `${s.from_member_name} te doit ${s.amount.toFixed(2)} ${s.currency}`).join(', ')}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isDebtor && settlementsIOwe.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const firstDebt = settlementsIOwe[0];
                    setSettleFromId(firstDebt.from_member_id);
                    setSettleToId(firstDebt.to_member_id);
                    setSettleAmount(firstDebt.amount.toFixed(2));
                    setIsSettleModalOpen(true);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">send</span>
                  <span>Rembourser ({settlementsIOwe[0].amount.toFixed(2)} {event.currency})</span>
                </button>
              )}

              {onNavigateBalances && (
                <button
                  type="button"
                  onClick={onNavigateBalances}
                  className="px-3.5 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">balance</span>
                  <span>Voir tous les soldes</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Expense Header */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600 text-xl">payments</span>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
              Dépenses Enregistrées
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Total des dépenses : <span className="font-bold text-slate-900 dark:text-white font-mono">{totalSpent.toFixed(2)} {event.currency}</span> ({expenses.length} dépense{expenses.length > 1 ? 's' : ''})
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAddModal}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 cursor-pointer flex-shrink-0"
        >
          <span className="material-symbols-outlined text-base">add</span>
          <span>Ajouter une dépense</span>
        </button>
      </div>

      {/* Expenses List or Empty State */}
      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <span className="material-symbols-outlined animate-spin text-2xl mb-1 text-blue-600">refresh</span>
          <p className="text-xs">Chargement des dépenses...</p>
        </div>
      ) : expenses.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700 p-8 shadow-xs">
          <EmptyState
            icon="payments"
            title="Aucune dépense enregistrée."
            description="Enregistrez votre premier ticket, achat de courses ou réservation pour que l'application calcule automatiquement les soldes."
            actionText="Ajouter ma première dépense"
            onAction={handleOpenAddModal}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {expenses.map((exp) => (
            <div
              key={exp.id}
              onClick={() => setSelectedExpenseDetail(exp)}
              className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-300 dark:hover:border-blue-700 shadow-xs flex items-center justify-between gap-4 cursor-pointer transition-all"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-xl">
                    {exp.category === 'Courses' ? 'shopping_cart' : exp.category === 'Transport' ? 'directions_car' : exp.category === 'Hébergement' ? 'hotel' : 'receipt'}
                  </span>
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                    {exp.title}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 font-medium mt-0.5">
                    <span className="text-slate-600 dark:text-slate-300 font-bold">Payé par {exp.payer_name}</span>
                    <span>•</span>
                    <span>{exp.category}</span>
                    <span>•</span>
                    <span>{new Date(exp.date).toLocaleDateString('fr-FR')}</span>
                    {exp.receipt_url && (
                      <span className="text-blue-600 dark:text-blue-400 flex items-center gap-0.5 font-bold">
                        <span className="material-symbols-outlined text-xs">attach_file</span>
                        <span>Ticket</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <span className="text-sm sm:text-base font-extrabold font-mono text-slate-900 dark:text-white block">
                    {exp.amount.toFixed(2)} {exp.currency}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block">
                    Pour {exp.splits.length} participant{exp.splits.length > 1 ? 's' : ''}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={(e) => handleDeleteExpense(exp.id, e)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                  title="Supprimer la dépense"
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Detailed Expense Breakdown (Tricount View) */}
      <Modal
        isOpen={!!selectedExpenseDetail}
        onClose={() => setSelectedExpenseDetail(null)}
        title={selectedExpenseDetail?.title || 'Détail de la dépense'}
        subtitle={`Payé par ${selectedExpenseDetail?.payer_name} le ${selectedExpenseDetail ? new Date(selectedExpenseDetail.date).toLocaleDateString('fr-FR') : ''}`}
      >
        {selectedExpenseDetail && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl flex items-center justify-between border border-slate-200/80 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Montant Total
                </span>
                <span className="text-xl font-mono font-extrabold text-slate-900 dark:text-white">
                  {selectedExpenseDetail.amount.toFixed(2)} {selectedExpenseDetail.currency}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Catégorie
                </span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {selectedExpenseDetail.category}
                </span>
              </div>
            </div>

            {selectedExpenseDetail.notes && (
              <p className="text-xs text-slate-500 italic bg-blue-50/50 dark:bg-slate-800/50 p-3 rounded-xl border border-blue-100 dark:border-slate-700">
                « {selectedExpenseDetail.notes} »
              </p>
            )}

            {/* Split breakdown among participants */}
            <div>
              <h5 className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                Répartition entre les participants ({selectedExpenseDetail.splits.length})
              </h5>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {selectedExpenseDetail.splits.map((sp) => (
                  <div
                    key={sp.id}
                    className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-[10px] text-slate-600 dark:text-slate-300">
                        {sp.member_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {sp.member_name}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {sp.amount.toFixed(2)} {selectedExpenseDetail.currency}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Receipt Preview if available */}
            {selectedExpenseDetail.receipt_url && (
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Justificatif / Ticket de caisse
                </span>
                <a
                  href={selectedExpenseDetail.receipt_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline"
                >
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                  <span>Ouvrir la photo du justificatif en plein écran</span>
                </a>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedExpenseDetail(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Ajouter une Dépense avec sélecteur de participants Tricount */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Ajouter une dépense"
        subtitle="Déclarez un achat ou une réservation et choisissez qui est concerné"
      >
        <form onSubmit={handleAddExpenseSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-2xl text-xs font-medium border border-red-100">
              {error}
            </div>
          )}

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Titre / Objet de la dépense *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Courses Carrefour, Billets de train, Barbecue..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-100 outline-hidden focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
                Montant total ({event.currency}) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-mono font-bold text-slate-800 dark:text-slate-100 outline-hidden focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
                Qui a payé ? *
              </label>
              <select
                value={payerId}
                onChange={(e) => setPayerId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-hidden focus:border-blue-500 cursor-pointer"
              >
                {(event.members || []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_title} {m.id === event.current_member_id ? '(Moi)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
                Catégorie
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-100 outline-hidden cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
                Mode de partage (Tricount)
              </label>
              <select
                value={splitMode}
                onChange={(e) => setSplitMode(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-hidden cursor-pointer"
              >
                <option value="equal">Équitable (parts égales)</option>
                <option value="exact">Montants exacts personnalisés</option>
                <option value="shares">Parts / Pondérations</option>
              </select>
            </div>
          </div>

          {/* TRICOUNT PARTICIPANTS CHECKBOX SELECTOR */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider block">
                  Pour qui ? ({selectedMemberCount} / {(event.members || []).length} participants)
                </label>
                {splitMode === 'equal' && selectedMemberCount > 0 && numAmount > 0 && (
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                    ≈ {equalPerPerson.toFixed(2)} {event.currency} / personne
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleSelectAll(true)}
                  className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                >
                  Tous
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={() => handleSelectAll(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
                >
                  Aucun
                </button>
              </div>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {(event.members || []).map((m) => {
                const isChecked = !!includedMembers[m.id];
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs"
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          setIncludedMembers(prev => ({ ...prev, [m.id]: e.target.checked }));
                        }}
                        className="w-4 h-4 rounded text-blue-600"
                      />
                      <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                        {m.display_title} {m.id === event.current_member_id ? '(Moi)' : ''}
                      </span>
                    </label>

                    {isChecked && splitMode === 'exact' && (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={customSplits[m.id] || ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCustomSplits(prev => ({ ...prev, [m.id]: v }));
                          }}
                          className="w-16 px-1.5 py-1 text-right bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                        />
                        <span className="text-[10px] text-slate-400">{event.currency}</span>
                      </div>
                    )}

                    {isChecked && splitMode === 'shares' && (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.5"
                          placeholder="1"
                          value={customSplits[m.id] || ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCustomSplits(prev => ({ ...prev, [m.id]: v }));
                          }}
                          className="w-12 px-1.5 py-1 text-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold"
                        />
                        <span className="text-[10px] text-slate-400">part(s)</span>
                      </div>
                    )}

                    {isChecked && splitMode === 'equal' && (
                      <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px] font-bold">
                        {equalPerPerson.toFixed(2)} {event.currency}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Ticket ou justificatif (photo)
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Remarques
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Achat partagé uniquement pour le dîner de samedi"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-100 outline-hidden"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting || uploading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50"
            >
              {uploading ? 'Envoi photo...' : submitting ? 'Enregistrement...' : 'Valider la dépense'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick Settlement Modal (Tricount Reimbursement) */}
      <Modal
        isOpen={isSettleModalOpen}
        onClose={() => setIsSettleModalOpen(false)}
        title="Enregistrer un remboursement"
        subtitle="Équilibrez vos comptes avec un participant"
      >
        <form onSubmit={handleQuickSettleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
                Qui a remboursé ?
              </label>
              <select
                value={settleFromId}
                onChange={(e) => setSettleFromId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              >
                {(event.members || []).map(m => (
                  <option key={m.id} value={m.id}>{m.display_title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
                Destinataire
              </label>
              <select
                value={settleToId}
                onChange={(e) => setSettleToId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              >
                {(event.members || []).map(m => (
                  <option key={m.id} value={m.id}>{m.display_title}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Montant remboursé ({event.currency})
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={settleAmount}
              onChange={(e) => setSettleAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Moyen / Note
            </label>
            <input
              type="text"
              value={settleNotes}
              onChange={(e) => setSettleNotes(e.target.value)}
              placeholder="Ex: Virement instantané, Lydia, Espèces..."
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
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
              disabled={settleSubmitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
            >
              {settleSubmitting ? 'Validation...' : 'Confirmer le remboursement'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
