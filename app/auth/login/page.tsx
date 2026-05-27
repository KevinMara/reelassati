'use client';

import dynamic from 'next/dynamic';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const App = dynamic(() => import('@/App'), { ssr: false });

export default function LoginPage() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
