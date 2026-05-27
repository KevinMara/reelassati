'use client';

import React, { useEffect, useState } from 'react';
import nextDynamic from 'next/dynamic';
import "@/lib/i18n";

const App = nextDynamic(() => import('@/App'), { 
  ssr: false,
  loading: () => <div className="min-h-screen flex items-center justify-center">Loading Reelassati...</div>
});

export default function RootPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  return <App />;
}
