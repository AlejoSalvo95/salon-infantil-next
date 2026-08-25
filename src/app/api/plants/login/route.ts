import { NextResponse } from "next/server";
import { isPlantsPasswordValid, PLANTS_COOKIE, PLANTS_SESSION_SECONDS, plantsSessionToken } from "@/lib/plants-auth";

const destinations = new Set(["/plants", "/flowers", "/seedlings"]);

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const requested = String(form.get("next") ?? "/plants");
  const destination = destinations.has(requested) ? requested : "/plants";

  if (!isPlantsPasswordValid(password)) {
    return NextResponse.redirect(new URL(`${destination}?error=1`, request.url), 303);
  }

  const response = NextResponse.redirect(new URL(destination, request.url), 303);
  response.cookies.set(PLANTS_COOKIE, "", { httpOnly: true, path: "/plants", maxAge: 0 });
  response.cookies.set(PLANTS_COOKIE, plantsSessionToken(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PLANTS_SESSION_SECONDS,
  });
  return response;
}
