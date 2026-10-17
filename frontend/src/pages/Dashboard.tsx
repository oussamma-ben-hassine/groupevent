import React, { useState } from 'react';
import { EventItem } from '../types';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface DashboardProps {
  events: EventItem[];
  loading: boolean;
  onSelectEvent: (event: EventItem) => void;
  onRefreshEvents: () => void;
  isCreateModalOpen: boolean;
  onCloseCreateModal: () => void;
  onOpenCreateModal: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  events,
  loading,
  onSelectEvent,
  onRefreshEvents,
  isCreateModalOpen,
  onCloseCreateModal,
  onOpenCreateModal
}) => {
  const { actor, login } = useAuth();

  // Create form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [icon, setIcon] = useState('🎉');
  const [accessMode, setAccessMode] = useState<'link_sso' | 'guest' | 'private'>('guest');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError('');

    try {
      const newEv = await api.createEvent({
        title: title.trim(),
        description: description.trim() || undefined,
        date: date ? new Date(date).toISOString() : undefined,
        location: location.trim() || undefined,
        currency,
        icon,
        access_mode: accessMode
      });

      setTitle('');
      setDescription('');
      setDate('');
      setLocation('');
      onCloseCreateModal();
      onRefreshEvents();
      onSelectEvent(newEv);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la création de l'événement.");
    } finally {
      setCreating(false);
    }
  };

  const icons = ['🎉', '🍕', '🏖️', '🏕️', '🍻', '🍔', '✈️', '⛷️', '🎁', '🛒'];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900 rounded-full text-[11px] font-bold mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            <span>Écosystème oussamma.tn</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Vos Événements & Dépenses Partagées
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Organisez vos sorties, listes de courses en magasin et équilibrez vos budgets sans friction.
          </p>
        </div>

        {actor ? (
          <button
            type="button"
            onClick={onOpenCreateModal}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer flex-shrink-0"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>Créer un événement</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => login()}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer flex-shrink-0"
          >
            <span className="material-symbols-outlined text-base">login</span>
            <span>Connexion SSO</span>
          </button>
        )}
      </div>

      {/* Events Grid or Empty State */}
      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <span className="material-symbols-outlined animate-spin text-3xl mb-2 text-blue-600">refresh</span>
          <p className="text-xs font-medium">Chargement des événements...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700 p-8 shadow-xs">
          <EmptyState
            icon="event_busy"
            title="Vous n'avez pas encore d'événement."
            description="Créez votre premier événement pour préparer vos courses en magasin, inviter vos amis et enregistrer vos dépenses."
            actionText={actor ? "Créer mon premier événement" : "Se connecter pour créer un événement"}
            onAction={actor ? onOpenCreateModal : () => login()}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {events.map((ev) => (
            <div
              key={ev.id}
              onClick={() => onSelectEvent(ev)}
              className="group bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-400 dark:hover:border-blue-500 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-slate-700/60 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform flex-shrink-0">
                    {ev.icon || '🎉'}
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    ev.status === 'active'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                  }`}>
                    {ev.status === 'active' ? 'En cours' : 'Terminé'}
                  </span>
                </div>

                <h3 className="text-base font-extrabold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1 mb-1">
                  {ev.title}
                </h3>
                {ev.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-4">
                    {ev.description}
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-blue-600">group</span>
                  <span>{ev.member_count} {ev.member_count > 1 ? 'membres' : 'membre'}</span>
                </div>
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                  <span className="material-symbols-outlined text-base text-emerald-600">payments</span>
                  <span>{ev.total_expenses.toFixed(2)} {ev.currency}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Créer Événement */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={onCloseCreateModal}
        title="Créer un nouvel événement"
        subtitle="Renseignez les détails pour démarrer votre organisation"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-2xl text-xs font-medium border border-red-100">
              {error}
            </div>
          )}

          {/* Icon Selector */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
              Icône de l'événement
            </label>
            <div className="flex flex-wrap gap-2">
              {icons.map((ic) => (
                <button
                  type="button"
                  key={ic}
                  onClick={() => setIcon(ic)}
                  className={`w-10 h-10 rounded-2xl text-xl flex items-center justify-center transition-all cursor-pointer ${
                    icon === ic
                      ? 'bg-blue-100 dark:bg-blue-900/60 border-2 border-blue-600 scale-105'
                      : 'bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200'
                  }`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Nom de l'événement *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Barbecue Plage, Week-end Chalet, Soirée Pizza..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-100 outline-hidden focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Description (facultative)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Détails, horaires, consignes..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-100 outline-hidden focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-100 outline-hidden focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
                Devise
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-100 outline-hidden focus:border-blue-500"
              >
                <option value="EUR">Euro (€)</option>
                <option value="TND">Dinar Tunisien (TND)</option>
                <option value="USD">Dollar ($)</option>
                <option value="CHF">Franc Suisse (CHF)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Lieu
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ex: Maison de campagne, Plage de Gammarth..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-100 outline-hidden focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Mode de partage
            </label>
            <select
              value={accessMode}
              onChange={(e) => setAccessMode(e.target.value as any)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-100 outline-hidden focus:border-blue-500"
            >
              <option value="guest">🔗 Invité libre (partage par lien sans compte obligatoire)</option>
              <option value="link_sso">🔒 Connexion SSO obligatoire via le lien</option>
              <option value="private">🛡️ Privé (invitation manuelle uniquement)</option>
            </select>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onCloseCreateModal}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50"
            >
              {creating ? 'Création...' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
