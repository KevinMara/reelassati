'use client';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import Home from '@/views/Home';
import { BrowserRouter } from 'react-router-dom';

export default function RootPage() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
