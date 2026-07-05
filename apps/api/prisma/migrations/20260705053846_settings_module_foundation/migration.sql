-- CreateEnum
CREATE TYPE "SettingValueType" AS ENUM ('BOOLEAN', 'NUMBER', 'STRING', 'TEXT');

-- AlterTable
ALTER TABLE "running_numbers" ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "logo" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "tax_code" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "currency_symbol" TEXT NOT NULL DEFAULT '₫',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "default_value" TEXT NOT NULL,
    "value_type" "SettingValueType" NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "settings_module_idx" ON "settings"("module");

-- CreateIndex
CREATE UNIQUE INDEX "settings_module_key_key" ON "settings"("module", "key");
