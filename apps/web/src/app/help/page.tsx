"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Sparkles } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/auth-context";
import { CHANGELOG } from "@/content/help/changelog";
import { HELP_ARTICLES, HELP_GROUP_ORDER } from "@/content/help/articles";
import { canSeeHelp, formatHelpDate } from "@/content/help/types";

type HelpTab = "updates" | "guides";

// Mục "Hướng dẫn & cập nhật" (030) — chỉ đọc nội dung tĩnh ở content/help/,
// ẩn dòng/bài theo quyền của người đang xem. Tab đọc từ ?tab= để link Zalo /
// trang khác mở thẳng đúng tab.
function HelpPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const tab: HelpTab = searchParams.get("tab") === "guides" ? "guides" : "updates";

  const releases = CHANGELOG.map((release) => ({
    ...release,
    items: release.items.filter((item) => canSeeHelp(item.requiredAnyPermission, hasPermission)),
  })).filter((release) => release.items.length > 0);

  const visibleArticles = HELP_ARTICLES.filter((a) => canSeeHelp(a.requiredAnyPermission, hasPermission));
  const articleSlugs = new Set(visibleArticles.map((a) => a.slug));
  const groups = HELP_GROUP_ORDER.map((group) => ({
    group,
    articles: visibleArticles.filter((a) => a.group === group),
  })).filter((g) => g.articles.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hướng dẫn & cập nhật"
        description="Những gì mới trong phần mềm và hướng dẫn sử dụng theo từng công việc"
      />

      <Tabs value={tab} onValueChange={(v) => router.replace(v === "guides" ? "/help?tab=guides" : "/help")}>
        <TabsList>
          <TabsTrigger value="updates">Có gì mới</TabsTrigger>
          <TabsTrigger value="guides">Hướng dẫn sử dụng</TabsTrigger>
        </TabsList>

        <TabsContent value="updates" className="mt-4 space-y-6">
          {releases.length === 0 ? (
            <EmptyState title="Chưa có cập nhật" description="Chưa có đợt cập nhật nào liên quan tới tài khoản của bạn." />
          ) : (
            releases.map((release) => (
              <section key={release.date} className="space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-lg font-semibold">{release.title}</h3>
                  <span className="text-sm text-muted-foreground">{formatHelpDate(release.date)}</span>
                </div>
                <ul className="space-y-4">
                  {release.items.map((item) => (
                    <li key={item.title} className="flex gap-3">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="space-y-1">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                        {item.bullets && (
                          <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                            {item.bullets.map((b) => (
                              <li key={b}>{b}</li>
                            ))}
                          </ul>
                        )}
                        {item.articleSlug && articleSlugs.has(item.articleSlug) && (
                          <Link href={`/help/${item.articleSlug}`} className="inline-block text-sm text-primary hover:underline">
                            Xem hướng dẫn chi tiết →
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                {release.notes && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    <p className="font-medium">Lưu ý</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                      {release.notes.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            ))
          )}
        </TabsContent>

        <TabsContent value="guides" className="mt-4 space-y-8">
          {groups.length === 0 ? (
            <EmptyState title="Chưa có hướng dẫn" description="Chưa có bài hướng dẫn nào liên quan tới tài khoản của bạn." />
          ) : (
            groups.map(({ group, articles }) => (
              <section key={group} className="space-y-3">
                <h3 className="text-lg font-semibold">{group}</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {articles.map((article) => (
                    <Link
                      key={article.slug}
                      href={`/help/${article.slug}`}
                      className="group flex items-start justify-between gap-3 rounded-lg border p-4 transition-colors hover:border-primary hover:bg-accent"
                    >
                      <div>
                        <p className="text-sm font-medium">{article.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{article.summary}</p>
                      </div>
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                    </Link>
                  ))}
                </div>
              </section>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function HelpPage() {
  return (
    <Suspense>
      <HelpPageContent />
    </Suspense>
  );
}
