"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, Info } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { HELP_ARTICLES } from "@/content/help/articles";
import { canSeeHelp, formatHelpDate } from "@/content/help/types";

// Bài hướng dẫn chi tiết (030) — dữ liệu ở content/help/articles/. Bài không
// liên quan tới quyền của người xem thì coi như không tồn tại.
export default function HelpArticlePage() {
  const params = useParams();
  const { hasPermission } = useAuth();
  const article = HELP_ARTICLES.find((a) => a.slug === params.slug);

  if (!article || !canSeeHelp(article.requiredAnyPermission, hasPermission)) {
    return (
      <EmptyState
        title="Không tìm thấy bài hướng dẫn"
        description="Bài này không tồn tại hoặc không liên quan tới tài khoản của bạn."
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/help?tab=guides" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" />
        Tất cả hướng dẫn
      </Link>

      <PageHeader
        title={article.title}
        description={`${article.summary} · Cập nhật ${formatHelpDate(article.updatedAt)}`}
      />

      {article.sections.map((section) => (
        <section key={section.heading} className="space-y-3 rounded-xl border bg-card p-4 shadow-sm sm:p-6">
          <h3 className="text-lg font-semibold">{section.heading}</h3>
          {section.intro && <p className="text-sm leading-relaxed">{section.intro}</p>}

          {section.steps && (
            <ol className="space-y-2">
              {section.steps.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm leading-relaxed">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          )}

          {section.bullets && (
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
              {section.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}

          {section.notes && (
            <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <ul className="space-y-1">
                {section.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          )}

          {section.links && (
            <div className="flex flex-wrap gap-2">
              {section.links.map((link) => (
                <Button key={link.href} variant="outline" size="sm" render={<Link href={link.href} />}>
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  {link.label}
                </Button>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
