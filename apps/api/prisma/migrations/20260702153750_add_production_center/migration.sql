-- AlterTable
ALTER TABLE "products" ADD COLUMN     "production_center_id" TEXT;

-- CreateTable
CREATE TABLE "production_centers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_centers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "production_centers_code_key" ON "production_centers"("code");

-- CreateIndex
CREATE INDEX "production_centers_is_active_idx" ON "production_centers"("is_active");

-- CreateIndex
CREATE INDEX "products_production_center_id_idx" ON "products"("production_center_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_production_center_id_fkey" FOREIGN KEY ("production_center_id") REFERENCES "production_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
