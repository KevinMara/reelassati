'use client';

import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import DashboardHome from '@/views/dashboard/DashboardHome';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    console.log("[DASHBOARD-PAGE] Rendering main dashboard view");
  }, []);

  if (!mounted) return null;

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <DashboardHome />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
