/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,user_id]` on the table `vet_profiles` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "vet_profiles_user_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "vet_profiles_tenantId_user_id_key" ON "vet_profiles"("tenantId", "user_id");
