import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ContestantDisplay } from './game/ContestantDisplay';
import './styles/tokens.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {window.location.pathname.startsWith('/display/') ? <ContestantDisplay sessionId={window.location.pathname.slice('/display/'.length)} /> : <App />}
  </React.StrictMode>,
);
