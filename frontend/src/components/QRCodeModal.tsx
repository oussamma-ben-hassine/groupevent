import React, { useState } from 'react';
import { Modal } from './Modal';
import { EventItem } from '../types';
import { api } from '../api/client';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventItem;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  event
}) => {
  const [inviteUrl, setInviteUrl] = useState<string>('');
  const [qrSvg, setQrSvg] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<'link_sso' | 'guest'>('guest');
  const [error, setError] = useState('');

  const generateInvite = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.createInvite(event.id, { mode });
      setInviteUrl(data.invite_url);
      setQrSvg(data.qr_svg);
    } catch (err: any) {
      setError(err.message || 'Impossible de créer le lien.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      generateInvite();
    }
  }, [isOpen, mode]);

  const handleCopy = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWebShare = async () => {
    if (navigator.share && inviteUrl) {
      try {
        await navigator.share({
          title: `Rejoins l'événement : ${event.title}`,
          text: `Je t'invite à participer à "${event.title}" sur GroupEvent !`,
          url: inviteUrl,
        });
      } catch (e) {}
    }
  };

  const shareText = encodeURIComponent(`Rejoins l'événement "${event.title}" sur GroupEvent : ${inviteUrl}`);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Partager l'événement"
      subtitle={`Invitez vos proches à rejoindre « ${event.title} »`}
    >
      <div className="space-y-5">
        {/* Mode Selector */}
        <div className="bg-slate-50 dark:bg-slate-700/50 p-1.5 rounded-2xl flex gap-1 border border-slate-100 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setMode('guest')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              mode === 'guest'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Mode Invité (Sans compte)
          </button>
          <button
            type="button"
            onClick={() => setMode('link_sso')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              mode === 'link_sso'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Mode Connexion SSO
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-2xl text-xs font-medium border border-red-100">
            {error}
          </div>
        )}

        {/* QR Code Preview */}
        <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-700/30 rounded-3xl border border-slate-100 dark:border-slate-700">
          {loading ? (
            <div className="w-44 h-44 flex items-center justify-center">
              <span className="material-symbols-outlined animate-spin text-3xl text-blue-600">refresh</span>
            </div>
          ) : qrSvg ? (
            <div
              className="w-44 h-44 bg-white p-2.5 rounded-2xl shadow-xs [&_svg]:w-full [&_svg]:h-full"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          ) : null}
          <span className="text-[11px] text-slate-400 font-medium mt-2">
            Scannez le QR code avec l'appareil photo d'un smartphone
          </span>
        </div>

        {/* Invite Link input & copy */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
            Lien d'invitation direct
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={inviteUrl || 'Génération du lien...'}
              className="flex-1 px-3.5 py-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-700 dark:text-slate-300 font-mono select-all outline-hidden"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer flex-shrink-0"
            >
              <span className="material-symbols-outlined text-base">
                {copied ? 'check' : 'content_copy'}
              </span>
              <span>{copied ? 'Copié !' : 'Copier'}</span>
            </button>
          </div>
        </div>

        {/* Share buttons (Web Share, WhatsApp, Telegram, Email) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              type="button"
              onClick={handleWebShare}
              className="flex items-center justify-center gap-1.5 p-2.5 bg-blue-50 dark:bg-slate-700 hover:bg-blue-100 text-blue-700 dark:text-blue-300 rounded-2xl text-xs font-bold transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">share</span>
              <span>Partager</span>
            </button>
          )}

          <a
            href={`https://wa.me/?text=${shareText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 p-2.5 bg-emerald-50 dark:bg-slate-700 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 rounded-2xl text-xs font-bold transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">chat</span>
            <span>WhatsApp</span>
          </a>

          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(`Rejoins l'événement "${event.title}"`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 p-2.5 bg-sky-50 dark:bg-slate-700 hover:bg-sky-100 text-sky-700 dark:text-sky-300 rounded-2xl text-xs font-bold transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">send</span>
            <span>Telegram</span>
          </a>

          <a
            href={`mailto:?subject=${encodeURIComponent(`Invitation à ${event.title}`)}&body=${shareText}`}
            className="flex items-center justify-center gap-1.5 p-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">mail</span>
            <span>Email</span>
          </a>
        </div>
      </div>
    </Modal>
  );
};
