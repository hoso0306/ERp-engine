"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { apiPut, ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

export interface SettingRow {
  id: string;
  module: string;
  key: string;
  value: string;
  defaultValue: string;
  valueType: "BOOLEAN" | "NUMBER" | "STRING" | "TEXT";
  description: string | null;
}

interface SettingModuleFormProps {
  module: string;
  settings: SettingRow[];
  onSaved: () => void;
}

export function SettingModuleForm({ module, settings, onSaved }: SettingModuleFormProps) {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("settings.update");
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValues(Object.fromEntries(settings.map((s) => [s.key, s.value])));
  }, [settings]);

  function set(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function restoreDefault(setting: SettingRow) {
    set(setting.key, setting.defaultValue);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, string | number | boolean> = {};
      for (const s of settings) {
        const raw = values[s.key];
        payload[s.key] = s.valueType === "BOOLEAN" ? raw === "true" : s.valueType === "NUMBER" ? Number(raw) : raw;
      }
      await apiPut(`/settings/${module}`, { values: payload });
      toast.success("Đã lưu.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5 max-w-2xl">
      {settings.map((s) => {
        const value = values[s.key] ?? s.value;
        const isDefault = value === s.defaultValue;
        return (
          <div key={s.id} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`setting-${s.key}`}>{s.description ?? s.key}</Label>
              {!isDefault && (
                <button
                  type="button"
                  onClick={() => restoreDefault(s)}
                  disabled={!canEdit}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  <RotateCcw className="h-3 w-3" />
                  Khôi phục mặc định
                </button>
              )}
            </div>
            {s.valueType === "BOOLEAN" && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`setting-${s.key}`}
                  checked={value === "true"}
                  onCheckedChange={(v) => set(s.key, v === true ? "true" : "false")}
                  disabled={!canEdit}
                />
                <span className="text-sm text-muted-foreground">{s.key}</span>
              </div>
            )}
            {s.valueType === "NUMBER" && (
              <Input
                id={`setting-${s.key}`}
                type="number"
                value={value}
                onChange={(e) => set(s.key, e.target.value)}
                disabled={!canEdit}
              />
            )}
            {s.valueType === "STRING" && (
              <Input
                id={`setting-${s.key}`}
                value={value}
                onChange={(e) => set(s.key, e.target.value)}
                disabled={!canEdit}
              />
            )}
            {s.valueType === "TEXT" && (
              <Textarea
                id={`setting-${s.key}`}
                value={value}
                onChange={(e) => set(s.key, e.target.value)}
                disabled={!canEdit}
                rows={3}
              />
            )}
          </div>
        );
      })}
      {canEdit && (
        <Button type="submit" disabled={saving}>
          {saving ? "Đang lưu..." : "Lưu"}
        </Button>
      )}
    </form>
  );
}
