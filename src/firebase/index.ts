"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
import { firebaseConfig } from "./config";

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

function initializeFirebase() {
    if (getApps().length > 0) {
        app = getApp();
        db = getFirestore(app);
        auth = getAuth(app);
    } else {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
    }
    return { app, db, auth };
}

export { initializeFirebase };
export { FirebaseClientProvider } from './client-provider';
export { useFirestore, useAuth, useFirebase, FirebaseProvider } from './provider';
export { useUser } from './auth/use-user';
export { useClient, ClientProvider } from './auth/use-client';
