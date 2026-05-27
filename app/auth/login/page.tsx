'use client';

import nextDynamic from 'next/dynamic';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const dynamic = 'force-dynamic';

const Login = nextDynamic(() => import('@/views/auth/Login'), { ssr: false });



export default function LoginPage() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

