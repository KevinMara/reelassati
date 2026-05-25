'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import "@/lib/i18n";

const App = dynamic(() => import('@/App'), { ssr: false });

export default function Page() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  return <App />;
}
