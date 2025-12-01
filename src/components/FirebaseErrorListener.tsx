"use client";

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';

export function FirebaseErrorListener() {
  useEffect(() => {
    const handlePermissionError = (error: Error) => {
      // In a Next.js development environment, uncaught errors are displayed in an overlay.
      // We throw the error to trigger this overlay for better visibility.
      if (process.env.NODE_ENV === 'development') {
        setTimeout(() => {
          throw error;
        }, 0);
      } else {
        // In production, you might want to log this to a service like Sentry,
        // but for now, we'll just log it to the console.
        console.error(error);
      }
    };

    errorEmitter.on('permission-error', handlePermissionError);

    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, []);

  return null; // This component does not render anything.
}
