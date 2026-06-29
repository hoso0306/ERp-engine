import { PageHeader } from "@/components/shared";
import { CustomerForm } from "@/components/customer/customer-form";

export default function NewCustomerPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Thêm khách hàng" description="Tạo khách hàng mới" />
      <CustomerForm />
    </div>
  );
}
