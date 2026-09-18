'use server';

import { db, auth } from "@/firebase/admin";
import { cookies } from "next/headers";
import { z } from "zod";


const ONE_WEEK = 60 * 60 * 24 * 7;
const MAX_SESSION_LOGIN_AGE_SECONDS = 5 * 60;

const signUpSchema = z.object({
    name: z.string().trim().min(3).max(80),
    idToken: z.string().min(1),
});

const signInSchema = z.object({
    email: z.string().trim().email(),
    idToken: z.string().min(1),
});

export async function signUp(params: SignUpParams) {
    try {
        const { name, idToken } = signUpSchema.parse(params);
        const decodedToken = await auth.verifyIdToken(idToken, true);
        const email = decodedToken.email;

        if (!email) {
            return {
                success: false,
                message: 'The authenticated account does not have an email address.'
            }
        }

        const uid = decodedToken.uid;
        const userRecord = await db.collection('user').doc(uid).get();

        if (userRecord.exists) {
            return {
                success: false,
                message: 'User already exists. Please sign in instead.'
            }
        }

        await db.collection('user').doc(uid).set({
            name, email
        })

        return {
            success: true,
            message: 'Account created successfully. Please sign in.'
        }

    } catch (e) {
        console.error('Error creating a user', e);

        if (e && typeof e === 'object' && 'code' in e && e.code === 'auth/email-already-exists') {
            return {
                success: false,
                message: 'This email is already in use'
            }
        }

        return {
            success: false,
            message: 'Failed to create an account'
        }
    }
}

export async function signIn(params: SignInParams) {
    try {
        const { email, idToken } = signInSchema.parse(params);
        const decodedToken = await auth.verifyIdToken(idToken, true);
        const verifiedEmail = decodedToken.email;

        if (
            typeof decodedToken.auth_time !== 'number' ||
            Math.floor(Date.now() / 1000) - decodedToken.auth_time > MAX_SESSION_LOGIN_AGE_SECONDS
        ) {
            return {
                success: false,
                message: 'Please sign in again before starting a new session.'
            }
        }

        if (!verifiedEmail || verifiedEmail.toLowerCase() !== email.trim().toLowerCase()) {
            return {
                success: false,
                message: 'The signed-in account does not match this email.'
            }
        }

        const userRef = db.collection('user').doc(decodedToken.uid);
        const userProfile = await userRef.get();

        // A Firebase Auth account can remain when profile creation previously
        // failed. Recreate that profile so authenticated routes can load it.
        if (!userProfile.exists) {
            const name = typeof decodedToken.name === 'string' && decodedToken.name.trim()
                ? decodedToken.name.trim()
                : verifiedEmail.split('@')[0];

            await userRef.set({ name, email: verifiedEmail });
        }

        await setSessionCookie(idToken);

        return {
            success: true,
            message: 'Signed in successfully.'
        }
    } catch (e) {
        console.error('Error signing in', e);

        return {
            success: false,
            message: 'Failed to prepare your account. Please try again.'
        }
    }
}

async function setSessionCookie(idToken: string) {
    const cookieStore = await cookies();

    const sessionCookie = await auth.createSessionCookie(idToken, {
        expiresIn: ONE_WEEK * 1000,
    })

    cookieStore.set('session', sessionCookie, {
        maxAge: ONE_WEEK,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'lax'
    })
}

export async function getCurrentUser(): Promise<User | null> {
    const cookieStore = await cookies();

    const sessionCookie = cookieStore.get('session')?.value;

    if (!sessionCookie) return null;

    try {
        const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);

        const userRecord = await db.
            collection('user')
            .doc(decodedClaims.uid)
            .get();

        if (!userRecord.exists) return null;

        return {
            ...userRecord.data(),
            id: userRecord.id,
        } as User;

    } catch (e) {
        console.log(e);

        return null;

    }
}

export async function isAuthenticated() {
    const user = await getCurrentUser();

    return !!user;
}
