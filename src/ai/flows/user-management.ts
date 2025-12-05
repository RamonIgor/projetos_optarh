
'use server';
/**
 * @fileOverview User management flows for Firebase Authentication.
 *
 * - getUserByEmail - A function to retrieve a user's UID from their email.
 * - createUserFlow - A function to create a new user.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as admin from 'firebase-admin';

// The Firebase Admin SDK is automatically initialized by the environment.
// Manual initialization is not required and can cause errors.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const authAdmin = admin.auth();


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
      const userRecord = await authAdmin.getUserByEmail(email);
      return { uid: userRecord.uid };
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        return { error: 'User not found.' };
      }
      return { error: `An unexpected error occurred: ${error.message}` };
    }
  }
);


const CreateUserInputSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

const CreateUserOutputSchema = z.object({
    uid: z.string().optional(),
    error: z.string().optional(),
});

export const createUserFlow = ai.defineFlow(
    {
        name: 'createUserFlow',
        inputSchema: CreateUserInputSchema,
        outputSchema: CreateUserOutputSchema,
    },
    async ({ email, password }) => {
        try {
            const userRecord = await authAdmin.createUser({
                email,
                password,
            });
            return { uid: userRecord.uid };
        } catch (error: any) {
            let errorMessage = `An unexpected error occurred: ${error.message}`;
            if (error.code === 'auth/email-already-exists') {
                errorMessage = 'Este email já está em uso por outro colaborador.';
            } else if (error.code === 'auth/invalid-password') {
                errorMessage = 'A senha deve ter pelo menos 6 caracteres.';
            }
            return { error: errorMessage };
        }
    }
);
