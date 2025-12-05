'use server';
/**
 * @fileOverview User management system tools for consultancy actions.
 *
 * - getUserByEmail - A flow that retrieves a Firebase user's UID by their email.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as admin from 'firebase-admin';

// Initialize firebase-admin if it hasn't been already.
// The Firebase Studio environment handles credential management.
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const authAdmin = admin.auth();

export const getUserByEmail = ai.defineTool(
    {
        name: 'getUserByEmail',
        description: 'Get a user\'s UID by their email address.',
        inputSchema: z.object({ email: z.string().email() }),
        outputSchema: z.object({ uid: z.string() }),
    },
    async ({ email }) => {
        try {
            const userRecord = await authAdmin.getUserByEmail(email);
            return { uid: userRecord.uid };
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                throw new Error(`Usuário com o e-mail ${email} não encontrado.`);
            }
            throw new Error('Ocorreu um erro ao buscar o usuário.');
        }
    }
);
