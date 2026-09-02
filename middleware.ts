import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";

const PUBLIC_PATHS = ["/login", "/invite"];

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Records real site activity (see touch_last_seen()'s own throttling) —
  // separate from auth.users.last_sign_in_at, which only updates on a fresh
  // login and can go stale for weeks under a persistent session. Backgrounded
  // via waitUntil so it never delays the response.
  if (user) event.waitUntil(Promise.resolve(supabase.rpc("touch_last_seen")));

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Section-gated route: /atl requires an explicit grant (admins pass implicitly via has_section).
  if (user && path.startsWith("/atl")) {
    const { data: allowed } = await supabase.rpc("has_section", { sec: "atl" });
    if (!allowed) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  // Role-gated route: /admin requires role = admin.
  if (user && path.startsWith("/admin")) {
    const { data: admin } = await supabase.rpc("is_admin");
    if (!admin) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  // api/ is excluded: those routes (e.g. the Drive metadata cron) authenticate
  // themselves via a secret header, not a user session cookie.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
