import React, { useState, useRef } from 'react';
import { EventItem, GroceryItem, ReceiptScanResponse, ReceiptItemMatch, ReceiptExtractedItem } from '../types';
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
  // Main view filter:
  // 'all' | 'grocery' | 'material_group' | 'material_personal' | 'personal_purchase' | 'my_unpaid' | 'paid' | 'unassigned'
  const [viewFilter, setViewFilter] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Quick Add State
  const [quickName, setQuickName] = useState('');
  const [quickQty, setQuickQty] = useState('1');
  const [quickUnit, setQuickUnit] = useState('pièce');
  const [quickCat, setQuickCat] = useState('Fruits & Légumes');
  const [quickPrice, setQuickPrice] = useState('');
  const [quickType, setQuickType] = useState<'grocery' | 'material'>('grocery');
  const [quickScope, setQuickScope] = useState<'group' | 'personal'>('group');
  const [quickBeneficiary, setQuickBeneficiary] = useState<string>(event.current_member_id || '');
  const [adding, setAdding] = useState(false);

  // Full Detailed Add Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalName, setModalName] = useState('');
  const [modalQty, setModalQty] = useState('1');
  const [modalUnit, setModalUnit] = useState('pièce');
  const [modalCat, setModalCat] = useState('Autre');
  const [modalPrice, setModalPrice] = useState('');
  const [modalType, setModalType] = useState<'grocery' | 'material'>('grocery');
  const [modalScope, setModalScope] = useState<'group' | 'personal'>('group');
  const [modalBeneficiary, setModalBeneficiary] = useState<string>(event.current_member_id || '');
  const [modalAssigned, setModalAssigned] = useState<string>('');
  const [modalNotes, setModalNotes] = useState('');

  // Convert to Expense Modal
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState('Ticket Supermarché');
  const [customTotal, setCustomTotal] = useState('');
  const [converting, setConverting] = useState(false);

  // Receipt Scanner Modal & State
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [applyingReceipt, setApplyingReceipt] = useState(false);
  const [scanResult, setScanResult] = useState<ReceiptScanResponse | null>(null);
  const [selectedMatches, setSelectedMatches] = useState<Record<string, { price: number; included: boolean }>>({});
  const [selectedUnmatched, setSelectedUnmatched] = useState<Record<number, boolean>>({});
  const [createExpenseOnApply, setCreateExpenseOnApply] = useState(true);
  const [receiptPayerId, setReceiptPayerId] = useState<string>(event.current_member_id || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = [
    'Fruits & Légumes',
    'Boucherie & Poissonnerie',
    'Produits Frais & Laitiers',
    'Épicerie Salée',
    'Épicerie Sucrée',
    'Boissons',
    'Matériel & Ustensiles',
    'Hygiène & Entretien',
    'Autre'
  ];

  // Quick Add handler
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickName.trim()) return;
    setAdding(true);
    try {
      await api.addGrocery(event.id, {
        name: quickName.trim(),
        quantity: parseFloat(quickQty) || 1,
        unit: quickUnit,
        category: quickType === 'material' && quickCat === 'Fruits & Légumes' ? 'Matériel & Ustensiles' : quickCat,
        item_type: quickType,
        scope: quickScope,
        beneficiary_id: quickScope === 'personal' ? (quickBeneficiary || event.current_member_id) : undefined,
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

  // Detailed Modal Add handler
  const handleDetailedAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalName.trim()) return;
    setAdding(true);
    try {
      await api.addGrocery(event.id, {
        name: modalName.trim(),
        quantity: parseFloat(modalQty) || 1,
        unit: modalUnit,
        category: modalCat,
        item_type: modalType,
        scope: modalScope,
        beneficiary_id: modalScope === 'personal' ? (modalBeneficiary || event.current_member_id) : undefined,
        estimated_price: modalPrice ? parseFloat(modalPrice) : undefined,
        assigned_to_id: modalAssigned || undefined,
        notes: modalNotes.trim() || undefined
      });
      setIsAddModalOpen(false);
      setModalName('');
      setModalPrice('');
      setModalNotes('');
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  // Toggle is_bought (caddie / payé)
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

  // 1-click Claim / Release item
  // Note: user requested "tu peux le mettre à 'je m'en charge' sauf si n'est pas encore payé"
  const handleClaimToggle = async (item: GroceryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.is_bought) {
      alert("Cet article a déjà été payé en magasin ! Décochez-le d'abord si vous souhaitez modifier son statut.");
      return;
    }
    const isClaimedByMe = item.assigned_to_id === event.current_member_id;
    try {
      await api.claimGrocery(event.id, item.id, isClaimedByMe ? 'release' : 'claim');
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // Delete item
  const handleDeleteItem = async (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Supprimer cet article ?')) return;
    try {
      await api.deleteGrocery(event.id, itemId);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // Convert bought items to expense
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

  // Receipt File Selection & OCR Trigger
  const handleReceiptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    try {
      const res = await api.scanReceipt(event.id, file);
      setScanResult(res);

      const matchMap: Record<string, { price: number; included: boolean }> = {};
      res.matches.forEach(m => {
        matchMap[m.item_id] = { price: m.matched_price, included: true };
      });
      setSelectedMatches(matchMap);

      const unMap: Record<number, boolean> = {};
      res.unmatched_receipt_items.forEach((_, idx) => {
        unMap[idx] = false;
      });
      setSelectedUnmatched(unMap);

      if (res.store_name) {
        setExpenseTitle(`Ticket ${res.store_name}`);
      }
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'analyse du ticket.");
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Apply Receipt selections to event
  const handleApplyReceipt = async () => {
    if (!scanResult) return;
    setApplyingReceipt(true);
    try {
      const itemsToUpdate = Object.entries(selectedMatches)
        .filter(([_, data]) => data.included)
        .map(([itemId, data]) => ({
          item_id: itemId,
          actual_price: data.price,
          is_bought: true
        }));

      const newItemsToAdd = Object.entries(selectedUnmatched)
        .filter(([_, included]) => included)
        .map(([idxStr]) => {
          const item = scanResult.unmatched_receipt_items[parseInt(idxStr)];
          return {
            name: item.name,
            price: item.price,
            category: 'Autre',
            item_type: 'grocery' as const,
            scope: 'group' as const
          };
        });

      await api.applyReceipt(event.id, {
        items: itemsToUpdate,
        new_items: newItemsToAdd,
        create_expense: createExpenseOnApply,
        expense_title: expenseTitle || `Ticket ${scanResult.store_name || 'Courses'}`,
        payer_id: receiptPayerId || event.current_member_id,
        receipt_url: scanResult.receipt_image_url
      });

      setIsScanModalOpen(false);
      setScanResult(null);
      onRefresh();
      alert('Prix du ticket appliqués et achats enregistrés avec succès !');
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'application du ticket.");
    } finally {
      setApplyingReceipt(false);
    }
  };

  // Filter calculations
  const totalItems = groceries.length;
  const boughtItems = groceries.filter(g => g.is_bought).length;
  const totalEstimated = groceries.reduce((sum, g) => sum + (g.actual_price ?? g.estimated_price ?? 0), 0);
  const boughtTotal = groceries.filter(g => g.is_bought).reduce((sum, g) => sum + (g.actual_price ?? g.estimated_price ?? 0), 0);
  const progressPct = totalItems > 0 ? Math.round((boughtItems / totalItems) * 100) : 0;

  // View Filtering
  const viewFiltered = groceries.filter(item => {
    if (viewFilter === 'grocery') return item.item_type !== 'material' && item.scope !== 'personal';
    if (viewFilter === 'material_group') return item.item_type === 'material' && item.scope !== 'personal';
    if (viewFilter === 'material_personal') return item.item_type === 'material' && item.scope === 'personal';
    if (viewFilter === 'personal_purchase') return item.scope === 'personal' && item.item_type !== 'material';
    if (viewFilter === 'my_unpaid') return item.assigned_to_id === event.current_member_id && !item.is_bought;
    if (viewFilter === 'paid') return item.is_bought;
    if (viewFilter === 'unassigned') return !item.assigned_to_id && !item.is_bought;
    return true;
  });

  const finalFiltered = selectedCategory === 'all'
    ? viewFiltered
    : viewFiltered.filter(g => g.category === selectedCategory);

  // Dynamic placeholder based on selected type and scope
  const getQuickPlaceholder = () => {
    if (quickType === 'material') {
      if (quickScope === 'group') return 'Ex: Barbecue (BBQ), Pinces, Glacière, Grande table...';
      return 'Ex: Tente 2 places, Sac de couchage, Matelas, Serviette...';
    }
    if (quickScope === 'personal') return 'Ex: Shampoing spécial, Lait sans lactose pour moi...';
    return 'Ex: Tomates, Pain burger, Eau minérale, Merguez...';
  };

  return (
    <div className="space-y-5">
      {/* Supermarket & In-Store Dashboard Card */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 text-xl">shopping_cart</span>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                Panier de Courses & Matériel Partagé
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Chacun choisit ce qu'il apporte ou achète (« Je m'en charge »). Les articles passent au statut « Payé » lors du passage en caisse.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Receipt Scanner Button */}
            <button
              type="button"
              onClick={() => setIsScanModalOpen(true)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">document_scanner</span>
              <span>Scanner Ticket</span>
            </button>

            {/* Convert to Expense Button */}
            {boughtItems > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCustomTotal(boughtTotal > 0 ? boughtTotal.toFixed(2) : '');
                  setIsConvertModalOpen(true);
                }}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">receipt_long</span>
                <span>Enregistrer en Dépense ({boughtItems})</span>
              </button>
            )}

            {/* AI Assistant Button */}
            <button
              type="button"
              onClick={onOpenAI}
              className="px-3 py-2 bg-blue-50 dark:bg-slate-700 hover:bg-blue-100 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">smart_toy</span>
              <span className="hidden sm:inline">Idées IA</span>
            </button>

            {/* Detailed Add Item Button */}
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
              title="Ajouter un article avec options avancées"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              <span className="hidden sm:inline">Détaillé</span>
            </button>
          </div>
        </div>

        {/* Progress Bar & Totals */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>
              {boughtItems} sur {totalItems} payés / apportés ({progressPct}%)
            </span>
            <span className="font-mono text-blue-600 dark:text-blue-400">
              {totalEstimated > 0 ? `Total : ${totalEstimated.toFixed(2)} ${event.currency}` : ''}
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

      {/* Main View Filter Pills (Distinct Group vs Personal Material & Status) */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => setViewFilter('all')}
          className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            viewFilter === 'all'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700'
          }`}
        >
          <span>Tous</span>
          <span className="text-[10px] opacity-75">({groceries.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setViewFilter('grocery')}
          className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            viewFilter === 'grocery'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700'
          }`}
        >
          <span className="material-symbols-outlined text-sm">local_grocery_store</span>
          <span>Courses Groupe</span>
          <span className="text-[10px] opacity-75">
            ({groceries.filter(g => g.item_type !== 'material' && g.scope !== 'personal').length})
          </span>
        </button>

        {/* Group Material (Barbecue, Glacière, Tables...) */}
        <button
          type="button"
          onClick={() => setViewFilter('material_group')}
          className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            viewFilter === 'material_group'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700'
          }`}
        >
          <span className="material-symbols-outlined text-sm">outdoor_grill</span>
          <span>🔥 Matériel Groupe (BBQ...)</span>
          <span className="text-[10px] opacity-75">
            ({groceries.filter(g => g.item_type === 'material' && g.scope !== 'personal').length})
          </span>
        </button>

        {/* Personal Material (Tente, Sac de couchage...) */}
        <button
          type="button"
          onClick={() => setViewFilter('material_personal')}
          className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            viewFilter === 'material_personal'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700'
          }`}
        >
          <span className="material-symbols-outlined text-sm">camping</span>
          <span>⛺ Matériel Perso (Tente...)</span>
          <span className="text-[10px] opacity-75">
            ({groceries.filter(g => g.item_type === 'material' && g.scope === 'personal').length})
          </span>
        </button>

        {/* Personal Purchases (Achats spécifiques remboursés 100%) */}
        <button
          type="button"
          onClick={() => setViewFilter('personal_purchase')}
          className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            viewFilter === 'personal_purchase'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700'
          }`}
        >
          <span className="material-symbols-outlined text-sm">person</span>
          <span>Achats Perso</span>
          <span className="text-[10px] opacity-75">
            ({groceries.filter(g => g.scope === 'personal' && g.item_type !== 'material').length})
          </span>
        </button>

        {/* Mes choix non encore payés */}
        <button
          type="button"
          onClick={() => setViewFilter('my_unpaid')}
          className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            viewFilter === 'my_unpaid'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700'
          }`}
        >
          <span className="material-symbols-outlined text-sm">assignment_turned_in</span>
          <span>⭐ Mes choix (À acheter)</span>
          <span className="text-[10px] opacity-75">
            ({groceries.filter(g => g.assigned_to_id === event.current_member_id && !g.is_bought).length})
          </span>
        </button>

        {/* Déjà Payés en caisse */}
        <button
          type="button"
          onClick={() => setViewFilter('paid')}
          className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            viewFilter === 'paid'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700'
          }`}
        >
          <span className="material-symbols-outlined text-sm">check_circle</span>
          <span>💳 Déjà Payés</span>
          <span className="text-[10px] opacity-75">
            ({groceries.filter(g => g.is_bought).length})
          </span>
        </button>

        {/* À pourvoir */}
        <button
          type="button"
          onClick={() => setViewFilter('unassigned')}
          className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            viewFilter === 'unassigned'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700'
          }`}
        >
          <span className="material-symbols-outlined text-sm">hourglass_empty</span>
          <span>À pourvoir</span>
          <span className="text-[10px] opacity-75">
            ({groceries.filter(g => !g.assigned_to_id && !g.is_bought).length})
          </span>
        </button>
      </div>

      {/* Quick Add Bar with Explicit Material Group vs Personal Switch */}
      <form
        onSubmit={handleQuickAdd}
        className="bg-white dark:bg-slate-800 p-3.5 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-xs flex flex-wrap sm:flex-nowrap items-center gap-2"
      >
        {/* Type toggle: Grocery vs Material */}
        <select
          value={quickType}
          onChange={(e) => setQuickType(e.target.value as any)}
          className="px-2.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold outline-hidden cursor-pointer"
        >
          <option value="grocery">🛒 Course</option>
          <option value="material">🍳 Matériel</option>
        </select>

        {/* Scope toggle: Group vs Personal */}
        <select
          value={quickScope}
          onChange={(e) => setQuickScope(e.target.value as any)}
          className="px-2.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold outline-hidden cursor-pointer"
        >
          {quickType === 'material' ? (
            <>
              <option value="group">🔥 Matériel Groupe (BBQ...)</option>
              <option value="personal">⛺ Matériel Perso (Tente...)</option>
            </>
          ) : (
            <>
              <option value="group">👥 Groupe (Partagé)</option>
              <option value="personal">👤 Achat Perso (Remboursé 100%)</option>
            </>
          )}
        </select>

        {/* Beneficiary if personal */}
        {quickScope === 'personal' && (
          <select
            value={quickBeneficiary}
            onChange={(e) => setQuickBeneficiary(e.target.value)}
            className="px-2.5 py-2 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-2xl text-xs font-bold outline-hidden cursor-pointer"
            title="Pour quel participant ?"
          >
            {(event.members || []).map(m => (
              <option key={m.id} value={m.id}>
                {m.display_title} {m.id === event.current_member_id ? '(Moi)' : ''}
              </option>
            ))}
          </select>
        )}

        <div className="flex-1 min-w-[140px]">
          <input
            type="text"
            required
            value={quickName}
            onChange={(e) => setQuickName(e.target.value)}
            placeholder={getQuickPlaceholder()}
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

          {quickType === 'grocery' && (
            <input
              type="number"
              step="0.01"
              value={quickPrice}
              onChange={(e) => setQuickPrice(e.target.value)}
              placeholder="Prix"
              className="w-20 px-2.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-center outline-hidden"
              title="Prix estimé (optionnel)"
            />
          )}

          <button
            type="submit"
            disabled={adding || !quickName.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold shadow-xs transition-colors cursor-pointer flex-shrink-0 disabled:opacity-50"
          >
            Ajouter
          </button>
        </div>
      </form>

      {/* Category Filter Sub-Pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
            selectedCategory === 'all'
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Tous les rayons
        </button>
        {categories.map((cat) => {
          const count = viewFiltered.filter(g => g.category === cat).length;
          if (count === 0 && selectedCategory !== cat) return null;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Groceries & Materials List */}
      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <span className="material-symbols-outlined animate-spin text-2xl mb-1 text-blue-600">refresh</span>
          <p className="text-xs">Chargement de la liste...</p>
        </div>
      ) : finalFiltered.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700 p-6 shadow-xs">
          <EmptyState
            icon="checklist_rtl"
            title="Aucun article trouvé dans cette sélection."
            description="Ajoutez vos courses ou matériel, ou demandez à l'assistant IA de vous proposer une liste sur-mesure."
            actionText="Demander des suggestions à l'IA"
            onAction={onOpenAI}
          />
        </div>
      ) : (
        <div className="space-y-2">
          {finalFiltered.map((item) => {
            const isClaimedByMe = item.assigned_to_id === event.current_member_id;
            return (
              <div
                key={item.id}
                onClick={() => handleToggleBought(item)}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer select-none gap-3 ${
                  item.is_bought
                    ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 text-slate-400 dark:text-slate-500'
                    : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 hover:border-blue-300 text-slate-800 dark:text-slate-100 shadow-xs'
                }`}
              >
                {/* Left: Checkbox + Name + Badges */}
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div
                    title={item.is_bought ? "Payé / Dans le caddie (cliquer pour décocher)" : "Cocher comme payé / acheté"}
                    className={`w-6 h-6 mt-0.5 sm:mt-0 rounded-lg flex items-center justify-center border transition-colors flex-shrink-0 ${
                      item.is_bought
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {item.is_bought && (
                      <span className="material-symbols-outlined text-base">check</span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-xs sm:text-sm font-bold truncate ${
                        item.is_bought ? 'line-through text-slate-400 dark:text-slate-500' : ''
                      }`}>
                        {item.name}
                      </span>

                      {/* Distinction Matériel Groupe (BBQ) vs Matériel Perso (Tente) */}
                      {item.item_type === 'material' && item.scope === 'group' && (
                        <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 rounded-md text-[10px] font-extrabold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[11px]">outdoor_grill</span>
                          <span>Matériel Groupe (BBQ...)</span>
                        </span>
                      )}

                      {item.item_type === 'material' && item.scope === 'personal' && (
                        <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-300 rounded-md text-[10px] font-extrabold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[11px]">camping</span>
                          <span>Matériel Perso : {item.beneficiary_name || 'Moi'}</span>
                        </span>
                      )}

                      {/* Scope Badge (Personal purchase / courses) */}
                      {item.item_type !== 'material' && item.scope === 'personal' && (
                        <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 rounded-md text-[10px] font-extrabold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[11px]">person</span>
                          <span>Achat Perso : {item.beneficiary_name || 'Membre'}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 font-medium mt-0.5">
                      <span>{item.category}</span>
                      {item.notes && <span>• {item.notes}</span>}
                    </div>
                  </div>
                </div>

                {/* Right: Status (Je m'en charge vs Payé) + Qty + Price + Delete */}
                <div className="flex items-center justify-between sm:justify-end gap-2.5 flex-shrink-0">
                  {/*
                    User requirement: "sinon les course tu peut le mettre a 'je mencharge ' sauf si n'es pas encoré payé"
                    - If item is already paid/bought (item.is_bought): show green badge "Payé en magasin", cannot simply release.
                    - If item is NOT paid yet: show "Je m'en charge" / "Libérer" or "À pourvoir".
                  */}
                  {item.is_bought ? (
                    <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded-xl text-[11px] font-extrabold flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">verified</span>
                      <span>Payé {item.bought_by_name ? `par ${item.bought_by_name}` : ''}</span>
                    </span>
                  ) : isClaimedByMe ? (
                    <div className="flex items-center gap-1">
                      <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-xl text-[11px] font-extrabold flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">check_circle</span>
                        <span>Je m'en charge</span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleClaimToggle(item, e)}
                        className="px-2 py-1 text-[11px] text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Je me désiste / Libérer cet article (possible car non encore payé)"
                      >
                        Libérer
                      </button>
                    </div>
                  ) : item.assigned_to_name ? (
                    <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-[11px] font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">person</span>
                      <span>Pris par {item.assigned_to_name}</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => handleClaimToggle(item, e)}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-slate-600 hover:text-blue-600 dark:text-slate-300 rounded-xl text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                      title="Je prends en charge cet article"
                    >
                      <span className="material-symbols-outlined text-xs">add_task</span>
                      <span>Je m'en charge</span>
                    </button>
                  )}

                  {/* Quantity */}
                  <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold">
                    {item.quantity} {item.unit}
                  </span>

                  {/* Price: Actual vs Estimated */}
                  {item.actual_price !== undefined && item.actual_price !== null ? (
                    <div className="text-right">
                      <span className="text-xs font-mono font-extrabold text-emerald-600 dark:text-emerald-400 block">
                        {item.actual_price.toFixed(2)} {event.currency}
                      </span>
                      <span className="text-[9px] uppercase tracking-wider text-emerald-500/80 font-bold">
                        Payé
                      </span>
                    </div>
                  ) : item.estimated_price !== undefined && item.estimated_price !== null ? (
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 block">
                        {item.estimated_price.toFixed(2)} {event.currency}
                      </span>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                        Est.
                      </span>
                    </div>
                  ) : null}

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={(e) => handleDeleteItem(item.id, e)}
                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                    title="Supprimer"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Detailed Add Item */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Ajouter un article ou matériel"
        subtitle="Précisez la nature, le partage et les détails de l'article"
      >
        <form onSubmit={handleDetailedAdd} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
                Catégorie d'élément
              </label>
              <select
                value={modalType}
                onChange={(e) => setModalType(e.target.value as any)}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold outline-hidden cursor-pointer"
              >
                <option value="grocery">🛒 Course (Consommable / Nourriture)</option>
                <option value="material">🍳 Matériel / Équipement</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
                Portée (Groupe vs Perso)
              </label>
              <select
                value={modalScope}
                onChange={(e) => setModalScope(e.target.value as any)}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold outline-hidden cursor-pointer"
              >
                {modalType === 'material' ? (
                  <>
                    <option value="group">🔥 Matériel Groupe (BBQ, table, réchaud...)</option>
                    <option value="personal">⛺ Matériel Perso (Tente, duvet, serviette...)</option>
                  </>
                ) : (
                  <>
                    <option value="group">👥 Course Groupe (Partagé équitablement)</option>
                    <option value="personal">👤 Achat Perso (100% remboursé)</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {modalScope === 'personal' && (
            <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-2xl border border-purple-200 dark:border-purple-800">
              <label className="text-[11px] font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider block mb-1">
                {modalType === 'material' ? 'Pour quel participant est ce matériel perso ?' : "Bénéficiaire de l'achat personnel"}
              </label>
              <select
                value={modalBeneficiary}
                onChange={(e) => setModalBeneficiary(e.target.value)}
                className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-hidden"
              >
                {(event.members || []).map(m => (
                  <option key={m.id} value={m.id}>
                    {m.display_title} {m.id === event.current_member_id ? '(Moi)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-purple-700 dark:text-purple-400 mt-1">
                {modalType === 'material'
                  ? 'Ce matériel est sous la responsabilité individuelle de ce participant.'
                  : 'Ce montant sera 100% à la charge de ce participant lors du décompte des dépenses.'}
              </p>
            </div>
          )}

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Nom de l'article / équipement
            </label>
            <input
              type="text"
              required
              value={modalName}
              onChange={(e) => setModalName(e.target.value)}
              placeholder={modalType === 'material' ? (modalScope === 'group' ? 'Ex: Barbecue, Pinces, Glacière...' : 'Ex: Tente 2 places, Sac de couchage...') : 'Ex: Steaks hachés, Baguettes, Eau...'}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-100 outline-hidden"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
                Quantité
              </label>
              <input
                type="number"
                step="any"
                value={modalQty}
                onChange={(e) => setModalQty(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold outline-hidden"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
                Unité
              </label>
              <select
                value={modalUnit}
                onChange={(e) => setModalUnit(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs outline-hidden"
              >
                <option value="pièce">pièce</option>
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="L">L</option>
                <option value="pack">pack</option>
                <option value="bouteille">bouteille</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
                Prix estimé ({event.currency})
              </label>
              <input
                type="number"
                step="0.01"
                value={modalPrice}
                onChange={(e) => setModalPrice(e.target.value)}
                placeholder="0.00"
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-mono outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
                Rayon / Catégorie
              </label>
              <select
                value={modalCat}
                onChange={(e) => setModalCat(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs outline-hidden"
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
                Responsable initial
              </label>
              <select
                value={modalAssigned}
                onChange={(e) => setModalAssigned(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs outline-hidden cursor-pointer"
              >
                <option value="">À pourvoir (chacun peut s'en charger)</option>
                {(event.members || []).map(m => (
                  <option key={m.id} value={m.id}>
                    {m.display_title} {m.id === event.current_member_id ? '(Moi)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-1">
              Remarques
            </label>
            <input
              type="text"
              value={modalNotes}
              onChange={(e) => setModalNotes(e.target.value)}
              placeholder="Ex: Penser au charbon de bois pour le barbecue..."
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs outline-hidden"
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
              disabled={adding || !modalName.trim()}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              {adding ? 'Ajout...' : 'Ajouter'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Receipt Scanner & OCR Import */}
      <Modal
        isOpen={isScanModalOpen}
        onClose={() => {
          setIsScanModalOpen(false);
          setScanResult(null);
        }}
        title="Scanner et Importer un Ticket de Caisse"
        subtitle="Lecture optique IA des prix réels de vos courses via LiteLLM"
      >
        <div className="space-y-4">
          {!scanResult && (
            <div className="text-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">
              <span className="material-symbols-outlined text-4xl text-blue-600 mb-2">photo_camera</span>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Prenez en photo ou importez le ticket de caisse
              </p>
              <p className="text-[11px] text-slate-400 mb-4">
                L'IA analyse le ticket, fait la correspondance avec vos courses et extrait les prix réels.
              </p>

              <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-all shadow-xs cursor-pointer">
                <span className="material-symbols-outlined text-base">upload_file</span>
                <span>Sélectionner une photo</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleReceiptFileChange}
                  className="hidden"
                />
              </label>

              {scanning && (
                <div className="mt-5 flex items-center justify-center gap-2 text-blue-600 text-xs font-bold animate-pulse">
                  <span className="material-symbols-outlined animate-spin text-lg">refresh</span>
                  <span>Analyse IA en cours via LiteLLM (ai.oussamma.tn)...</span>
                </div>
              )}
            </div>
          )}

          {scanResult && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              <div className="p-3.5 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-extrabold text-blue-900 dark:text-blue-200">
                    {scanResult.store_name}
                  </h4>
                  <p className="text-[10px] text-blue-700 dark:text-blue-300">
                    {scanResult.receipt_date ? `Date : ${scanResult.receipt_date} • ` : ''}
                    {scanResult.extracted_items.length} lignes extraites
                  </p>
                </div>
                {scanResult.receipt_total && (
                  <div className="text-right">
                    <span className="text-xs font-mono font-extrabold text-blue-900 dark:text-blue-100">
                      Total ticket : {scanResult.receipt_total.toFixed(2)} {event.currency}
                    </span>
                  </div>
                )}
              </div>

              {/* Matched Items */}
              <div>
                <h5 className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Articles correspondants trouvés ({scanResult.matches.length})
                </h5>
                <div className="space-y-2">
                  {scanResult.matches.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Aucune correspondance automatique détectée.</p>
                  ) : (
                    scanResult.matches.map((m) => {
                      const matchState = selectedMatches[m.item_id] || { price: m.matched_price, included: true };
                      return (
                        <div
                          key={m.item_id}
                          className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs gap-2"
                        >
                          <label className="flex items-center gap-2.5 min-w-0 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={matchState.included}
                              onChange={(e) => {
                                setSelectedMatches(prev => ({
                                  ...prev,
                                  [m.item_id]: { ...matchState, included: e.target.checked }
                                }));
                              }}
                              className="w-4 h-4 rounded text-blue-600"
                            />
                            <div className="min-w-0">
                              <span className="font-bold text-slate-800 dark:text-slate-100 block truncate">
                                {m.item_name}
                              </span>
                              <span className="text-[10px] text-slate-400 block truncate">
                                Ticket : « {m.matched_receipt_name} » ({Math.round(m.confidence * 100)}% match)
                              </span>
                            </div>
                          </label>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <input
                              type="number"
                              step="0.01"
                              value={matchState.price}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setSelectedMatches(prev => ({
                                  ...prev,
                                  [m.item_id]: { ...matchState, price: val }
                                }));
                              }}
                              className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-center"
                            />
                            <span className="text-[11px] font-bold text-slate-500">{event.currency}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Unmatched Extra Items */}
              {scanResult.unmatched_receipt_items.length > 0 && (
                <div>
                  <h5 className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Autres articles sur le ticket ({scanResult.unmatched_receipt_items.length})
                  </h5>
                  <div className="space-y-1.5">
                    {scanResult.unmatched_receipt_items.map((un, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 text-xs"
                      >
                        <label className="flex items-center gap-2 cursor-pointer min-w-0">
                          <input
                            type="checkbox"
                            checked={!!selectedUnmatched[idx]}
                            onChange={(e) => {
                              setSelectedUnmatched(prev => ({ ...prev, [idx]: e.target.checked }));
                            }}
                            className="w-4 h-4 rounded text-blue-600"
                          />
                          <span className="text-slate-700 dark:text-slate-300 font-medium truncate">
                            {un.name}
                          </span>
                        </label>
                        <span className="font-mono font-bold text-slate-600 dark:text-slate-300 flex-shrink-0">
                          {un.price.toFixed(2)} {event.currency}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expense creation options */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createExpenseOnApply}
                    onChange={(e) => setCreateExpenseOnApply(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    Créer automatiquement la dépense correspondante
                  </span>
                </label>

                {createExpenseOnApply && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        Qui a payé en caisse ?
                      </label>
                      <select
                        value={receiptPayerId}
                        onChange={(e) => setReceiptPayerId(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                      >
                        {(event.members || []).map(m => (
                          <option key={m.id} value={m.id}>{m.display_title}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        Libellé dépense
                      </label>
                      <input
                        type="text"
                        value={expenseTitle}
                        onChange={(e) => setExpenseTitle(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setScanResult(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Scanner un autre ticket
                </button>
                <button
                  type="button"
                  disabled={applyingReceipt}
                  onClick={handleApplyReceipt}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {applyingReceipt ? 'Application...' : 'Appliquer les prix et valider'}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal: Convert Bought Groceries to Expense */}
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
              Les achats de groupe seront partagés équitablement entre tous les participants. Tout achat personnel sera imputé à 100% à son bénéficiaire.
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
