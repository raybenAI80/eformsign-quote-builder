
// Buffer polyfill for @react-pdf/renderer
import { Buffer } from 'buffer';
(window as any).Buffer = Buffer;

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("루트 요소를 찾을 수 없습니다.");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
