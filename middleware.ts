import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = request.headers.get("host") || "";

  // www → bare domain redirect
  if (host.startsWith("www.")) {
    url.hostname = host.replace(/^www\./, "");
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  // ?page=N → /page/N redirect
  const page = url.searchParams.get("page");
  if (page && /^\d+$/.test(page) && parseInt(page) > 1) {
    url.searchParams.delete("page");
    url.pathname = url.pathname + "/page/" + page;
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|icon.png|favicon.ico|robots.txt|sitemap|.*\\..*).*)"],
};
