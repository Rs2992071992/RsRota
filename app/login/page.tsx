"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Perfil = "ESCRITORIO" | "MOTORISTA";
type Modo = "entrar" | "criar";

export default function LoginPage() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil>("MOTORISTA");
  const [modo, setModo] = useState<Modo>("entrar");

  // Campos de login
  const [codigo, setCodigo] = useState("");
  const [pin, setPin] = useState("");

  // Campos de criação de motorista
  const [novoCodigo, setNovoCodigo] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novoPin, setNovoPin] = useState("");

  const [erro, setErro] = useState("");
  const [aLigar, setALigar] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setALigar(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfil, codigo, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro || "Erro ao entrar.");
        return;
      }
      router.push(data.destino);
      router.refresh();
    } catch {
      setErro("Erro de ligação.");
    } finally {
      setALigar(false);
    }
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setALigar(true);
    try {
      const res = await fetch("/api/motoristas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: novoCodigo, nome: novoNome, pin: novoPin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro || "Erro ao criar motorista.");
        return;
      }
      // Sucesso: volta ao login já com o ID preenchido.
      setCodigo(novoCodigo);
      setPin("");
      setNovoCodigo("");
      setNovoNome("");
      setNovoPin("");
      setModo("entrar");
      setErro("✓ Motorista criado. Já pode entrar com o seu ID e PIN.");
    } catch {
      setErro("Erro de ligação.");
    } finally {
      setALigar(false);
    }
  }

  function trocarPerfil(p: Perfil) {
    setPerfil(p);
    setModo("entrar");
    setErro("");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <h1 className="mb-1 text-xl font-bold text-brand">RsRota</h1>
        <p className="mb-6 text-sm text-gray-500">A tua rota, os teus custos, sob controlo.</p>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => trocarPerfil("MOTORISTA")}
            className={`rounded-lg border px-3 py-3 text-sm font-medium ${
              perfil === "MOTORISTA"
                ? "border-brand bg-brand text-white"
                : "border-gray-300 bg-white text-gray-600"
            }`}
          >
            🚚 Motorista
          </button>
          <button
            type="button"
            onClick={() => trocarPerfil("ESCRITORIO")}
            className={`rounded-lg border px-3 py-3 text-sm font-medium ${
              perfil === "ESCRITORIO"
                ? "border-brand bg-brand text-white"
                : "border-gray-300 bg-white text-gray-600"
            }`}
          >
            🏢 Escritório
          </button>
        </div>

        {modo === "entrar" && (
          <form onSubmit={entrar}>
            {perfil === "MOTORISTA" && (
              <>
                <label className="label">O meu ID</label>
                <input
                  autoFocus
                  className="input mb-3"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="ex.: joao"
                />
              </>
            )}
            <label className="label">PIN</label>
            <input
              type="password"
              inputMode="numeric"
              className="input mb-3 text-center text-lg tracking-widest"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
            />
            {erro && (
              <p className={`mb-3 text-sm ${erro.startsWith("✓") ? "text-green-700" : "text-red-600"}`}>
                {erro}
              </p>
            )}
            <button type="submit" disabled={aLigar} className="btn w-full">
              {aLigar ? "A entrar…" : "Entrar"}
            </button>

            {perfil === "MOTORISTA" && (
              <button
                type="button"
                onClick={() => {
                  setModo("criar");
                  setErro("");
                }}
                className="mt-3 w-full text-center text-sm text-brand hover:underline"
              >
                Criar motorista (novo ID)
              </button>
            )}
          </form>
        )}

        {modo === "criar" && (
          <form onSubmit={criar}>
            <label className="label">ID (para entrar)</label>
            <input
              autoFocus
              className="input mb-3"
              value={novoCodigo}
              onChange={(e) => setNovoCodigo(e.target.value)}
              placeholder="ex.: joao"
            />
            <label className="label">Nome (opcional)</label>
            <input
              className="input mb-3"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="ex.: João Silva"
            />
            <label className="label">PIN (mín. 4 dígitos)</label>
            <input
              type="password"
              inputMode="numeric"
              className="input mb-3 text-center text-lg tracking-widest"
              value={novoPin}
              onChange={(e) => setNovoPin(e.target.value)}
              placeholder="••••"
            />
            {erro && <p className="mb-3 text-sm text-red-600">{erro}</p>}
            <button type="submit" disabled={aLigar} className="btn w-full">
              {aLigar ? "A criar…" : "Criar motorista"}
            </button>
            <button
              type="button"
              onClick={() => {
                setModo("entrar");
                setErro("");
              }}
              className="mt-3 w-full text-center text-sm text-gray-500 hover:underline"
            >
              ← Voltar ao login
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
