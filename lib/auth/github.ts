const SESSION_COOKIE = 'github_auth_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const STATE_MAX_AGE_SECONDS = 10 * 60;

interface GitHubAuthState {
  nextPath: string;
  issuedAt: number;
}

export interface GitHubSessionUser {
  avatarUrl: string | null;
  id: number;
  login: string;
  name: string | null;
}

export interface GitHubSessionData {
  accessToken: string;
  expiresAt: number;
  issuedAt: number;
  user: GitHubSessionUser;
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecodeBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const paddingLength = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  const padded = `${normalized}${'='.repeat(paddingLength)}`;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlEncodeString(value: string): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

function base64UrlDecodeString(value: string): string {
  return new TextDecoder().decode(base64UrlDecodeBytes(value));
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

async function signValue(payload: string, secret: string): Promise<string> {
  const key = await getHmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

async function verifyValue(payload: string, signature: string, secret: string): Promise<boolean> {
  const key = await getHmacKey(secret);
  const signatureBytes = base64UrlDecodeBytes(signature);
  return crypto.subtle.verify('HMAC', key, signatureBytes, new TextEncoder().encode(payload));
}

export function getGitHubAuthSessionCookieName(): string {
  return SESSION_COOKIE;
}

export function getGitHubAuthSessionMaxAgeSeconds(): number {
  return SESSION_MAX_AGE_SECONDS;
}

export function isGitHubAuthEnabled(): boolean {
  return process.env.GITHUB_AUTH_ENABLED === 'true' || process.env.GITHUB_AUTH_ENABLED === '1';
}

export function getGitHubClientId(): string {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    throw new Error('GITHUB_CLIENT_ID is not configured');
  }
  return clientId;
}

export function getGitHubClientSecret(): string {
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error('GITHUB_CLIENT_SECRET is not configured');
  }
  return clientSecret;
}

export function getGitHubSessionSecret(): string {
  const sessionSecret = process.env.GITHUB_SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error('GITHUB_SESSION_SECRET is not configured');
  }
  return sessionSecret;
}

export function sanitizeNextPath(nextPath: string | null): string {
  if (!nextPath) return '/';
  if (!nextPath.startsWith('/')) return '/';
  if (nextPath.startsWith('//')) return '/';
  return nextPath;
}

export async function encodeSessionId(sessionId: string, secret: string): Promise<string> {
  const payload = base64UrlEncodeString(sessionId);
  const signature = await signValue(payload, secret);
  return `${payload}.${signature}`;
}

export async function decodeSessionId(value: string, secret: string): Promise<string | null> {
  const [payload, signature] = value.split('.');
  if (!payload || !signature) return null;
  const isValid = await verifyValue(payload, signature, secret);
  if (!isValid) return null;
  return base64UrlDecodeString(payload);
}

export async function encodeState(nextPath: string, secret: string): Promise<string> {
  const state: GitHubAuthState = {
    nextPath,
    issuedAt: Date.now(),
  };
  const payload = base64UrlEncodeString(JSON.stringify(state));
  const signature = await signValue(payload, secret);
  return `${payload}.${signature}`;
}

export async function decodeState(value: string, secret: string): Promise<string | null> {
  const [payload, signature] = value.split('.');
  if (!payload || !signature) return null;
  const isValid = await verifyValue(payload, signature, secret);
  if (!isValid) return null;
  const state = JSON.parse(base64UrlDecodeString(payload)) as GitHubAuthState;
  if (Date.now() - state.issuedAt > STATE_MAX_AGE_SECONDS * 1000) return null;
  return state.nextPath;
}

export function buildGitHubSessionData(accessToken: string, user: GitHubSessionUser): GitHubSessionData {
  const issuedAt = Date.now();
  return {
    accessToken,
    expiresAt: issuedAt + SESSION_MAX_AGE_SECONDS * 1000,
    issuedAt,
    user,
  };
}
