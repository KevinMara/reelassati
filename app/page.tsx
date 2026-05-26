'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import "@/lib/i18n";

// Root page also uses the App component for consistency with the catch-all
const App = dynamic(() => import('@/App'), { 
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
