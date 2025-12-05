"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useUser } from './use-user';
import { useFirestore } from '../provider';
import type { UserProfile } from '@/types/activity';

interface ClientContextValue {
    clientId: string | null;
    isClientLoading: boolean;
    userProfile: UserProfile | null;
    isConsultant: boolean;
}

const ClientContext = createContext<ClientContextValue>({
    clientId: null,
    isClientLoading: true,
    userProfile: null,
    isConsultant: false,
});

export const ClientProvider = ({ children }: { children: ReactNode }) => {
    const { user, loading: userLoading } = useUser();
    const db = useFirestore();
    const [clientId, setClientId] = useState<string | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [isClientLoading, setClientLoading] = useState(true);

    const isConsultant = userProfile?.role === 'consultant';

    useEffect(() => {
        if (userLoading) {
            setClientLoading(true);
            return;
        }
        if (!user || !db) {
            setClientLoading(false);
            setClientId(null);
            setUserProfile(null);
            return;
        }

        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribe = onSnapshot(userDocRef, (doc) => {
            if (doc.exists()) {
                const profile = doc.data() as UserProfile;
                setUserProfile(profile);
                setClientId(profile.clientId);
            } else {
                // This might happen for a newly created user before their profile is created.
                console.warn(`User profile not found for uid: ${user.uid}`);
                setUserProfile(null);
                setClientId(null);
            }
            setClientLoading(false);
        }, (error) => {
            console.error("Error fetching user profile:", error);
            setClientLoading(false);
        });

        return () => unsubscribe();
    }, [user, userLoading, db]);

    return (
        <ClientContext.Provider value={{ clientId, isClientLoading, userProfile, isConsultant }}>
            {children}
        </ClientContext.Provider>
    );
};

export const useClient = () => {
    const context = useContext(ClientContext);
    if (context === undefined) {
        throw new Error('useClient must be used within a ClientProvider');
    }
    return context;
};
