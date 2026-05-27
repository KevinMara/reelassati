'use client';

import dynamic from 'next/dynamic';
import { NextRouteAdapter } from '@/components/routing/NextRouteAdapter';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const Home = dynamic(() => import('@/views/Home'), { ssr: false });

export default function RootPage() {
  return (
    <ErrorBoundary>
      <NextRouteAdapter>
        <Home />
      </NextRouteAdapter>
    </ErrorBoundary>
  );
}
