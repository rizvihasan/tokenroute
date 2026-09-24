import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Self-serve signup: Google sign-in is the only door. The gateway provisions
// the tenant + API key server-side on first dashboard visit (lib/provision.ts).
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
});
