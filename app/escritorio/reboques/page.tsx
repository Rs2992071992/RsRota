import { prisma } from "@/lib/db";
import ReboquesManager from "./ReboquesManager";

export const dynamic = "force-dynamic";

export default async function ReboquesPage() {
  const reboques = await prisma.reboque.findMany({ orderBy: { criadoEm: "asc" } });
  return <ReboquesManager reboques={reboques} />;
}
