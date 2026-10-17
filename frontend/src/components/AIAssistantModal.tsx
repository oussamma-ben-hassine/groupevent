import React, { useState } from 'react';
import { Modal } from './Modal';
import { EventItem } from '../types';
import { api } from '../api/client';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  event?: EventItem;
  onGroceriesAdded?: () => void;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  event,
  onGroceriesAdded
}) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; groceries?: any[] }>>([
    {
      role: 'assistant',
      content: `Bonjour ! Je suis votre assistant IA LiteLLM pour GroupEvent. Je peux vous proposer des listes de courses adaptées au nombre de convives, estimer votre budget ou suggérer des menus conviviaux pour votre événement.`
    }
  ]);
  const [addingGroceries, setAddingGroceries] = useState(false);
  const [groceriesAddedMsg, setGroceriesAddedMsg] = useState(false);

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || prompt;
    if (!textToSend.trim() || loading) return;

    const userMsg = { role: 'user' as const, content: textToSend };
    setMessages(prev => [...prev, userMsg]);
    setPrompt('');
    setLoading(true);
    setGroceriesAddedMsg(false);

    try {
      const res = await api.askAI(textToSend, event?.id);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: res.content,
          groceries: res.suggested_groceries
        }
      ]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `Désolé, une erreur est survenue lors de la communication avec l'IA (${err.message}).`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddGroceriesToEvent = async (groceries: any[]) => {
    if (!event || !groceries || groceries.length === 0) return;
    setAddingGroceries(true);
    try {
      for (const item of groceries) {
        await api.addGrocery(event.id, {
          name: item.name,
          quantity: item.quantity || 1,
          unit: item.unit || 'pièce',
          category: item.category || 'Autre',
          estimated_price: item.estimated_price
        });
      }
      setGroceriesAddedMsg(true);
      if (onGroceriesAdded) onGroceriesAdded();
    } catch (err) {
      console.error(err);
    } finally {
      setAddingGroceries(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assistant IA — LiteLLM"
      subtitle={event ? `Conseils intelligents pour « ${event.title} »` : "Planification d'événements & courses"}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Quick Suggestion Pills */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleSend("Propose une liste de courses pour un barbecue convivial de 8 personnes")}
            className="px-3 py-1.5 bg-blue-50 dark:bg-slate-700 hover:bg-blue-100 text-blue-700 dark:text-blue-300 rounded-full text-xs font-semibold transition-colors cursor-pointer"
          >
            🥩 Barbecue 8 personnes
          </button>
          <button
            type="button"
            onClick={() => handleSend("Idée d'apéro dînatoire simple et pas cher avec liste des courses")}
            className="px-3 py-1.5 bg-emerald-50 dark:bg-slate-700 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 rounded-full text-xs font-semibold transition-colors cursor-pointer"
          >
            🍹 Apéro dînatoire économique
          </button>
          <button
            type="button"
            onClick={() => handleSend("Conseils pour estimer et équilibrer le budget du week-end entre amis")}
            className="px-3 py-1.5 bg-purple-50 dark:bg-slate-700 hover:bg-purple-100 text-purple-700 dark:text-purple-300 rounded-full text-xs font-semibold transition-colors cursor-pointer"
          >
            💶 Gestion budget & équilibrage
          </button>
        </div>

        {/* Chat Thread */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-3xl border border-slate-100 dark:border-slate-700 max-h-80 overflow-y-auto space-y-3.5 text-xs leading-relaxed">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                  IA
                </div>
              )}
              <div
                className={`p-3.5 rounded-2xl max-w-lg ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 shadow-xs'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>

                {/* Groceries Action Box if AI suggested ingredients */}
                {m.groceries && m.groceries.length > 0 && event && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 space-y-2">
                    <div className="font-bold text-[11px] text-blue-600 dark:text-blue-400">
                      💡 {m.groceries.length} articles suggérés par l'IA :
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {m.groceries.map((it, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-medium"
                        >
                          {it.name} ({it.quantity} {it.unit})
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={addingGroceries || groceriesAddedMsg}
                      onClick={() => handleAddGroceriesToEvent(m.groceries!)}
                      className="mt-2 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {groceriesAddedMsg ? 'check' : 'add_shopping_cart'}
                      </span>
                      <span>
                        {groceriesAddedMsg
                          ? 'Articles ajoutés à vos courses !'
                          : addingGroceries
                          ? 'Ajout en cours...'
                          : 'Ajouter ces articles à la liste de courses'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-slate-400 text-xs italic">
              <span className="material-symbols-outlined animate-spin text-base text-blue-600">refresh</span>
              <span>L'assistant réfléchit...</span>
            </div>
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="relative"
        >
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Posez votre question ou demandez des idées..."
            className="w-full pl-4 pr-24 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-800 dark:text-slate-100 outline-hidden focus:border-blue-500 transition-all shadow-xs"
          />
          <button
            type="submit"
            disabled={!prompt.trim() || loading}
            className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-40"
          >
            <span>Envoyer</span>
            <span className="material-symbols-outlined text-sm">send</span>
          </button>
        </form>
      </div>
    </Modal>
  );
};
