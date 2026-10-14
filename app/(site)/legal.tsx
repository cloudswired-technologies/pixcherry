import { SiteFooter, SiteHeader } from "@/components/site-header";

export function LegalPage({ title, sections }: { title: string; sections: [string, string][] }) {
  return (
    <>
      <SiteHeader />
      <main className="container-page max-w-3xl py-12">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated October 2026.</p>
        <div className="mt-8 grid gap-6">
          {sections.map(([h, body]) => (
            <section key={h}>
              <h2 className="text-lg font-bold">{h}</h2>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{body}</p>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
