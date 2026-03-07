import type { FastifyReply, FastifyRequest } from 'fastify';
import type { User } from '@supabase/supabase-js';
import { createAnonClient, createUserClient } from './supabase.js';

export type AuthenticatedRequestContext = {
  accessToken: string;
  user: User;
};

function getBearerToken(request: FastifyRequest) {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length);
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<AuthenticatedRequestContext | null> {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    await reply.code(401).send({ message: 'Missing bearer token.' });
    return null;
  }

  const anonClient = createAnonClient();
  const {
    data: { user },
    error
  } = await anonClient.auth.getUser(accessToken);

  if (error || !user) {
    await reply.code(401).send({ message: 'Invalid bearer token.' });
    return null;
  }

  return {
    accessToken,
    user
  };
}

export function getUserClient(context: AuthenticatedRequestContext) {
  return createUserClient(context.accessToken);
}
