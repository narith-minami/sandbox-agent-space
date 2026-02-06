import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';

// Generate a random secret at module load if SESSION_SECRET is not provided
// This ensures each process has a unique secret, but sessions won't persist across deployments
let runtimeSecret: string | null = null;

/**
 * Get or generate session secret
 * In production, SESSION_SECRET should be set for session persistence across edge nodes
 */
function getSessionSecret(): string {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }

  // Warn if SESSION_SECRET is not set
  // In production, this means sessions won't persist across edge nodes
  console.warn(
    'SESSION_SECRET not set. Using runtime-generated secret. ' +
      'Sessions will not persist across server restarts or edge nodes. ' +
      'Set SESSION_SECRET environment variable for production use.'
  );

  // Generate a cryptographically secure random secret for this runtime instance
  if (!runtimeSecret) {
    runtimeSecret = randomBytes(32).toString('hex');
  }

  return runtimeSecret;
}

/**
 * Generate secure session token using HMAC
 * Uses cryptographic hash instead of reversible encoding
 */
function generateSessionToken(user: string, password: string): string {
  const secret = getSessionSecret();
  const hmac = createHmac('sha256', secret);
  hmac.update(`${user}:${password}`);
  return hmac.digest('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function secureCompare(a: string, b: string): boolean {
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    // Different lengths or invalid input
    return false;
  }
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
export function middleware(request: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD;

  // 環境変数が設定されていない場合は認証をスキップ
  if (!user || !password) {
    return NextResponse.next();
  }

  // Check for existing session cookie first
  const sessionCookie = request.cookies.get('basic_auth_session');
  if (sessionCookie) {
    const validToken = generateSessionToken(user, password);
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

      const decoded = Buffer.from(authValue, 'base64').toString('utf-8');
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
      const userMatch = secureCompare(authUser, user);
      const passwordMatch = secureCompare(authPassword, password);

      if (userMatch && passwordMatch) {
        const response = NextResponse.next();

        // Set session cookie for future requests
        response.cookies.set('basic_auth_session', generateSessionToken(user, password), {
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
