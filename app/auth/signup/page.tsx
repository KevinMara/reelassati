'use client';

import Signup from '@/views/auth/Signup';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function SignupPage() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Signup />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
