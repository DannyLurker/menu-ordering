-- Stay check in setup code (spec 0008). Short lived one time code stored
-- as a hash with an expiry; the plain code is shown once and never stored.
-- Plain UNIQUE allows many NULL rows, so only live codes collide.
ALTER TABLE "Stay" ADD COLUMN "setupExpiresAt" TIMESTAMP(3),
ADD COLUMN "setupHash" TEXT;

CREATE UNIQUE INDEX "Stay_setupHash_key" ON "Stay"("setupHash");
