'use server';
/**
 * @fileoverview System tools for user management by consultants.
 * - getUserByEmail: Retrieves a user's UID by their email.
 * - listAllUsers: Lists all users in Firebase Auth.
 * - setUserDisabledStatus: Enables or disables a user account.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK if not already initialized.
// This is safe because Genkit flows run in a server environment
// where this initialization is controlled.
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const authAdmin = admin.auth();

const EmailInputSchema = z.object({
  email: z.string().email().describe('The email of the user to find.'),
});

const UserOutputSchema = z.object({
  uid: z.string(),
  email: z.string().optional(),
  displayName: z.string().optional(),
});

export const getUserByEmail = ai.defineFlow(
  {
    name: 'getUserByEmail',
    inputSchema: EmailInputSchema,
    outputSchema: UserOutputSchema,
  },
  async ({ email }) => {
    try {
      const userRecord = await authAdmin.getUserByEmail(email);
      return {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
      };
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        throw new Error(`Usuário com o e-mail ${email} não encontrado.`);
      }
      console.error('Error fetching user by email:', error);
      throw new Error('Erro ao buscar usuário.');
    }
  }
);


const UserListOutputSchema = z.array(z.object({
    uid: z.string(),
    email: z.string().optional().nullable(),
    displayName: z.string().optional().nullable(),
    disabled: z.boolean(),
    creationTime: z.string(),
    lastSignInTime: z.string().optional().nullable(),
}));


export const listAllUsers = ai.defineFlow(
    {
        name: 'listAllUsers',
        inputSchema: z.void(),
        outputSchema: UserListOutputSchema,
    },
    async () => {
        const result = await authAdmin.listUsers();
        return result.users.map(user => ({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            disabled: user.disabled,
            creationTime: user.metadata.creationTime,
            lastSignInTime: user.metadata.lastSignInTime,
        }));
    }
);


const SetDisabledSchema = z.object({
    uid: z.string(),
    disabled: z.boolean(),
});

export const setUserDisabledStatus = ai.defineFlow(
    {
        name: 'setUserDisabledStatus',
        inputSchema: SetDisabledSchema,
        outputSchema: z.object({ success: z.boolean(), message: z.string() }),
    },
    async ({ uid, disabled }) => {
        try {
            await authAdmin.updateUser(uid, { disabled });
            const message = `Usuário ${disabled ? 'desabilitado' : 'habilitado'} com sucesso.`;
            return { success: true, message };
        } catch (error) {
            console.error('Error updating user status:', error);
            throw new Error(`Falha ao ${disabled ? 'desabilitar' : 'habilitar'} usuário.`);
        }
    }
);
