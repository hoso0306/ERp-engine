"use client";

import { useEffect, useState, useCallback } from "react";
import { Loading, ErrorState } from "@/components/shared";
import { SettingsTabs } from "@/components/setting/settings-tabs";
import { RunningNumberTable } from "@/components/setting/running-number-table";
import { apiGet } from "@/lib/api";

interface RunningNumber {
  id: string;
  type: string;
  prefix: string;
  lastNumber: number;
  paddingLength: number;
  enabled: boolean;
}

export default function SettingsRunningNumbersPage() {
  const [runningNumbers, setRunningNumbers] = useState<RunningNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRunningNumbers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<RunningNumber[]>("/settings/running-numbers");
      setRunningNumbers(data);
    } catch {
      setError("Không thể tải bộ số chứng từ.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRunningNumbers();
  }, [fetchRunningNumbers]);

  return (
    <div className="space-y-6">
      <SettingsTabs active="running-numbers" />
      {loading && <Loading />}
      {error && <ErrorState description={error} onRetry={fetchRunningNumbers} />}
      {!loading && !error && (
        <RunningNumberTable runningNumbers={runningNumbers} onSaved={fetchRunningNumbers} />
      )}
    </div>
  );
}
