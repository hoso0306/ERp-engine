"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader, Loading, ErrorState } from "@/components/shared";
import { MaterialEditForm } from "@/components/material/material-edit-form";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface Material {
  id: string;
  code: string;
  name: string;
  unitId: string;
  isActive: boolean;
  note: string | null;
  retailPrice: number | string | null;
  minimumStock: number | string | null;
}

export default function EditMaterialPage() {
  const params = useParams();
  const router = useRouter();
  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/materials/${params.id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Không tìm thấy vật tư.");
        return res.json();
      })
      .then(setMaterial)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <Loading />;
  if (error) return <ErrorState description={error} onRetry={() => router.refresh()} />;
  if (!material) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="Chỉnh sửa vật tư" description={material.code} />
      <MaterialEditForm material={material} />
    </div>
  );
}
