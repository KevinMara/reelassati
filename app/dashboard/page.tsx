'use client';

import React, { useEffect, useState } from 'react';
import nextDynamic from 'next/dynamic';
import { ErrorBoundary } from "@/components/ErrorBoundary";

const App = nextDynamic(() => import('@/App'), { 
  ssr: false,
  loading: () => <div className="min-h-screen flex items-center justify-center">Loading Reelassati...</div>
});


export default function DashboardPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
