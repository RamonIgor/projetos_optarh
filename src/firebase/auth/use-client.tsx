
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { doc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';
import { useUser } from './use-user';
import { useFirestore } from '../provider';
import type { UserProfile } from '@/types/activity';
import { usePathname } from 'next/navigation';

interface ClientContextValue {
    clientId: string | null;
    isClientLoading: boolean;
    userProfile: UserProfile | null;
    isConsultant: boolean;
    selectedClientId: string | null; 
    setSelectedClientId: (id: string | null) => void;
}

const ClientContext = createContext<ClientContextValue>({
    clientId: null,
    isClientLoading: true,
    userProfile: null,
    isConsultant: false,
    selectedClientId: null,
    setSelectedClientId: () => {},
});

export const ClientProvider = ({ children }: { children: ReactNode }) => {
    const { user, loading: userLoading } = useUser();
    const db = useFirestore();

    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [isClientLoading, setClientLoading] = useState(true);
    
    const [userNativeClientId, setUserNativeClientId] = useState<string | null>(null);
    const [consultantSelectedClientId, setConsultantSelectedClientId] = useState<string | null>(null);

    const isConsultant = userProfile?.isConsultant || false;

    useEffect(() => {
        if (!user) {
            setConsultantSelectedClientId(null);
        }
    }, [user]);

    useEffect(() => {
        if (userLoading) {
            setClientLoading(true);
            return;
        }
        if (!user || !db) {
            setClientLoading(false);
            setUserProfile(null);
            setUserNativeClientId(null);
            return;
        }

        const userDocRef = doc(db, 'users', user.uid);

        const handleUserProfile = async (profileData: UserProfile | undefined) => {
            if (profileData) {
                // Check for legacy users who don't have the 'products' field.
                if (!profileData.hasOwnProperty('products')) {
                    const migratedProfile: UserProfile = { ...profileData, products: ['process_flow'] };
                    setUserProfile(migratedProfile);

                    // Update the document in the background to migrate the user.
                    try {
                        await updateDoc(userDocRef, { products: ['process_flow'] });
                    } catch (e) {
                        console.error("Failed to migrate user profile:", e);
                    }

                } else {
                    setUserProfile(profileData);
                }

                if (profileData.isConsultant) {
                    setUserNativeClientId(null);
                } else {
                    setUserNativeClientId(profileData.clientId);
                }

            } else {
                 const authorizedConsultants = ['igorhenriqueramon@gmail.com', 'optarh@gmail.com'];
                 if (user.email && authorizedConsultants.includes(user.email)) {
                    setUserProfile({ clientId: '', products: [], isConsultant: true });
                    setUserNativeClientId(null);
                } else {
                    console.warn(`User profile not found for uid: ${user.uid}`);
                    setUserProfile(null);
                    setUserNativeClientId(null);
                }
            }
            setClientLoading(false);
        }


        const unsubscribe = onSnapshot(userDocRef, async (docSnapshot) => {
            await handleUserProfile(docSnapshot.data() as UserProfile | undefined);
        }, async (error) => {
            console.error("Error with onSnapshot, trying getDoc as fallback:", error);
            try {
                const docSnapshot = await getDoc(userDocRef);
                await handleUserProfile(docSnapshot.data() as UserProfile | undefined);
            } catch (getDocError) {
                 console.error("Error fetching user profile with getDoc:", getDocError);
                 setClientLoading(false);
            }
        });

        return () => unsubscribe();
    }, [user, userLoading, db]);

    const handleSetSelectedClientId = useCallback((id: string | null) => {
        if (isConsultant) {
            setConsultantSelectedClientId(id);
        }
    }, [isConsultant]);

    // This is the active client ID for the entire app.
    // If the user is a consultant, it's the client they have selected in the UI.
    // If they are a client_user, it's always their own company's client ID.
    const activeClientId = isConsultant ? consultantSelectedClientId : userNativeClientId;

    return (
        <ClientContext.Provider value={{ 
            clientId: activeClientId, 
            isClientLoading, 
            userProfile, 
            isConsultant,
            selectedClientId: consultantSelectedClientId,
            setSelectedClientId: handleSetSelectedClientId
        }}>
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
