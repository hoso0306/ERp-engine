/*
  Warnings:

  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "users_id_seq";

-- CreateTable
CREATE TABLE "running_numbers" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "padding_length" INTEGER NOT NULL DEFAULT 6,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "running_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_routes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "province" TEXT,
    "district" TEXT,
    "ward" TEXT,
    "address" TEXT,
    "customer_group_id" TEXT,
    "delivery_route_id" TEXT,
    "sale_id" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "default_discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "debt_limit" DECIMAL(15,0) NOT NULL DEFAULT 0,
    "debt_term_days" INTEGER NOT NULL DEFAULT 30,
    "note" TEXT,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "running_numbers_type_key" ON "running_numbers"("type");

-- CreateIndex
CREATE UNIQUE INDEX "customer_groups_name_key" ON "customer_groups"("name");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_routes_name_key" ON "delivery_routes"("name");

-- CreateIndex
CREATE UNIQUE INDEX "customers_code_key" ON "customers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "customers_customer_group_id_idx" ON "customers"("customer_group_id");

-- CreateIndex
CREATE INDEX "customers_delivery_route_id_idx" ON "customers"("delivery_route_id");

-- CreateIndex
CREATE INDEX "customers_sale_id_idx" ON "customers"("sale_id");

-- CreateIndex
CREATE INDEX "customers_status_idx" ON "customers"("status");

-- CreateIndex
CREATE INDEX "customers_deleted_at_idx" ON "customers"("deleted_at");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_customer_group_id_fkey" FOREIGN KEY ("customer_group_id") REFERENCES "customer_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_delivery_route_id_fkey" FOREIGN KEY ("delivery_route_id") REFERENCES "delivery_routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
