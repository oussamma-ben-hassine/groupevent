import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenAI: () => void;
  onCreateEvent: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  onOpenAI,
  onCreateEvent
}) => {
  const { actor, login, logout } = useAuth();

  return (
    <aside className="hidden lg:flex flex-col justify-between w-60 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 p-5 fixed left-0 top-0 bottom-0 z-40 transition-colors">
      <div>
        {/* Brand Logo & Title */}
        <a href="/" className="flex items-center gap-2.5 px-2 mb-8 mt-1">
          <div className="w-9 h-9 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <span className="material-symbols-outlined text-xl">groups</span>
          </div>
          <div>
            <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white block leading-tight">
              GroupEvent
            </span>
            <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider block">
              oussamma.tn
            </span>
          </div>
        </a>

        {/* Quick Create Event CTA Button */}
        {actor && actor.type === 'user' && (
          <button
            type="button"
            onClick={onCreateEvent}
            className="w-full mb-6 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>Nouvel Événement</span>
          </button>
        )}

        {/* Navigation Menu */}
        <nav className="space-y-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => onSelectTab('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer ${
              currentTab === 'dashboard'
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-lg">home</span>
            <span>Tableau de Bord</span>
          </button>

          <button
            type="button"
            onClick={onOpenAI}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg text-indigo-500">smart_toy</span>
            <span>Assistant IA LiteLLM</span>
          </button>

          <a
            href="https://oussamma.tn"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">grid_view</span>
            <span>Portail oussamma.tn</span>
          </a>

          <a
            href="https://sso-a.oussamma.tn/profile"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">verified_user</span>
            <span>Sécurité SSO</span>
          </a>
        </nav>
      </div>

      {/* User Session Footer */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
        {actor ? (
          <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/60">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                {actor.display_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {actor.display_name}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                  {actor.type === 'guest' ? 'Session Invité' : actor.email || 'Compte SSO'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="w-full py-1.5 text-center text-[11px] font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors cursor-pointer"
            >
              Déconnexion
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => login()}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">login</span>
            <span>Se connecter</span>
          </button>
        )}
      </div>
    </aside>
  );
};
