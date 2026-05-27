'use client';

import dynamic from 'next/dynamic';
import { NextRouteAdapter } from '@/components/routing/NextRouteAdapter';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const SettingsPage = dynamic(() => import('@/views/dashboard/Settings'), { ssr: false });

export default function AdminSettingsPage() {
  return (
    <ErrorBoundary>
      <NextRouteAdapter>
        <SettingsPage />
      </NextRouteAdapter>
    </ErrorBoundary>
  );
}
