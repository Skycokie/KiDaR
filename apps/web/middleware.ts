import { NextResponse, type NextRequest } from "next/server";

export async function middleware(_request: NextRequest) {
  // Appwrite sessions are httpOnly cookies validated per request via node-appwrite.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
