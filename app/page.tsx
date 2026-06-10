import { redirect } from "next/navigation";
import { getSessao } from "@/lib/session";

export default function Home() {
  const perfil = getSessao();
  if (perfil === "ESCRITORIO") redirect("/escritorio/dashboard");
  if (perfil === "MOTORISTA") redirect("/motorista/registo");
  redirect("/login");
}
