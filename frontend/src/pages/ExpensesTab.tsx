import React, { useState } from 'react';
import { EventItem, Expense } from '../types';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { api } from '../api/client';

interface ExpensesTabProps {
  event: EventItem;
  expenses: Expense[];
  loading: boolean;
  onRefresh: () => void;
}

export const ExpensesTab: React.FC<ExpensesTabProps> = ({
  event,
  expenses,
  loading,
  onRefresh
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [payerId, setPayerId] = useState(event.members?.[0]?.id || '');
  const [category, setCategory] = useState('Courses');
  const [splitMode, setSplitMode] = useState<'equal' | 'exact' | 'shares'>('equal');
  const [notes, setNotes] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const categories = ['Courses', 'Nourriture', 'Transport', 'Hébergement', 'Loisirs', 'Autre'];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReceiptFile(e.target.files[0]);
    }
  };

  const handleAddExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount) return;

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

      await api.createExpense(event.id, {
        title: title.trim(),
        amount: parseFloat(amount),
        currency: event.currency,
        payer_id: payerId || event.members?.[0]?.id,
        category,
        split_mode: splitMode,
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

  const handleDeleteExpense = async (id: string) => {
    if (confirm('Voulez-vous supprimer cette dépense ?')) {
      try {
        await api.deleteExpense(event.id, id);
        onRefresh();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-5">
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
            Total des dépenses déclarées : <span className="font-bold text-slate-900 dark:text-white font-mono">{totalSpent.toFixed(2)} {event.currency}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setPayerId(event.current_member_id || event.members?.[0]?.id || '');
            setIsAddModalOpen(true);
          }}
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
            onAction={() => {
              setPayerId(event.current_member_id || event.members?.[0]?.id || '');
              setIsAddModalOpen(true);
            }}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {expenses.map((exp) => (
            <div
              key={exp.id}
              className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-xl">receipt</span>
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
                      <a
                        href={exp.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-0.5 font-bold"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="material-symbols-outlined text-xs">attach_file</span>
                        <span>Justificatif</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <span className="text-sm sm:text-base font-extrabold font-mono text-slate-900 dark:text-white block">
                    {exp.amount.toFixed(2)} {exp.currency}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    Partagé à {exp.splits.length}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteExpense(exp.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                  title="Supprimer la dépense"
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Ajouter Dépense */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Ajouter une dépense"
        subtitle="Déclarez un achat ou une réservation pour cet événement"
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
              placeholder="Ex: Courses Carrefour, Billets de train, Location..."
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
                Payé par *
              </label>
              <select
                value={payerId}
                onChange={(e) => setPayerId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-hidden"
              >
                {event.members?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_title} {m.role === 'organizer' ? '(Organisateur)' : ''}
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
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-100 outline-hidden"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
                Répartition
              </label>
              <select
                value={splitMode}
                onChange={(e) => setSplitMode(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-100 outline-hidden"
              >
                <option value="equal">Égalitaire (tous les membres)</option>
              </select>
            </div>
          </div>

          {/* Receipt attachment file */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Ticket de caisse / Justificatif photo (Drive / Local)
            </label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-600 dark:text-slate-300 outline-hidden"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Notes (facultatif)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Détails complémentaires..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-100 outline-hidden focus:border-blue-500"
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
              {uploading ? 'Envoi justificatif...' : submitting ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
