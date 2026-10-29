// Descarrega um ficheiro gerado no browser (blob). No browser normal usa um
// <a download>. Dentro da app Android de Administração (uma WebView) isso não
// faz nada — o Android ignora downloads por blob —, por isso a app expõe uma
// ponte `RsRotaAndroid` (MainActivity) que recebe o ficheiro e abre a folha de
// partilha (Drive, WhatsApp, email, guardar…).

interface PonteAndroid {
  guardarBase64(nomeFicheiro: string, mime: string, base64: string): void;
}

function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(leitor.error);
    leitor.onload = () => {
      // "data:<mime>;base64,<dados>" → só os dados.
      const r = String(leitor.result);
      resolve(r.slice(r.indexOf(",") + 1));
    };
    leitor.readAsDataURL(blob);
  });
}

export async function descarregarBlob(blob: Blob, nomeFicheiro: string): Promise<void> {
  const ponte = (window as unknown as { RsRotaAndroid?: PonteAndroid }).RsRotaAndroid;
  if (ponte) {
    ponte.guardarBase64(nomeFicheiro, blob.type || "application/octet-stream", await blobParaBase64(blob));
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeFicheiro;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
