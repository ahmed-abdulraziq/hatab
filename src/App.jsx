import { useEffect } from 'react';
import ConfirmProvider from './components/ConfirmProvider.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import ToastProvider from './components/ToastProvider.jsx';
import { TabBar } from './components/ui.jsx';
import { useRoute } from './router.js';
import ClientScreen from './screens/ClientScreen.jsx';
import ClientsScreen from './screens/ClientsScreen.jsx';
import SettingsScreen from './screens/SettingsScreen.jsx';
import TransactionsScreen from './screens/TransactionsScreen.jsx';
import { useLedger } from './state/LedgerContext.js';
import LedgerProvider from './state/LedgerProvider.jsx';

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <LedgerProvider>
            <Shell />
          </LedgerProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

function Shell() {
  const route = useRoute();
  const { ready } = useLedger();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.name, route.id]);

  if (!ready) {
    return (
      <div className="splash" role="status">
        HATAB
      </div>
    );
  }

  const onClientPage = route.name === 'client';
  let screen = <ClientsScreen />;
  if (onClientPage) screen = <ClientScreen key={route.id} id={route.id} />;
  else if (route.name === 'transactions') screen = <TransactionsScreen />;
  else if (route.name === 'settings') screen = <SettingsScreen />;

  return (
    <div className={`app${onClientPage ? ' app--detail' : ''}`}>
      {screen}
      {!onClientPage && <TabBar current={route.name} />}
    </div>
  );
}
