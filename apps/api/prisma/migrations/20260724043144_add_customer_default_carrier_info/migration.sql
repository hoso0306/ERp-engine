-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "default_carrier_name" TEXT,
ADD COLUMN     "default_carrier_note" TEXT,
ADD COLUMN     "default_carrier_phone" TEXT;

-- AlterTable
ALTER TABLE "receivables" ALTER COLUMN "total_amount_before_vat" DROP DEFAULT,
ALTER COLUMN "remaining_amount_before_vat" DROP DEFAULT;
