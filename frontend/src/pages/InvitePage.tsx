import React, { useEffect, useState } from 'react';
import { PublicInviteInfo } from '../types';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface InvitePageProps {
  token: string;
  onJoined: (eventId: string) => void;
}

export const InvitePage: React.FC<InvitePageProps> = ({ token, onJoined }) => {
  const { actor, login } = useAuth();
  const [info, setInfo] = useState<PublicInviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const data = await api.getPublicInvite(token);
        setInfo(data);
      } catch (err: any) {
        setError(err.message || 'Impossible de charger l’invitation.');
      } finally {
        setLoading(false);
      }
    };
    fetchInfo();
  }, [token]);

  const handleJoinSSO = async () => {
    if (!actor) {
      login(window.location.pathname);
      return;
    }
    setJoining(true);
    setError('');
    try {
      const res = await api.joinInvite(token);
      onJoined(res.event_id);
    } catch (err: any) {
      setError(err.message || 'Erreur pour rejoindre.');
    } finally {
      setJoining(false);
    }
  };

  const handleJoinGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;
    setJoining(true);
    setError('');
    try {
      const res = await api.joinInvite(token, guestName.trim());
      onJoined(res.event_id);
    } catch (err: any) {
      setError(err.message || 'Erreur pour rejoindre.');
    } finally {
      setJoining(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <span className="material-symbols-outlined animate-spin text-4xl text-blue-600 mb-2">refresh</span>
          <p className="text-xs font-semibold text-slate-500">Chargement de l'invitation...</p>
        </div>
      </div>
    );
  }

  if (error || !info || !info.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-red-50 text-red-600 flex items-center justify-center mx-auto text-3xl">
            <span className="material-symbols-outlined">link_off</span>
          </div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
            Invitation indisponible
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {info?.message || error || "Ce lien d'invitation n'est plus actif ou est invalide."}
          </p>
          <a
            href="/"
            className="inline-block px-5 py-2.5 bg-blue-600 text-white rounded-full text-xs font-bold hover:bg-blue-700 transition-colors"
          >
            Retour à l'accueil
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#f8fafc] dark:bg-slate-900">
      <div className="w-full max-w-lg bg-white dark:bg-slate-800 p-7 sm:p-10 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-xl space-y-6 text-center">
        {/* Brand Header */}
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 rounded-full text-xs font-bold">
          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
          <span>Invitation GroupEvent • oussamma.tn</span>
        </div>

        {/* Event Icon & Title */}
        <div className="space-y-2">
          <div className="w-20 h-20 rounded-3xl bg-blue-50 dark:bg-slate-700 flex items-center justify-center text-4xl mx-auto shadow-sm">
            {info.event_icon || '🎉'}
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {info.event_title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Organisé par <span className="font-bold text-slate-800 dark:text-slate-200">{info.organizer_name}</span>
          </p>
        </div>

        {/* Event Details */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-700 text-xs space-y-2 text-left">
          {info.event_description && (
            <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
              {info.event_description}
            </p>
          )}
          <div className="flex flex-wrap gap-4 pt-1 font-semibold text-slate-500 dark:text-slate-400 text-[11px]">
            {info.event_date && (
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-blue-600">event</span>
                <span>{new Date(info.event_date).toLocaleDateString('fr-FR')}</span>
              </div>
            )}
            {info.event_location && (
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-emerald-600">location_on</span>
                <span>{info.event_location}</span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-2xl text-xs font-medium">
            {error}
          </div>
        )}

        {/* Join Actions */}
        <div className="space-y-3 pt-2">
          {actor ? (
            <button
              type="button"
              disabled={joining}
              onClick={handleJoinSSO}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-lg">login</span>
              <span>{joining ? 'Connexion à l’événement...' : `Rejoindre en tant que ${actor.display_name}`}</span>
            </button>
          ) : (
            <>
              {/* Guest join form if allowed */}
              {info.mode === 'guest' && (
                <form onSubmit={handleJoinGuest} className="space-y-2 text-left">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
                    Rejoindre en tant qu'invité (sans compte)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Votre prénom ou surnom"
                      className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-100 outline-hidden focus:border-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={joining || !guestName.trim()}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {joining ? 'Entrée...' : 'Rejoindre'}
                    </button>
                  </div>
                </form>
              )}

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-bold">
                  <span className="bg-white dark:bg-slate-800 px-3 text-slate-400">ou</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => login(window.location.pathname)}
                className="w-full py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-slate-100 rounded-2xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">verified_user</span>
                <span>Se connecter avec le SSO oussamma.tn</span>
              </button>
            </>
          )}
        </div>

        {/* Share buttons */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={handleCopy}
            className="text-slate-500 hover:text-blue-600 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">
              {copied ? 'check' : 'content_copy'}
            </span>
            <span>{copied ? 'Lien copié !' : 'Copier le lien'}</span>
          </button>

          <a
            href="/"
            className="text-slate-400 hover:text-slate-600 font-medium"
          >
            Accueil GroupEvent
          </a>
        </div>
      </div>
    </div>
  );
};
