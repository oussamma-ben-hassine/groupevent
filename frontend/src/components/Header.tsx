import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface HeaderProps {
  onOpenAI: () => void;
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({ onOpenAI, title }) => {
  const { actor, login } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 lg:px-8 bg-[#f8fafc]/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors">
      {/* Mobile Brand / Page Title */}
      <div className="flex items-center gap-3">
        <a href="/" className="lg:hidden flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <span className="material-symbols-outlined text-lg">groups</span>
          </div>
          <span className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
            GroupEvent
          </span>
        </a>

        {title && (
          <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <a href="/" className="hover:text-blue-600 transition-colors">Événements</a>
            <span>/</span>
            <span className="text-slate-900 dark:text-white font-bold">{title}</span>
          </div>
        )}
      </div>

      {/* Right Action Icons & Profile */}
      <div className="flex items-center gap-2.5">
        {/* Status Pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/60 rounded-full text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Actif</span>
        </div>

        {/* AI Assistant Button */}
        <button
          type="button"
          onClick={onOpenAI}
          className="px-3 py-1.5 bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          title="Assistant IA LiteLLM"
        >
          <span className="material-symbols-outlined text-base">smart_toy</span>
          <span className="hidden sm:inline">Assistant IA</span>
        </button>

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors shadow-xs cursor-pointer"
          title="Basculer thème clair / sombre"
        >
          <span className="material-symbols-outlined text-lg">
            {isDark ? 'light_mode' : 'dark_mode'}
          </span>
        </button>

        {/* User Profile or Login */}
        {actor ? (
          <div className="flex items-center gap-2 pl-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-xs overflow-hidden">
              {actor.avatar_url ? (
                <img src={actor.avatar_url} alt={actor.display_name} className="w-full h-full object-cover" />
              ) : (
                actor.display_name.charAt(0).toUpperCase()
              )}
            </div>
            <span className="hidden md:block text-xs font-bold text-slate-800 dark:text-slate-200">
              {actor.display_name}
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => login()}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">login</span>
            <span>Connexion SSO</span>
          </button>
        )}
      </div>
    </header>
  );
};
