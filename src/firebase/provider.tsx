"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Auth } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';

interface FirebaseContextValue {
    app: FirebaseApp | null;
    db: Firestore | null;
    auth: Auth | null;
}

const FirebaseContext = createContext<FirebaseContextValue>({ app: null, db: null, auth: null });

export const FirebaseProvider = ({ children, value }: { children: ReactNode, value: FirebaseContextValue }) => {
    return (
        <FirebaseContext.Provider value={value}>
            {children}
        </FirebaseContext.Provider>
    );
};

export const useFirebase = () => {
    const context = useContext(FirebaseContext);
    if (context === undefined) {
        throw new Error('useFirebase must be used within a FirebaseProvider');
    }
    return context;
};

export const useFirestore = () => {
    const { db } = useFirebase();
    if (!db) {
        throw new Error('Firestore has not been initialized');
    }
    return db;
}

export const useAuth = () => {
    const { auth } = useFirebase();
    if (!auth) {
        throw new Error('Auth has not been initialized');
    }
    return auth;
}
