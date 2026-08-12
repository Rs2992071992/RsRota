import AlterarPinProprio from "@/components/AlterarPinProprio";

export default function PerfilMotoristaPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Perfil</h1>
      <AlterarPinProprio titulo="Alterar o meu PIN" />
    </div>
  );
}
