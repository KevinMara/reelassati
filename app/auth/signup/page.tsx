'use client';

import dynamic from 'next/dynamic';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const Signup = dynamic(() => import('@/views/auth/Signup'), { ssr: false });

export default function SignupPage() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Signup />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

