'use client';

import React from 'react';
import { NextRouteAdapter } from '@/components/routing/NextRouteAdapter';
import { ErrorBoundary } from '@/components/ErrorBoundary';

/**
 * A standard wrapper for migrating RRD components to Next.js pages.
 */
export function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <NextRouteAdapter>
        {children}
      </NextRouteAdapter>
    </ErrorBoundary>
  );
}
