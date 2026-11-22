import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/dm-sans/wght.css';
import '@fontsource/instrument-serif/latin-400.css';
import './styles.css';
import { App } from './App';
import { UpdateScreen, updateQuery } from './ui/UpdateScreen';

const isUpdatePage = new URLSearchParams(window.location.search).get(updateQuery) === '1';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isUpdatePage ? <UpdateScreen /> : <App />}
  </StrictMode>,
);
