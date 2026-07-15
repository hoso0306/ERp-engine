"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Eye, History } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, ApiError } from "@/lib/api";

interface MaterialRequirementVersion {
  id: string;
  versionNumber: number;
  name: string | null;
  status: string;
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  DRAFT: { label: "Nháp", variant: "outline" },
  ACTIVE: { label: "Đang dùng", variant: "default" },
  ARCHIVED: { label: "Lưu trữ", variant: "secondary" },
};

function VersionTable({
  productId,
  versions,
}: {
  productId: string;
  versions: MaterialRequirementVersion[];
}) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Version</TableHead>
            <TableHead>Tên</TableHead>
            <TableHead className="text-center w-28">Trạng thái</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {versions.map((v) => {
            const st = statusMap[v.status] ?? statusMap.DRAFT;
            return (
              <TableRow key={v.id}>
                <TableCell className="font-mono text-sm">v{v.versionNumber}</TableCell>
                <TableCell className="text-sm">{v.name || "—"}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={st.variant}>{st.label}</Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    render={
                      <Link
                        href={`/products/${productId}/material-requirement/versions/${v.id}`}
                      />
                    }
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function MaterialRequirementSection({ productId }: { productId: string }) {
  const router = useRouter();
  const [versions, setVersions] = useState<MaterialRequirementVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await apiGet<{ versions?: MaterialRequirementVersion[] }>(
        `/products/${productId}/material-requirement`,
      );
      setVersions(data.versions ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreate() {
    setCreating(true);
    try {
      const version = await apiPost<{ id: string }>(
        `/products/${productId}/material-requirement/versions`,
        {},
      );
      router.push(`/products/${productId}/material-requirement/versions/${version.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể tạo phiên bản.");
    } finally {
      setCreating(false);
    }
  }

  const currentVersions = versions.filter((v) => v.status !== "ARCHIVED");
  const archivedVersions = versions.filter((v) => v.status === "ARCHIVED");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Định mức vật liệu</h3>
        <Button size="sm" onClick={handleCreate} disabled={creating}>
          <Plus className="mr-1 h-4 w-4" />
          {creating ? "Đang tạo..." : "Tạo version mới"}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Đang tải...</p>
      ) : versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có version nào.</p>
      ) : (
        <>
          {currentVersions.length > 0 ? (
            <VersionTable productId={productId} versions={currentVersions} />
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có version đang Nháp/Đang dùng.</p>
          )}

          {archivedVersions.length > 0 && (
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowArchived((v) => !v)}
                className="text-muted-foreground"
              >
                <History className="mr-1 h-4 w-4" />
                {showArchived ? "Ẩn lịch sử" : `Xem lịch sử (${archivedVersions.length} phiên bản cũ)`}
              </Button>
              {showArchived && <VersionTable productId={productId} versions={archivedVersions} />}
            </div>
          )}
        </>
      )}
    </div>
  );
}
