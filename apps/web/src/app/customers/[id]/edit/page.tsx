"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader, Loading, ErrorState } from "@/components/shared";
import { CustomerEditForm } from "@/components/customer/customer-edit-form";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function EditCustomerPage() {
  const params = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/customers/${params.id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Không tìm thấy khách hàng.");
        return res.json();
      })
      .then(setCustomer)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <Loading />;
  if (error) return <ErrorState description={error} onRetry={() => router.refresh()} />;
  if (!customer) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="Chỉnh sửa khách hàng" />
      <CustomerEditForm customer={customer} />
    </div>
  );
}
