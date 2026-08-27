-- CreateTable
CREATE TABLE "RefCounter" (
    "prefix" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RefCounter_pkey" PRIMARY KEY ("prefix")
);
