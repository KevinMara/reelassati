'use client';

import nextDynamic from 'next/dynamic';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const dynamic = 'force-dynamic';

const Settings = nextDynamic(() => import('@/views/dashboard/Settings'), { ssr: false });



export default function AdminSettingsPage() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Settings />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

