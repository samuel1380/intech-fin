import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Feedback } from './components/Feedback';
import { registerServiceWorker } from './services/notificationService';
import './styles.css';
// Remove legacy client-side provider secrets and unscoped profile data.
try {
  for (const key of [
    'finnexus_groq_key',
    'finnexus_openai_key',
    'finnexus_mistral_key',
    'finnexus_user_profile',
    'finnexus_push_subscription',
    'finnexus_notif_prefs',
  ])
    localStorage.removeItem(key);
} catch {
  console.warn('Armazenamento local indisponível.');
}
void registerServiceWorker();
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <Feedback />
    </ErrorBoundary>
  </React.StrictMode>,
);
