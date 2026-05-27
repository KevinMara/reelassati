'use client';

import dynamic from 'next/dynamic';
import { NextRouteAdapter } from '@/components/routing/NextRouteAdapter';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const Signup = dynamic(() => import('@/views/auth/Signup'), { ssr: false });

export default function SignupPage() {
  return (
    <ErrorBoundary>
      <NextRouteAdapter>
        <Signup />
      </NextRouteAdapter>
    </ErrorBoundary>
  );
}
