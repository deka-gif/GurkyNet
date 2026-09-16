import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {
  isChunkLoadError,
  reloadOnceForStaleChunk,
  scheduleClearChunkReloadFlag,
} from './utils/spaChunkRecovery';

// After a healthy boot window, allow one auto-reload again on the next deploy.
scheduleClearChunkReloadFlag();

function onStaleChunkEvent(event: Event) {
  const detail =
    event instanceof ErrorEvent
      ? event.error || event.message
      : event instanceof PromiseRejectionEvent
        ? event.reason
        : null;
  if (!isChunkLoadError(detail) && !isChunkLoadError((event as ErrorEvent).message)) {
    return;
  }
  if (reloadOnceForStaleChunk()) {
    event.preventDefault?.();
  }
}

window.addEventListener('error', onStaleChunkEvent);
window.addEventListener('unhandledrejection', onStaleChunkEvent);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
