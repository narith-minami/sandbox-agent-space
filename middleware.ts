import { type NextRequest, NextResponse } from 'next/server';

/**
 * Basic認証をチェックするMiddleware
 *
 * 環境変数:
 * - BASIC_AUTH_USER: ユーザー名
 * - BASIC_AUTH_PASSWORD: パスワード
 *
 * 両方の環境変数が設定されている場合のみBasic認証が有効になります。
 * ローカル開発時や認証不要な環境では環境変数を設定しないことで認証をスキップできます。
 */
export function middleware(request: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD;

  // 環境変数が設定されていない場合は認証をスキップ
  if (!user || !password) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get('authorization');

  if (authHeader) {
    const authValue = authHeader.split(' ')[1];
    const [authUser, authPassword] = atob(authValue).split(':');

    if (authUser === user && authPassword === password) {
      return NextResponse.next();
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
