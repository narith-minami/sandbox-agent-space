import { type NextRequest, NextResponse } from 'next/server';

// Runtime secret generated on first use if SESSION_SECRET is not provided
// This ensures each process has a unique secret, but sessions won't persist across deployments
let runtimeSecret: string | null = null;
let hasWarnedAboutSecret = false;

/**
 * Get or generate session secret
 * In production, SESSION_SECRET should be set for session persistence across edge nodes
 */
function getSessionSecret(): string {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }

  // Warn once if SESSION_SECRET is not set
  // In production, this means sessions won't persist across edge nodes
  if (!hasWarnedAboutSecret) {
    console.warn(
      'SESSION_SECRET not set. Using runtime-generated secret. ' +
        'Sessions will not persist across server restarts or edge nodes. ' +
        'Set SESSION_SECRET environment variable for production use.'
    );
    hasWarnedAboutSecret = true;
  }

  // Generate a cryptographically secure random secret for this runtime instance
  if (!runtimeSecret) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    runtimeSecret = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  return runtimeSecret;
}

/**
 * Generate secure session token using HMAC (Web Crypto API)
 * Uses cryptographic hash instead of reversible encoding
 */
async function generateSessionToken(user: string, password: string): Promise<string> {
  const secret = getSessionSecret();
  const encoder = new TextEncoder();

  // Import the secret as a key
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Sign the user:password combination
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${user}:${password}`));

  // Convert to hex string
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join(
    ''
  );
}

/**
 * Constant-time string comparison to prevent timing attacks
 * Uses Web Crypto API's subtle.timingSafeEqual when available
 */
function secureCompare(a: string, b: string): boolean {
  // Different lengths cannot be equal
  if (a.length !== b.length) {
    return false;
  }

  // Convert strings to Uint8Array for comparison
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);

  // Perform constant-time comparison
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }

  return result === 0;
}

/**
 * Basic認証をチェックするMiddleware
 *
 * 環境変数:
 * - BASIC_AUTH_USER: ユーザー名
 * - BASIC_AUTH_PASSWORD: パスワード
 * - SESSION_SECRET: セッショントークン生成用のシークレット（オプション）
 *
 * 両方の環境変数が設定されている場合のみBasic認証が有効になります。
 * ローカル開発時や認証不要な環境では環境変数を設定しないことで認証をスキップできます。
 *
 * 認証成功後、セッションCookieを設定することで、以降のリクエストでは
 * Authorizationヘッダーを要求せず、Cookieによる認証を行います。
 */
export async function middleware(request: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD;

  // 環境変数が設定されていない場合は認証をスキップ
  if (!user || !password) {
    return NextResponse.next();
  }

  // Check for existing session cookie first
  const sessionCookie = request.cookies.get('basic_auth_session');
  if (sessionCookie) {
    const validToken = await generateSessionToken(user, password);
    if (secureCompare(sessionCookie.value, validToken)) {
      return NextResponse.next(); // Valid session, allow access
    }
    // Invalid session cookie - fall through to Authorization header check
  }

  // Check Authorization header
  const authHeader = request.headers.get('authorization');

  if (authHeader) {
    try {
      const authValue = authHeader.split(' ')[1];
      if (!authValue) {
        // Invalid auth header format
        return NextResponse.json(
          { error: 'Invalid authorization header format' },
          {
            status: 401,
            headers: {
              'WWW-Authenticate': 'Basic realm="Sandbox Agent Space"',
            },
          }
        );
      }

      const decoded = atob(authValue);
      const colonIndex = decoded.indexOf(':');

      if (colonIndex === -1) {
        // No colon found in decoded string
        return NextResponse.json(
          { error: 'Invalid authorization credentials format' },
          {
            status: 401,
            headers: {
              'WWW-Authenticate': 'Basic realm="Sandbox Agent Space"',
            },
          }
        );
      }

      const authUser = decoded.slice(0, colonIndex);
      const authPassword = decoded.slice(colonIndex + 1);

      // Use constant-time comparison to prevent timing attacks
      // Both comparisons execute before the conditional check
      const userMatch = secureCompare(authUser, user);
      const passwordMatch = secureCompare(authPassword, password);

      if (userMatch && passwordMatch) {
        const response = NextResponse.next();

        // Set session cookie for future requests
        const token = await generateSessionToken(user, password);
        response.cookies.set('basic_auth_session', token, {
          httpOnly: true,
          maxAge: 28800, // 8 hours
          path: '/',
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        });

        return response;
      }
    } catch (error) {
      console.error('Error parsing basic auth header:', error);
      // Invalid auth header format, fall through to 401 response
    }
  }

  // 認証失敗時は401を返す
  return new NextResponse('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  });
}

/**
 * Middlewareを適用するパスの設定
 * - APIルートとNext.jsの内部ルートは除外
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
