import { NextResponse } from "next/server";
import { PLANTS_COOKIE } from "@/lib/plants-auth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/plants", request.url), 303);
  response.cookies.set(PLANTS_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  response.cookies.set(PLANTS_COOKIE, "", { httpOnly: true, path: "/plants", maxAge: 0 });
  return response;
}
