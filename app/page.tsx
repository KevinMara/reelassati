'use client';

import dynamic from 'next/dynamic';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { BrowserRouter } from 'react-router-dom';

export const dynamic = 'force-dynamic';

const Home = dynamic(() => import('@/views/Home'), { ssr: false });


export default function RootPage() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

