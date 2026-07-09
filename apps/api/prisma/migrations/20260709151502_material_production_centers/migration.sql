-- CreateTable
CREATE TABLE "material_production_centers" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "production_center_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_production_centers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "material_production_centers_production_center_id_idx" ON "material_production_centers"("production_center_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_production_centers_material_id_production_center_i_key" ON "material_production_centers"("material_id", "production_center_id");

-- AddForeignKey
ALTER TABLE "material_production_centers" ADD CONSTRAINT "material_production_centers_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_production_centers" ADD CONSTRAINT "material_production_centers_production_center_id_fkey" FOREIGN KEY ("production_center_id") REFERENCES "production_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
