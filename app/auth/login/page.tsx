'use client';

import { useEffect, useState } from 'react';
import nextDynamic from 'next/dynamic';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const dynamic = 'force-dynamic';

const Login = nextDynamic(() => import('@/views/auth/Login'), { ssr: false });

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
