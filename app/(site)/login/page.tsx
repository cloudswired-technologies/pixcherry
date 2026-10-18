import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, Logo } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { turnstileSiteKey } from "@/lib/turnstile";
import { LoginForm } from "./login-form";

export const metadata = { title: "Log in", robots: { index: false, follow: true } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const raw = (await searchParams).next ?? "/dashboard";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
  if (await currentUser()) redirect(next);
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex justify-center">
          <Logo className="text-xl" />
        </Link>
        <Card className="p-6">
          <h1 className="text-xl font-bold">Log in or sign up</h1>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">Use the same email each time to see all your events.</p>
          <LoginForm next={next} siteKey={turnstileSiteKey()} />
        </Card>
      </div>
    </main>
  );
}
