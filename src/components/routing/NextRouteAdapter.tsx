'use client';

import React, { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';

/**
 * Provides a BrowserRouter environment for components that still rely on react-router-dom.
 * This helps bridge the gap between Next.js App Router and the existing SPA components.
 */
export function NextRouteAdapter({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null;
  }

  return (
    <BrowserRouter>
      {children}
    </BrowserRouter>
  );
}
