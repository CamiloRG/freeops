/**
 * Shared type + initial value for the auth Server Actions' `useActionState`
 * reducer shape. Deliberately NOT in `actions.ts` — a `"use server"` file
 * may only export async functions, and a plain object export (even a typed
 * constant like `initialAuthActionState`) breaks that at build time. See
 * https://nextjs.org/docs/messages/invalid-use-server-value
 */
export type AuthActionState = {
  status: "idle" | "error" | "check-email";
  fieldErrors?: Partial<Record<string, string>>;
  formError?: string;
  email?: string;
};

export const initialAuthActionState: AuthActionState = { status: "idle" };
