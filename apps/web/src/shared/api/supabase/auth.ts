import type { User } from '@supabase/supabase-js';
import { env } from '@/shared/config/env';
import { supabase } from './client';

function isMissingUserError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('invalid login credentials') ||
    normalized.includes('email not confirmed') ||
    normalized.includes('user not found')
  );
}

function isRetryableAuthError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('database error querying schema') ||
    normalized.includes('database error finding user') ||
    normalized.includes('database error saving new user') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('network request failed')
  );
}

async function sleep(delayMs: number) {
  await new Promise((resolve) => window.setTimeout(resolve, delayMs));
}

async function signInWithDevCredentials() {
  const signInResult = await signInWithPassword(env.devAuthEmail, env.devAuthPassword);

  if (!signInResult.error) {
    return signInResult;
  }

  if (!isMissingUserError(signInResult.error.message)) {
    throw signInResult.error;
  }

  const signUpResult = await signUpWithPassword(env.devAuthEmail, env.devAuthPassword, 'Local Tenant Admin');

  if (signUpResult.error && !signUpResult.error.message.toLowerCase().includes('already registered')) {
    throw signUpResult.error;
  }

  const retryResult = await signInWithPassword(env.devAuthEmail, env.devAuthPassword);

  if (retryResult.error) {
    throw retryResult.error;
  }

  return retryResult;
}

export async function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({
    email,
    password
  });
}

export async function signUpWithPassword(email: string, password: string, displayName?: string) {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName ?? email.split('@')[0]
      }
    }
  });
}

export async function signOutSession() {
  const result = await supabase.auth.signOut();
  if (result.error) {
    throw result.error;
  }
}

export async function ensureDevSession() {
  const attempts = 10;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (session) {
      return session;
    }

    try {
      const result = await signInWithDevCredentials();
      return result.data.session ?? null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (!isRetryableAuthError(message) || attempt === attempts - 1) {
        throw error;
      }

      await sleep(400);
    }
  }

  return null;
}

export async function getCurrentActorId(): Promise<string | null> {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}

export async function getCurrentSessionUser() {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user;
}

export async function resolveAuthenticatedUser(retries = 10, delayMs = 150): Promise<User | null> {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const user = await getCurrentSessionUser();

    if (user) {
      return user;
    }

    await sleep(delayMs);
  }

  return null;
}

export function subscribeToAuthChanges(callback: (user: User | null) => void) {
  const subscription = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });

  return () => subscription.data.subscription.unsubscribe();
}
