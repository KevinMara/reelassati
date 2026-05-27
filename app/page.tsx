'use client';

import { useEffect, useState } from 'react';
import nextDynamic from 'next/dynamic';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { BrowserRouter } from 'react-router-dom';

export const dynamic = 'force-dynamic';

const Home = nextDynamic(() => import('@/views/Home'), { ssr: false });

export default function RootPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
