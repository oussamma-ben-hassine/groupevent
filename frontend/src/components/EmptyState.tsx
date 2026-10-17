import React from 'react';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionText,
  onAction
}) => {
  return (
    <div className="py-12 sm:py-16 px-4 text-center max-w-md mx-auto">
      <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-slate-700 flex items-center justify-center mx-auto mb-4 shadow-sm">
        <span className="material-symbols-outlined text-3xl">{icon}</span>
      </div>
      <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight mb-1">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6 font-medium">
        {description}
      </p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          <span>{actionText}</span>
        </button>
      )}
    </div>
  );
};
