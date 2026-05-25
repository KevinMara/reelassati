'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import "@/lib/i18n";

export const dynamic = 'force-dynamic';


// Use dynamic with ssr: false to prevent hydration mismatches during migration
const App = dynamic(() => import('@/App'), { 
  ssr: false,
  loading: () => <div className="min-h-screen flex items-center justify-center">Loading Reelassati Studio...</div>
});

export default function Page() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  return <App />;
}
