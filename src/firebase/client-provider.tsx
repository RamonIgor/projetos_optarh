"use client";

import React, { useState, useEffect, ReactNode } from 'react';
import { initializeFirebase } from './';
import { FirebaseProvider } from './provider';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

interface FirebaseInstances {
    app: FirebaseApp;
    db: Firestore;
    auth: Auth;
}

export const FirebaseClientProvider = ({ children }: { children: ReactNode }) => {
    const [instances, setInstances] = useState<FirebaseInstances | null>(null);

    useEffect(() => {
        const { app, db, auth } = initializeFirebase();
        setInstances({ app, db, auth });
    }, []);

    if (!instances) {
        // You can return a loading spinner or null here
        return null;
    }

    return (
        <FirebaseProvider value={instances}>
            {children}
        </FirebaseProvider>
    );
};
