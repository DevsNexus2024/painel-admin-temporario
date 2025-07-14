import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import 'primereact/resources/themes/lara-dark-indigo/theme.css'; // usando tema escuro para o Skeleton
import 'primereact/resources/primereact.min.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
