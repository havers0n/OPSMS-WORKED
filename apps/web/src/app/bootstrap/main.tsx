import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppProvider } from '@/app/providers/app-provider';
import { AppRouter } from '@/app/router';
import { ensureWarehouseEditorSessionCleanupRegistered } from '@/widgets/warehouse-editor/model/session-cleanup';
import '@/app/styles/global.css';

ensureWarehouseEditorSessionCleanupRegistered();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <AppRouter />
    </AppProvider>
  </React.StrictMode>
);
