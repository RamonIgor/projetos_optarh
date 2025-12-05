
'use server';
/**
 * @fileOverview User management flows for Firebase Authentication.
 *
 * - getUserByEmail - A function to retrieve a user's UID from their email.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { firebaseConfig } from '@/firebase/config';

// Initialize Firebase Admin SDK if not already initialized
let adminApp: App;
if (!getApps().length) {
    adminApp = initializeApp({
        projectId: firebaseConfig.projectId,
    });
} else {
    adminApp = getApps()[0];
}


const UserByEmailInputSchema = z.string().email();

const UserByEmailOutputSchema = z.object({
  uid: z.string().optional(),
  error: z.string().optional(),
});

export const getUserByEmail = ai.defineFlow(
  {
    name: 'getUserByEmail',
    inputSchema: UserByEmailInputSchema,
    outputSchema: UserByEmailOutputSchema,
  },
  async (email) => {
    try {
      const auth = getAuth(adminApp);
      const userRecord = await auth.getUserByEmail(email);
      return { uid: userRecord.uid };
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        return { error: 'User not found' };
      }
      console.error('Error fetching user by email:', error);
      // It's better to return a structured error than to throw
      // as Genkit will wrap the throw in a less specific error message.
      return { error: `An unexpected error occurred: ${error.message}` };
    }
  }
);
