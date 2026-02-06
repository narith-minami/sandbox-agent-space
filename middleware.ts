import { type NextRequest, NextResponse } from 'next/server';

/**
 * Generate session token from credentials
 * Simple implementation using base64 encoding
 */
function generateSessionToken(user: string, password: string): string {
  const secret = process.env.SESSION_SECRET || 'basic-auth-session';
  return Buffer.from(`${user}:${password}:${secret}`).toString('base64');
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
    if (sessionCookie.value === validToken) {
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

      if (authUser === user && authPassword === password) {
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
