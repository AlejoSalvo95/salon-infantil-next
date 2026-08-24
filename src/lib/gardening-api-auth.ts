import { isPlantsPasswordValid } from "./plants-auth";

export function isGardeningApiAuthorized(request: Request): boolean {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(supplied && isPlantsPasswordValid(supplied));
}
