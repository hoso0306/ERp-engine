"use client";

import { PageHeader } from "@/components/shared";
import { ProductForm } from "@/components/product/product-form";

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Thêm sản phẩm"
        description="Tạo sản phẩm mới"
      />
      <ProductForm />
    </div>
  );
}
