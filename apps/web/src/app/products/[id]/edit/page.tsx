"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader, Loading, ErrorState } from "@/components/shared";
import { ProductEditForm } from "@/components/product/product-edit-form";
import { apiGet, ApiError } from "@/lib/api";

interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  productTypeId: string;
  unitId: string;
  productionCenterId: string | null;
  status: string;
}

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiGet<Product>(`/products/${params.id}`);
        setProduct(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Không tìm thấy sản phẩm.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  if (loading) return <Loading />;
  if (error) return <ErrorState description={error} onRetry={() => router.refresh()} />;
  if (!product) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chỉnh sửa sản phẩm"
        description={product.code}
      />
      <ProductEditForm product={product} />
    </div>
  );
}
