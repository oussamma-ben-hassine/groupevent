import React from 'react';

interface BottomNavProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenAI: () => void;
  hasActiveEvent?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenAI,
  hasActiveEvent
}) => {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 py-1.5 px-4 flex justify-around items-center z-40">
      <button
        type="button"
        onClick={() => onSelectTab('dashboard')}
        className={`flex flex-col items-center gap-0.5 cursor-pointer ${
          currentTab === 'dashboard'
            ? 'text-blue-600 dark:text-blue-400 font-bold'
            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 font-medium'
        }`}
      >
        <div className={`w-12 h-7 rounded-full flex items-center justify-center transition-all ${
          currentTab === 'dashboard' ? 'bg-blue-100 dark:bg-blue-900/40' : ''
        }`}>
          <span className="material-symbols-outlined text-lg">home</span>
        </div>
        <span className="text-[10px]">Accueil</span>
      </button>

      {hasActiveEvent && (
        <>
          <button
            type="button"
            onClick={() => onSelectTab('groceries')}
            className={`flex flex-col items-center gap-0.5 cursor-pointer ${
              currentTab === 'groceries'
                ? 'text-blue-600 dark:text-blue-400 font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 font-medium'
            }`}
          >
            <div className={`w-12 h-7 rounded-full flex items-center justify-center transition-all ${
              currentTab === 'groceries' ? 'bg-blue-100 dark:bg-blue-900/40' : ''
            }`}>
              <span className="material-symbols-outlined text-lg">shopping_basket</span>
            </div>
            <span className="text-[10px]">Courses</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('expenses')}
            className={`flex flex-col items-center gap-0.5 cursor-pointer ${
              currentTab === 'expenses'
                ? 'text-blue-600 dark:text-blue-400 font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 font-medium'
            }`}
          >
            <div className={`w-12 h-7 rounded-full flex items-center justify-center transition-all ${
              currentTab === 'expenses' ? 'bg-blue-100 dark:bg-blue-900/40' : ''
            }`}>
              <span className="material-symbols-outlined text-lg">payments</span>
            </div>
            <span className="text-[10px]">Dépenses</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('balances')}
            className={`flex flex-col items-center gap-0.5 cursor-pointer ${
              currentTab === 'balances'
                ? 'text-blue-600 dark:text-blue-400 font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 font-medium'
            }`}
          >
            <div className={`w-12 h-7 rounded-full flex items-center justify-center transition-all ${
              currentTab === 'balances' ? 'bg-blue-100 dark:bg-blue-900/40' : ''
            }`}>
              <span className="material-symbols-outlined text-lg">balance</span>
            </div>
            <span className="text-[10px]">Soldes</span>
          </button>
        </>
      )}

      <button
        type="button"
        onClick={onOpenAI}
        className="flex flex-col items-center gap-0.5 cursor-pointer text-slate-500 hover:text-slate-800 dark:text-slate-400 font-medium"
      >
        <div className="w-12 h-7 rounded-full flex items-center justify-center transition-all">
          <span className="material-symbols-outlined text-lg text-indigo-500">smart_toy</span>
        </div>
        <span className="text-[10px]">IA</span>
      </button>
    </nav>
  );
};
