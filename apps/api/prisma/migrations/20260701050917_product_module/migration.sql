-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ParameterType" AS ENUM ('NUMBER', 'TEXT', 'ENUM', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "VersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RoundType" AS ENUM ('NONE', 'CEIL', 'FLOOR', 'ROUND');

-- CreateEnum
CREATE TYPE "PricingRuleType" AS ENUM ('MIN_AREA', 'MIN_DIMENSION', 'MIN_VALUE', 'ROUND', 'CUSTOM');

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_prices" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "supplier_id" TEXT,
    "price" DECIMAL(15,2) NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "product_type_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_parameters" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "ParameterType" NOT NULL,
    "unit" TEXT,
    "default_value" TEXT,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "min_value" DECIMAL(15,4),
    "max_value" DECIMAL(15,4),
    "step" DECIMAL(15,4),
    "used_in_pricing" BOOLEAN NOT NULL DEFAULT true,
    "used_in_material" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_parameter_options" (
    "id" TEXT NOT NULL,
    "parameter_id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_parameter_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rule_versions" (
    "id" TEXT NOT NULL,
    "pricing_rule_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "name" TEXT,
    "expression" TEXT,
    "price_round_type" "RoundType" NOT NULL DEFAULT 'NONE',
    "price_round_value" DECIMAL(15,0),
    "status" "VersionStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_rule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rule_items" (
    "id" TEXT NOT NULL,
    "pricing_rule_version_id" TEXT NOT NULL,
    "rule_type" "PricingRuleType" NOT NULL,
    "target_parameter" TEXT,
    "value" DECIMAL(15,4) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_rule_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_requirements" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_requirement_versions" (
    "id" TEXT NOT NULL,
    "material_requirement_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "name" TEXT,
    "status" "VersionStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_requirement_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_requirement_items" (
    "id" TEXT NOT NULL,
    "material_requirement_version_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "expression" TEXT NOT NULL,
    "waste_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "round_type" "RoundType" NOT NULL DEFAULT 'NONE',
    "round_value" DECIMAL(15,4),
    "note" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_requirement_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "units_name_key" ON "units"("name");

-- CreateIndex
CREATE UNIQUE INDEX "product_types_name_key" ON "product_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "materials_code_key" ON "materials"("code");

-- CreateIndex
CREATE INDEX "materials_is_active_idx" ON "materials"("is_active");

-- CreateIndex
CREATE INDEX "material_prices_material_id_idx" ON "material_prices"("material_id");

-- CreateIndex
CREATE INDEX "material_prices_material_id_is_default_idx" ON "material_prices"("material_id", "is_default");

-- CreateIndex
CREATE INDEX "material_prices_material_id_effective_from_idx" ON "material_prices"("material_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "products_code_key" ON "products"("code");

-- CreateIndex
CREATE INDEX "products_product_type_id_idx" ON "products"("product_type_id");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "products"("status");

-- CreateIndex
CREATE INDEX "products_deleted_at_idx" ON "products"("deleted_at");

-- CreateIndex
CREATE INDEX "product_parameters_product_id_display_order_idx" ON "product_parameters"("product_id", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "product_parameters_product_id_name_key" ON "product_parameters"("product_id", "name");

-- CreateIndex
CREATE INDEX "product_parameter_options_parameter_id_display_order_idx" ON "product_parameter_options"("parameter_id", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_rules_product_id_key" ON "pricing_rules"("product_id");

-- CreateIndex
CREATE INDEX "pricing_rule_versions_pricing_rule_id_status_idx" ON "pricing_rule_versions"("pricing_rule_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_rule_versions_pricing_rule_id_version_number_key" ON "pricing_rule_versions"("pricing_rule_id", "version_number");

-- CreateIndex
CREATE INDEX "pricing_rule_items_pricing_rule_version_id_idx" ON "pricing_rule_items"("pricing_rule_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_requirements_product_id_key" ON "material_requirements"("product_id");

-- CreateIndex
CREATE INDEX "material_requirement_versions_material_requirement_id_statu_idx" ON "material_requirement_versions"("material_requirement_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "material_requirement_versions_material_requirement_id_versi_key" ON "material_requirement_versions"("material_requirement_id", "version_number");

-- CreateIndex
CREATE INDEX "material_requirement_items_material_requirement_version_id_idx" ON "material_requirement_items"("material_requirement_version_id");

-- CreateIndex
CREATE INDEX "material_requirement_items_material_id_idx" ON "material_requirement_items"("material_id");

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_prices" ADD CONSTRAINT "material_prices_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_product_type_id_fkey" FOREIGN KEY ("product_type_id") REFERENCES "product_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_parameters" ADD CONSTRAINT "product_parameters_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_parameter_options" ADD CONSTRAINT "product_parameter_options_parameter_id_fkey" FOREIGN KEY ("parameter_id") REFERENCES "product_parameters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rule_versions" ADD CONSTRAINT "pricing_rule_versions_pricing_rule_id_fkey" FOREIGN KEY ("pricing_rule_id") REFERENCES "pricing_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rule_items" ADD CONSTRAINT "pricing_rule_items_pricing_rule_version_id_fkey" FOREIGN KEY ("pricing_rule_version_id") REFERENCES "pricing_rule_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requirement_versions" ADD CONSTRAINT "material_requirement_versions_material_requirement_id_fkey" FOREIGN KEY ("material_requirement_id") REFERENCES "material_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requirement_items" ADD CONSTRAINT "material_requirement_items_material_requirement_version_id_fkey" FOREIGN KEY ("material_requirement_version_id") REFERENCES "material_requirement_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requirement_items" ADD CONSTRAINT "material_requirement_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
