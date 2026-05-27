'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/brand/Logo';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
          <div className="mb-8">
            <Logo size="lg" />
          </div>
          <h1 className="text-2xl font-semibold mb-4">Something went wrong.</h1>
          <p className="text-foreground/60 mb-8 max-w-md">
            We've encountered an unexpected error. Please try reloading the page or return home.
          </p>
          
          <div className="flex flex-wrap gap-4 justify-center">
            <Button onClick={() => window.location.reload()} variant="primary">
              Reload page
            </Button>
            <Button onClick={() => window.location.href = '/'} variant="outline">
              Go to home
            </Button>
            <Button onClick={() => window.location.href = '/auth/login'} variant="ghost">
              Go to login
            </Button>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <div className="mt-12 p-4 bg-surface border border-border rounded text-left overflow-auto max-w-full text-xs font-mono">
              <p className="font-bold text-destructive mb-2">{this.state.error?.toString()}</p>
              <pre className="opacity-70 whitespace-pre-wrap">{this.state.error?.stack}</pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
