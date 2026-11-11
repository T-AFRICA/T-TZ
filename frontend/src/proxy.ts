import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Customer sessions (Supabase Auth via @supabase/ssr). On account routes the
 * proxy refreshes the session cookies and sends signed-out visitors to
 * /login; the account page checks the user again on the server, so this is
 * a convenience, not the only guard. Other routes are untouched.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }
  return response;
}

export const config = {
  matcher: ["/account/:path*"],
};
