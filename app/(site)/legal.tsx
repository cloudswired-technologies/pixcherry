import { SiteFooter, SiteHeader } from "@/components/site-header";

type Sections = [string, string][];

function Body({ sections }: { sections: Sections }) {
  return (
    <div className="mt-8 grid gap-6">
      {sections.map(([h, body]) => (
        <section key={h}>
          <h2 className="text-lg font-bold">{h}</h2>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{body}</p>
        </section>
      ))}
    </div>
  );
}

/** A legal page; `translation` adds the same text in another language below (PDPA notices need BM and English). */
export function LegalPage({
  title,
  updated,
  sections,
  translation,
}: {
  title: string;
  updated: string;
  sections: Sections;
  translation?: { id: string; label: string; title: string; updated: string; sections: Sections };
}) {
  return (
    <>
      <SiteHeader />
      <main className="container-page max-w-3xl py-12">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {updated}
          {translation ? (
            <>
              {" · "}
              <a href={`#${translation.id}`} className="font-semibold text-ink underline underline-offset-4">
                {translation.label}
              </a>
            </>
          ) : null}
        </p>
        <Body sections={sections} />
        {translation ? (
          <div id={translation.id} className="mt-14 scroll-mt-20 border-t border-border pt-10">
            <h1 className="text-3xl font-bold tracking-tight">{translation.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{translation.updated}</p>
            <Body sections={translation.sections} />
          </div>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}
