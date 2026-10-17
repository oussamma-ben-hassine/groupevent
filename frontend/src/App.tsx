import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { AIAssistantModal } from './components/AIAssistantModal';
import { Dashboard } from './pages/Dashboard';
import { EventDetail } from './pages/EventDetail';
import { InvitePage } from './pages/InvitePage';
import { EventItem } from './types';
import { api } from './api/client';

// Inner app component with auth context access
const AppContent: React.FC = () => {
  const { actor, loading: authLoading, checkAuth } = useAuth();

  // Navigation state
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [currentSearch, setCurrentSearch] = useState(window.location.search);
  const [activeSubTab, setActiveSubTab] = useState<'groceries' | 'expenses' | 'balances'>('groceries');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Events list state
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  // Modals state
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Callback processing state
  const [callbackProcessing, setCallbackProcessing] = useState(false);
  const [callbackError, setCallbackError] = useState<string | null>(null);

  // Listen to popstate for browser navigation
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
      setCurrentSearch(window.location.search);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Parse path and query parameters
  useEffect(() => {
    const searchParams = new URLSearchParams(currentSearch);
    const eventParam = searchParams.get('event');
    const tabParam = searchParams.get('tab') as 'groceries' | 'expenses' | 'balances' | null;

    if (eventParam) {
      setSelectedEventId(eventParam);
    } else if (currentPath === '/' || currentPath === '') {
      // If we are on root without event query, clear selected event
      setSelectedEventId(null);
    }

    if (tabParam && ['groceries', 'expenses', 'balances'].includes(tabParam)) {
      setActiveSubTab(tabParam);
    }
  }, [currentPath, currentSearch]);

  // Load events when actor is loaded
  const refreshEvents = async () => {
    setEventsLoading(true);
    try {
      const data = await api.listEvents();
      setEvents(data);
    } catch (err) {
      console.error('Failed to load events', err);
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      refreshEvents();
    }
  }, [authLoading, actor]);

  // Handle SSO Callback (/auth/callback)
  useEffect(() => {
    if (currentPath === '/auth/callback') {
      const params = new URLSearchParams(currentSearch);
      const code = params.get('code');
      const state = params.get('state');

      if (!code) {
        setCallbackError('Paramètre code manquant dans la réponse SSO.');
        return;
      }

      setCallbackProcessing(true);
      api.exchangeAuthCode(code, state || undefined)
        .then(async () => {
          await checkAuth();
          const target = sessionStorage.getItem('groupevent_auth_redirect') || '/';
          sessionStorage.removeItem('groupevent_auth_redirect');
          window.history.replaceState({}, '', target);
          setCurrentPath(window.location.pathname);
          setCurrentSearch(window.location.search);
        })
        .catch((err: any) => {
          console.error('OAuth callback failed', err);
          setCallbackError(err.message || 'Échec de l’authentification SSO.');
        })
        .finally(() => {
          setCallbackProcessing(false);
        });
    }
  }, [currentPath, currentSearch, checkAuth]);

  // Handle invite links (/invite/:token)
  const inviteMatch = currentPath.match(/^\/invite\/([a-zA-Z0-9_-]+)/);
  if (inviteMatch) {
    const inviteToken = inviteMatch[1];
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans transition-colors">
        <InvitePage
          token={inviteToken}
          onJoined={(eventId) => {
            window.history.pushState({}, '', `/?event=${eventId}`);
            setCurrentPath('/');
            setCurrentSearch(`?event=${eventId}`);
            setSelectedEventId(eventId);
            refreshEvents();
          }}
        />
      </div>
    );
  }

  // If on callback route, display spinner or error
  if (currentPath === '/auth/callback') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 max-w-md w-full text-center shadow-lg">
          {callbackError ? (
            <div>
              <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl">error</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Erreur d'authentification
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                {callbackError}
              </p>
              <a
                href="/"
                className="inline-flex items-center justify-center w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors"
              >
                Retour à l'accueil
              </a>
            </div>
          ) : (
            <div>
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                Connexion en cours...
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Finalisation de votre session SSO oussamma.tn
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const navigateToEvent = (ev: EventItem) => {
    setSelectedEventId(ev.id);
    setActiveSubTab('groceries');
    window.history.pushState({}, '', `/?event=${ev.id}&tab=groceries`);
    setCurrentSearch(`?event=${ev.id}&tab=groceries`);
  };

  const handleBackToDashboard = () => {
    setSelectedEventId(null);
    window.history.pushState({}, '', '/');
    setCurrentSearch('');
    refreshEvents();
  };

  const handleSubTabChange = (tab: 'groceries' | 'expenses' | 'balances') => {
    setActiveSubTab(tab);
    if (selectedEventId) {
      window.history.pushState({}, '', `/?event=${selectedEventId}&tab=${tab}`);
      setCurrentSearch(`?event=${selectedEventId}&tab=${tab}`);
    }
  };

  // Find active event title if selected
  const activeEvent = events.find((e) => e.id === selectedEventId);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* Desktop Sidebar */}
      <Sidebar
        currentTab={selectedEventId ? activeSubTab : 'dashboard'}
        onSelectTab={(tab) => {
          if (tab === 'dashboard') {
            handleBackToDashboard();
          } else if (selectedEventId && ['groceries', 'expenses', 'balances'].includes(tab)) {
            handleSubTabChange(tab as any);
          }
        }}
        onOpenAI={() => setIsAIModalOpen(true)}
        onCreateEvent={() => setIsCreateModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="lg:pl-60 flex-1 flex flex-col min-w-0 pb-20 lg:pb-8">
        <Header
          onOpenAI={() => setIsAIModalOpen(true)}
          title={activeEvent ? activeEvent.title : undefined}
        />

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          {selectedEventId ? (
            <EventDetail
              eventId={selectedEventId}
              onBack={handleBackToDashboard}
              activeSubTab={activeSubTab}
              onChangeSubTab={handleSubTabChange}
            />
          ) : (
            <Dashboard
              events={events}
              loading={eventsLoading}
              onSelectEvent={navigateToEvent}
              onRefreshEvents={refreshEvents}
              isCreateModalOpen={isCreateModalOpen}
              onCloseCreateModal={() => setIsCreateModalOpen(false)}
              onOpenCreateModal={() => setIsCreateModalOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav
        currentTab={selectedEventId ? activeSubTab : 'dashboard'}
        onSelectTab={(tab) => {
          if (tab === 'dashboard') {
            handleBackToDashboard();
          } else if (['groceries', 'expenses', 'balances'].includes(tab)) {
            handleSubTabChange(tab as any);
          }
        }}
        onOpenAI={() => setIsAIModalOpen(true)}
        hasActiveEvent={!!selectedEventId}
      />

      {/* AI Assistant Modal (can be opened anywhere) */}
      <AIAssistantModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        eventId={selectedEventId || undefined}
        onIngredientsSuggested={() => {
          // If in groceries tab, will reload naturally on next visit
        }}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
};
export default App;
