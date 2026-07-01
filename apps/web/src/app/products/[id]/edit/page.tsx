"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader, Loading, ErrorState } from "@/components/shared";
import { ProductEditForm } from "@/components/product/product-edit-form";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  productTypeId: string;
  unitId: string;
  status: string;
}

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/products/${params.id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Không tìm thấy sản phẩm.");
        return res.json();
      })
      .then(setProduct)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
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
