"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

export interface ConditionParameter {
  name: string;
  label: string;
  type: string;
  options: { value: string; label: string | null }[];
  // Optional — chỉ dùng ở nơi cần lọc theo phạm vi dùng (vd gợi ý biến cho
  // Công thức Định mức vật liệu). Không phá các chỗ khác đang dùng type này.
  usedInMaterial?: boolean;
}

interface Clause {
  parameter: string;
  operator: string;
  value: string;
}

const OPERATORS = ["==", "!=", ">", "<", ">=", "<="];

function serialize(clauses: Clause[], parameters: ConditionParameter[]): string {
  return clauses
    .filter((c) => c.parameter && c.value !== "")
    .map((c) => {
      const param = parameters.find((p) => p.name === c.parameter);
      const needsQuotes = param?.type === "ENUM" || param?.type === "TEXT";
      const value = needsQuotes ? `"${c.value}"` : c.value;
      return `${c.parameter} ${c.operator} ${value}`;
    })
    .join(" && ");
}

/**
 * Form builder đơn giản cho Rule Language (Sprint 03 Task 10): chọn tham số /
 * toán tử / giá trị → nối bằng && ra expression. Cho phép chuyển sang gõ tay
 * cho expression phức tạp hơn (||, so sánh số, v.v.) — cú pháp được kiểm tra
 * lại bởi API khi lưu (validate() của shared evaluator), không cần endpoint
 * validate-riêng.
 */
export function ConditionBuilder({
  value,
  onChange,
  parameters,
}: {
  value: string;
  onChange: (v: string) => void;
  parameters: ConditionParameter[];
}) {
  const [rawMode, setRawMode] = useState(!!value.trim());
  const [clauses, setClauses] = useState<Clause[]>([]);

  function updateClauses(next: Clause[]) {
    setClauses(next);
    onChange(serialize(next, parameters));
  }

  function addClause() {
    updateClauses([...clauses, { parameter: parameters[0]?.name ?? "", operator: "==", value: "" }]);
  }

  function removeClause(idx: number) {
    updateClauses(clauses.filter((_, i) => i !== idx));
  }

  function updateClause(idx: number, patch: Partial<Clause>) {
    updateClauses(clauses.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Điều kiện áp dụng (để trống = luôn áp dụng)
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 text-xs"
          onClick={() => {
            if (!rawMode) {
              // Chuyển sang xây dựng đơn giản: bỏ nội dung gõ tay hiện có.
              setClauses([]);
              onChange("");
            }
            setRawMode(!rawMode);
          }}
        >
          {rawMode ? "Xây dựng đơn giản" : "Gõ tay (nâng cao)"}
        </Button>
      </div>

      {rawMode ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="font-mono text-sm"
          placeholder='ví dụ: socanh == 2 && mausac == "do"'
        />
      ) : (
        <div className="space-y-2">
          {clauses.map((clause, idx) => {
            const param = parameters.find((p) => p.name === clause.parameter);
            return (
              <div key={idx} className="flex items-center gap-2">
                <Select
                  value={clause.parameter}
                  onValueChange={(v) => updateClause(idx, { parameter: v ?? "", value: "" })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Tham số..." />
                  </SelectTrigger>
                  <SelectContent>
                    {parameters.map((p) => (
                      <SelectItem key={p.name} value={p.name}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={clause.operator}
                  onValueChange={(v) => updateClause(idx, { operator: v ?? "==" })}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((op) => (
                      <SelectItem key={op} value={op}>
                        {op}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {param?.type === "ENUM" ? (
                  <Select
                    value={clause.value}
                    onValueChange={(v) => updateClause(idx, { value: v ?? "" })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Giá trị..." />
                    </SelectTrigger>
                    <SelectContent>
                      {param.options.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label ?? o.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    className="flex-1"
                    value={clause.value}
                    onChange={(e) => updateClause(idx, { value: e.target.value })}
                    placeholder="Giá trị..."
                  />
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeClause(idx)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            );
          })}

          <Button type="button" variant="outline" size="sm" onClick={addClause}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Thêm điều kiện
          </Button>

          {value && (
            <p className="text-xs text-muted-foreground font-mono">→ {value}</p>
          )}
        </div>
      )}
    </div>
  );
}
