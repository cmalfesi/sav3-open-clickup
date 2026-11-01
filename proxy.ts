import { NextResponse, type NextRequest } from "next/server";
export function proxy(req:NextRequest) {
  void req;
  return NextResponse.next();
}
export const config={matcher:['/login']};
