import React, { useState } from 'react';
import { EventItem, GroceryItem } from '../types';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { api } from '../api/client';

interface GroceriesTabProps {
  event: EventItem;
  groceries: GroceryItem[];
  loading: boolean;
  onRefresh: () => void;
  onOpenAI: () => void;
}

export const GroceriesTab: React.FC<GroceriesTabProps> = ({
  event,
  groceries,
  loading,
  onRefresh,
  onOpenAI
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [quickName, setQuickName] = useState('');
  const [quickQty, setQuickQty] = useState('1');
  const [quickUnit, setQuickUnit] = useState('pièce');
  const [quickCat, setQuickCat] = useState('Fruits & Légumes');
  const [quickPrice, setQuickPrice] = useState('');
  const [adding, setAdding] = useState(false);

  // Convert to expense state
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState('Ticket Supermarché');
  const [customTotal, setCustomTotal] = useState('');
  const [converting, setConverting] = useState(false);

  const categories = [
    'Fruits & Légumes',
    'Boucherie & Poissonnerie',
    'Produits Frais & Laitiers',
    'Épicerie Salée',
    'Épicerie Sucrée',
    'Boissons',
    'Hygiène & Entretien',
    'Autre'
  ];

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickName.trim()) return;
    setAdding(true);
    try {
      await api.addGrocery(event.id, {
        name: quickName.trim(),
        quantity: parseFloat(quickQty) || 1,
        unit: quickUnit,
        category: quickCat,
        estimated_price: quickPrice ? parseFloat(quickPrice) : undefined
      });
      setQuickName('');
      setQuickPrice('');
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  const handleToggleBought = async (item: GroceryItem) => {
    try {
      await api.updateGrocery(event.id, item.id, {
        is_bought: !item.is_bought
      });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteItem = async (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteGrocery(event.id, itemId);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleConvertToExpense = async () => {
    setConverting(true);
    try {
      await api.convertGroceriesToExpense(
        event.id,
        expenseTitle.trim() || 'Ticket de courses',
        customTotal ? parseFloat(customTotal) : undefined
      );
      setIsConvertModalOpen(false);
      onRefresh();
      alert('Dépense créée avec succès à partir de vos courses !');
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la conversion.');
    } finally {
      setConverting(false);
    }
  };

  // Stats
  const totalItems = groceries.length;
  const boughtItems = groceries.filter(g => g.is_bought).length;
  const totalEstimated = groceries.reduce((sum, g) => sum + (g.estimated_price || 0), 0);
  const boughtEstimated = groceries.filter(g => g.is_bought).reduce((sum, g) => sum + (g.estimated_price || 0), 0);
  const progressPct = totalItems > 0 ? Math.round((boughtItems / totalItems) * 100) : 0;

  const filteredGroceries = selectedCategory === 'all'
    ? groceries
    : groceries.filter(g => g.category === selectedCategory);

  return (
    <div className="space-y-5">
      {/* Supermarket In-Store Summary Card */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 text-xl">shopping_cart</span>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                Panier de Courses en Magasin
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Cochez les articles au fur et à mesure de votre passage dans les rayons.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {boughtItems > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCustomTotal(boughtEstimated > 0 ? boughtEstimated.toFixed(2) : '');
                  setIsConvertModalOpen(true);
                }}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">receipt_long</span>
                <span>Enregistrer en Dépense ({boughtItems})</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenAI}
              className="px-3 py-2 bg-blue-50 dark:bg-slate-700 hover:bg-blue-100 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">smart_toy</span>
              <span className="hidden sm:inline">Idées IA</span>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>
              {boughtItems} sur {totalItems} dans le caddie ({progressPct}%)
            </span>
            <span className="font-mono text-blue-600 dark:text-blue-400">
              {totalEstimated > 0 ? `Total estimé : ${totalEstimated.toFixed(2)} ${event.currency}` : ''}
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Quick Add Bar */}
      <form
        onSubmit={handleQuickAdd}
        className="bg-white dark:bg-slate-800 p-3.5 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-xs flex flex-wrap sm:flex-nowrap items-center gap-2"
      >
        <div className="flex-1 min-w-[160px]">
          <input
            type="text"
            required
            value={quickName}
            onChange={(e) => setQuickName(e.target.value)}
            placeholder="Ajouter un article rapide (ex: Tomates, Eau, Pain...)"
            className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-100 outline-hidden focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <input
            type="number"
            step="any"
            value={quickQty}
            onChange={(e) => setQuickQty(e.target.value)}
            className="w-16 px-2.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-center font-bold outline-hidden"
            title="Quantité"
          />
          <select
            value={quickUnit}
            onChange={(e) => setQuickUnit(e.target.value)}
            className="px-2.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs outline-hidden"
          >
            <option value="pièce">pièce</option>
            <option value="kg">kg</option>
            <option value="g">g</option>
            <option value="L">L</option>
            <option value="pack">pack</option>
            <option value="bouteille">bouteille</option>
          </select>
          <select
            value={quickCat}
            onChange={(e) => setQuickCat(e.target.value)}
            className="hidden md:block px-2.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs outline-hidden"
          >
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            type="number"
            step="0.01"
            value={quickPrice}
            onChange={(e) => setQuickPrice(e.target.value)}
            placeholder="Prix"
            className="w-20 px-2.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-center outline-hidden"
            title="Prix estimé (optionnel)"
          />
          <button
            type="submit"
            disabled={adding || !quickName.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold shadow-xs transition-colors cursor-pointer flex-shrink-0 disabled:opacity-50"
          >
            Ajouter
          </button>
        </div>
      </form>

      {/* Category Filter Pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            selectedCategory === 'all'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-50'
          }`}
        >
          Tous ({groceries.length})
        </button>
        {categories.map((cat) => {
          const count = groceries.filter(g => g.category === cat).length;
          if (count === 0 && selectedCategory !== cat) return null;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Groceries List or Empty State */}
      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <span className="material-symbols-outlined animate-spin text-2xl mb-1 text-blue-600">refresh</span>
          <p className="text-xs">Chargement de la liste de courses...</p>
        </div>
      ) : filteredGroceries.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700 p-6 shadow-xs">
          <EmptyState
            icon="checklist_rtl"
            title="Aucune course pour le moment."
            description="Ajoutez les articles à acheter ou demandez à l'assistant IA de vous proposer une liste sur-mesure."
            actionText="Demander des suggestions à l'IA"
            onAction={onOpenAI}
          />
        </div>
      ) : (
        <div className="space-y-2">
          {filteredGroceries.map((item) => (
            <div
              key={item.id}
              onClick={() => handleToggleBought(item)}
              className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                item.is_bought
                  ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 text-slate-400 dark:text-slate-500'
                  : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 hover:border-blue-300 text-slate-800 dark:text-slate-100 shadow-xs'
              }`}
            >
              {/* Left Checkbox & Name */}
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors flex-shrink-0 ${
                  item.is_bought
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600'
                }`}>
                  {item.is_bought && (
                    <span className="material-symbols-outlined text-base">check</span>
                  )}
                </div>

                <div className="min-w-0">
                  <span className={`text-xs sm:text-sm font-bold block truncate ${
                    item.is_bought ? 'line-through text-slate-400 dark:text-slate-500' : ''
                  }`}>
                    {item.name}
                  </span>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                    <span>{item.category}</span>
                    {item.assigned_to_name && (
                      <span className="text-blue-600 dark:text-blue-400">
                        • {item.assigned_to_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Qty & Price & Delete */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold">
                  {item.quantity} {item.unit}
                </span>

                {item.estimated_price !== undefined && item.estimated_price !== null && (
                  <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                    {item.estimated_price.toFixed(2)} {event.currency}
                  </span>
                )}

                <button
                  type="button"
                  onClick={(e) => handleDeleteItem(item.id, e)}
                  className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                  title="Supprimer"
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Convertir en Dépense */}
      <Modal
        isOpen={isConvertModalOpen}
        onClose={() => setIsConvertModalOpen(false)}
        title="Créer une dépense depuis les courses"
        subtitle={`Enregistrez les ${boughtItems} articles achetés en une seule dépense partagée`}
      >
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Libellé de la dépense
            </label>
            <input
              type="text"
              value={expenseTitle}
              onChange={(e) => setExpenseTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-100 outline-hidden"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Montant total payé en caisse ({event.currency})
            </label>
            <input
              type="number"
              step="0.01"
              value={customTotal}
              onChange={(e) => setCustomTotal(e.target.value)}
              placeholder="Montant du ticket"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-mono font-bold text-slate-800 dark:text-slate-100 outline-hidden"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Ce montant sera partagé équitablement entre tous les participants actifs de l'événement.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsConvertModalOpen(false)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={converting}
              onClick={handleConvertToExpense}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
            >
              {converting ? 'Enregistrement...' : 'Valider la dépense'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
