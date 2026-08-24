import { NextResponse } from "next/server";
import { isPlantsPasswordValid, PLANTS_COOKIE, PLANTS_SESSION_SECONDS, plantsSessionToken } from "@/lib/plants-auth";

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  if (!isPlantsPasswordValid(password)) {
    return NextResponse.redirect(new URL("/plants?error=1", request.url), 303);
  }

  const response = NextResponse.redirect(new URL("/plants", request.url), 303);
  response.cookies.set(PLANTS_COOKIE, plantsSessionToken(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/plants",
    maxAge: PLANTS_SESSION_SECONDS,
  });
  return response;
}
