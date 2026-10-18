import React, { useEffect, useState } from 'react';
import { EventItem, GroceryItem, Expense, BalancesData, Settlement } from '../types';
import { GroceriesTab } from './GroceriesTab';
import { ExpensesTab } from './ExpensesTab';
import { BalancesTab } from './BalancesTab';
import { QRCodeModal } from '../components/QRCodeModal';
import { AIAssistantModal } from '../components/AIAssistantModal';
import { api } from '../api/client';

interface EventDetailProps {
  eventId: string;
  onBack: () => void;
  activeSubTab: 'groceries' | 'expenses' | 'balances';
  onChangeSubTab: (tab: 'groceries' | 'expenses' | 'balances') => void;
  onEventDeleted?: () => void;
}

export const EventDetail: React.FC<EventDetailProps> = ({
  eventId,
  onBack,
  activeSubTab,
  onChangeSubTab,
  onEventDeleted
}) => {
  const [event, setEvent] = useState<EventItem | null>(null);
  const [groceries, setGroceries] = useState<GroceryItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<BalancesData | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);

  const fetchEventData = async () => {
    try {
      const [evData, grocData, expData, balData, setlData] = await Promise.all([
        api.getEvent(eventId),
        api.getGroceries(eventId),
        api.getExpenses(eventId),
        api.getBalances(eventId),
        api.getSettlements(eventId)
      ]);
      setEvent(evData);
      setGroceries(grocData);
      setExpenses(expData);
      setBalances(balData);
      setSettlements(setlData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEventData();
  }, [eventId]);

  if (loading || !event) {
    return (
      <div className="py-20 text-center text-slate-400">
        <span className="material-symbols-outlined animate-spin text-3xl mb-2 text-blue-600">refresh</span>
        <p className="text-xs font-semibold">Chargement de l'événement...</p>
      </div>
    );
  }

  const handleDeleteEvent = async () => {
    if (!event) return;
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement l'événement « ${event.title} » ainsi que toutes ses courses et dépenses associées ?`)) {
      return;
    }
    try {
      await api.deleteEvent(event.id);
      if (onEventDeleted) {
        onEventDeleted();
      } else {
        onBack();
      }
    } catch (err: any) {
      alert(err.message || "Erreur lors de la suppression de l'événement.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Event Header Banner */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={onBack}
              className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0 mt-0.5"
              title="Retour aux événements"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
            </button>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-2xl">{event.icon || '🎉'}</span>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {event.title}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900">
                  {event.access_mode === 'guest' ? '🔗 Invités libres' : '🔒 SSO requis'}
                </span>
              </div>

              {event.description && (
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
                  {event.description}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-400 dark:text-slate-500 mt-2">
                {event.date && (
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-blue-600">calendar_today</span>
                    <span>{new Date(event.date).toLocaleDateString('fr-FR')}</span>
                  </div>
                )}
                {event.location && (
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-emerald-600">location_on</span>
                    <span>{event.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-purple-600">group</span>
                  <span>{event.members?.length || 1} participant(s)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">share</span>
              <span>Partager</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAIModalOpen(true)}
              className="px-3.5 py-2.5 bg-purple-50 dark:bg-slate-700 hover:bg-purple-100 text-purple-700 dark:text-purple-300 rounded-2xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
              title="Conseils IA"
            >
              <span className="material-symbols-outlined text-base">smart_toy</span>
              <span className="hidden sm:inline">IA</span>
            </button>
            {event.is_organizer && (
              <button
                type="button"
                onClick={handleDeleteEvent}
                className="px-3.5 py-2.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-2xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                title="Supprimer définitivement cet événement"
              >
                <span className="material-symbols-outlined text-base">delete</span>
                <span className="hidden sm:inline">Supprimer</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 border-t border-slate-100 dark:border-slate-700/80 pt-4 mt-5">
          <button
            type="button"
            onClick={() => onChangeSubTab('groceries')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'groceries'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <span className="material-symbols-outlined text-base">shopping_basket</span>
            <span>Courses en Magasin ({groceries.length})</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeSubTab('expenses')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'expenses'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <span className="material-symbols-outlined text-base">receipt_long</span>
            <span>Dépenses ({expenses.length})</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeSubTab('balances')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'balances'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <span className="material-symbols-outlined text-base">balance</span>
            <span>Soldes & Équilibrage</span>
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      {activeSubTab === 'groceries' && (
        <GroceriesTab
          event={event}
          groceries={groceries}
          loading={loading}
          onRefresh={fetchEventData}
          onOpenAI={() => setIsAIModalOpen(true)}
        />
      )}

      {activeSubTab === 'expenses' && (
        <ExpensesTab
          event={event}
          expenses={expenses}
          balances={balances}
          settlements={settlements}
          loading={loading}
          onRefresh={fetchEventData}
          onNavigateBalances={() => onChangeSubTab('balances')}
        />
      )}

      {activeSubTab === 'balances' && (
        <BalancesTab
          event={event}
          balances={balances}
          settlements={settlements}
          loading={loading}
          onRefresh={fetchEventData}
        />
      )}

      {/* Share Modal */}
      <QRCodeModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        event={event}
      />

      {/* AI Assistant Modal */}
      <AIAssistantModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        event={event}
        onGroceriesAdded={fetchEventData}
      />
    </div>
  );
};
