import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

    // Skip auth check for static files
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon') ||
        pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/)
    ) {
        return NextResponse.next();
    }

    // Cron routes — verified by secret header only (no Supabase needed)
    if (pathname.startsWith('/api/cron/')) {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return NextResponse.next();
    }

    // Guard: if Supabase env vars not configured, show helpful error on login page
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('[YOUR-PROJECT-REF]')) {
        // In dev without env vars, allow access to everything so devs can see the UI
        if (process.env.NODE_ENV === 'development') {
            return NextResponse.next();
        }
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 });
    }

    let response = NextResponse.next({
        request: { headers: request.headers },
    });

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
            get(name: string) {
                return request.cookies.get(name)?.value;
            },
            set(name: string, value: string, options: CookieOptions) {
                request.cookies.set({ name, value, ...options });
                response = NextResponse.next({ request: { headers: request.headers } });
                response.cookies.set({ name, value, ...options });
            },
            remove(name: string, options: CookieOptions) {
                request.cookies.set({ name, value: '', ...options });
                response = NextResponse.next({ request: { headers: request.headers } });
                response.cookies.set({ name, value: '', ...options });
            },
        },
    });

    const { data: { session } } = await supabase.auth.getSession();

    // Logged-in user hitting /login → redirect to dashboard
    if (pathname === '/login') {
        if (session) {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }
        return response;
    }

    // Allow API routes to handle their own auth
    if (pathname.startsWith('/api/')) {
        return response;
    }

    // All pages require authentication
    if (!session) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('returnTo', pathname);
        return NextResponse.redirect(loginUrl);
    }

    return response;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
