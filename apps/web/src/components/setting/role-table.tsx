"use client";

import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export interface RoleRow {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

interface RoleTableProps {
  roles: RoleRow[];
  userCountByRole: Record<string, number>;
}

export function RoleTable({ roles, userCountByRole }: RoleTableProps) {
  const router = useRouter();

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-32">Code</TableHead>
            <TableHead>Tên vai trò</TableHead>
            <TableHead className="text-center">Số người dùng</TableHead>
            <TableHead className="text-center">Trạng thái</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((r) => (
            <TableRow key={r.id} className="cursor-pointer" onClick={() => router.push(`/settings/roles/${r.id}`)}>
              <TableCell className="font-mono text-xs">{r.code}</TableCell>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell className="text-center text-sm">{userCountByRole[r.id] ?? 0}</TableCell>
              <TableCell className="text-center">
                <Badge variant={r.isActive ? "default" : "secondary"}>
                  {r.isActive ? "Đang dùng" : "Đã vô hiệu hoá"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
