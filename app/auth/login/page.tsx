'use client';

import Login from '@/views/auth/Login';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function LoginPage() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
