'use client';

import DashboardHome from '@/views/dashboard/DashboardHome';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function DashboardPage() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <DashboardHome />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
