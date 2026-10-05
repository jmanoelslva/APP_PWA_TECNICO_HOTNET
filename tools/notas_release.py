"""Monta a nota de cada release do GitHub a partir do CHANGELOG.md.

    python tools/notas_release.py 1.6.1              # mostra a nota
    python tools/notas_release.py 1.6.1 --aplicar    # atualiza título e nota no GitHub (gh)
    python tools/notas_release.py --todas --aplicar  # todas as versões do CHANGELOG

Título: "v1.6.1 · <assunto do commit da tag>" (ou de TITULOS). As linhas do CHANGELOG são
quebradas por largura; aqui cada item vira uma linha só (no GitHub, quebra de
linha dentro do texto da release aparece como quebra mesmo).
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
REPO = "https://github.com/jmanoelslva/APP_PWA_TECNICO_HOTNET"
PRODUTO = "App Técnico HOTNET"
ATUALIZAR = "sudo bash /opt/hotnet-tecnico/deploy/install.sh"

# Versões cujo commit da tag não resume a versão.
TITULOS = {
    "1.0.0": "Primeira versão estável",
    "1.4.0": "Sessão do Controllr pelo cookie do login e detecção de sessão encerrada",
    "1.5.0": "Motivo e data/hora da última queda da ONU",
}

SECOES = {
    "Adicionado": "✨ Novidades",
    "Alterado": "🔧 Mudanças",
    "Corrigido": "🐞 Correções",
    "Removido": "🗑️ Removido",
    "Revertido": "↩️ Revertido",
    "Obsoleto": "⚠️ Obsoleto",
    "Segurança": "🔒 Segurança",
}

# O que mais o técnico precisa saber ao atualizar para a versão.
EXTRA_ATUALIZAR = {
    "1.0.0": "Primeira instalação: clone o repositório e rode `sudo bash deploy/install.sh`.",
}

# Depois de atualizar o servidor, o PWA instalado no celular pode seguir na versão em cache.
DEPOIS = "Depois, feche e abra o app no celular (ou recarregue a página) para sair da versão em cache."


def versoes(changelog: str) -> list[tuple[str, str, str]]:
    """[(versão, data, corpo)] na ordem do arquivo (mais nova primeiro)."""
    partes = re.split(r"^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})\n", changelog, flags=re.M)
    out = []
    for i in range(1, len(partes), 3):
        corpo = re.split(r"^(?:## |\[)", partes[i + 2], maxsplit=1, flags=re.M)[0]
        out.append((partes[i], partes[i + 1], corpo.strip()))
    return out


def desquebrar(texto: str) -> str:
    """Junta as linhas de continuação de cada item/parágrafo numa linha só."""
    linhas: list[str] = []
    for bruta in texto.splitlines():
        linha = bruta.rstrip()
        if not linha:
            linhas.append("")
        elif linha.startswith(("- ", "* ", "### ")) or not linhas or not linhas[-1]:
            linhas.append(linha)
        else:
            linhas[-1] += " " + linha.strip()
    return "\n".join(linhas)


def assunto(versao: str) -> str:
    if versao in TITULOS:
        return TITULOS[versao]
    try:
        s = subprocess.run(["git", "log", "-1", "--format=%s", f"v{versao}"], cwd=RAIZ,
                           capture_output=True, text=True, encoding="utf-8", check=True).stdout
    except (subprocess.CalledProcessError, FileNotFoundError):
        return ""
    s = s.strip().lstrip("﻿")
    s = re.sub(r"^Versão \S+:\s*", "", s)
    return s[:1].upper() + s[1:]


def nota(versao: str, data: str, corpo: str, anterior: str | None) -> tuple[str, str]:
    corpo = desquebrar(corpo)
    corpo = re.sub(r"^### (.+)$", lambda m: f"### {SECOES.get(m[1].strip(), m[1].strip())}", corpo, flags=re.M)
    d = date.fromisoformat(data).strftime("%d/%m/%Y")
    partes = [f"**{PRODUTO}** · versão {versao} · {d}", "", corpo, "", "### 🚀 Como atualizar",
              "", "```bash", ATUALIZAR, "```"]
    partes += ["", DEPOIS]
    if versao in EXTRA_ATUALIZAR:
        partes += ["", EXTRA_ATUALIZAR[versao]]
    partes += ["", "---", ""]
    if anterior:
        partes.append(f"[Comparar com a {anterior}]({REPO}/compare/v{anterior}...v{versao}) · "
                      f"[Histórico completo]({REPO}/blob/main/CHANGELOG.md)")
    else:
        partes.append(f"[Histórico completo]({REPO}/blob/main/CHANGELOG.md)")
    titulo = f"v{versao}" + (f" · {a}" if (a := assunto(versao)) else "")
    return titulo, "\n".join(partes).strip() + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("versao", nargs="?", help="ex.: 1.6.7")
    ap.add_argument("--todas", action="store_true")
    ap.add_argument("--aplicar", action="store_true", help="grava título e nota na release do GitHub")
    args = ap.parse_args()
    if not args.versao and not args.todas:
        ap.error("informe a versão ou --todas")

    lista = versoes((RAIZ / "CHANGELOG.md").read_text(encoding="utf-8"))
    anteriores = {v: (lista[i + 1][0] if i + 1 < len(lista) else None) for i, (v, _, _) in enumerate(lista)}
    alvo = lista if args.todas else [x for x in lista if x[0] == args.versao]
    if not alvo:
        print(f"versão {args.versao} não está no CHANGELOG.md", file=sys.stderr)
        return 1

    for v, d, corpo in alvo:
        titulo, texto = nota(v, d, corpo, anteriores[v])
        if not args.aplicar:
            print(f"# {titulo}\n\n{texto}")
            continue
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".md", delete=False) as f:
            f.write(texto)
        r = subprocess.run(["gh", "release", "edit", f"v{v}", "--title", titulo, "--notes-file", f.name],
                           cwd=RAIZ, capture_output=True, text=True, encoding="utf-8")
        Path(f.name).unlink(missing_ok=True)
        print(f"v{v}: {'ok' if r.returncode == 0 else 'ERRO ' + r.stderr.strip()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
