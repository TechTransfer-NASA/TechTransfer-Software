"""
Coleta os softwares do catálogo da NASA (TechTransfer) e grava no Supabase.

Passo a passo:
  1. Busca cada termo da lista na API da NASA (a API não tem paginação).
  2. Limpa os dados: tira o HTML, padroniza o centro e a categoria.
  3. Tira os repetidos pelo código, porque o mesmo software aparece em várias buscas.
  4. Envia para o Supabase em lotes (upsert) e registra a execução na tabela `execucoes`.

Se algo der errado o script termina com erro (exit 1), e isso aparece no GitHub Actions.

Variáveis de ambiente:
  SUPABASE_URL, SUPABASE_SERVICE_KEY  secrets do GitHub (obrigatórias)
  NASA_API_KEY                        secret; só é usada se NASA_API_BASE for o api.nasa.gov
  NASA_API_BASE                       variável do GitHub (opcional)

Para testar no computador, sem gravar nada no banco:
  python scripts/fetch_softwares.py --dry-run
"""
import argparse
import html
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

import requests

# configurações
URL_PADRAO = "https://technology.nasa.gov/api/api/software"

# o código de cada software começa com a sigla de um centro (GSC-, ARC-, NPO-...) e a
# busca encontra esse prefixo. As palavras comuns no fim são uma rede de segurança
TERMOS = [
    "arc", "lar", "lew", "gsc", "msc", "mfs", "npo", "ksc", "drc", "ssc",
    "hdqs", "faa", "so", "tops",
    "system", "data", "space", "software", "method", "material", "control",
    "sensor", "design", "analysis", "tool", "model", "code", "framework",
    "and", "the", "a", "e",
]

PAUSA_S = 1.0               # espera entre uma chamada e outra, para não sobrecarregar a NASA
TAMANHO_LOTE = 200          # quantos softwares enviamos ao banco por vez
DIAS_PARA_INATIVAR = 21     # software não visto há tanto tempo vira "inativo"
COLUNAS_API = 13            # cada linha da API é uma lista com 13 posições

CENTROS = {
    "ARC": "Ames Research Center",
    "DFRC": "Armstrong Flight Research Center",
    "GRC": "Glenn Research Center",
    "GSFC": "Goddard Space Flight Center",
    "HDQS": "NASA Headquarters",
    "JPL": "Jet Propulsion Laboratory",
    "JSC": "Johnson Space Center",
    "KSC": "Kennedy Space Center",
    "LARC": "Langley Research Center",
    "MSFC": "Marshall Space Flight Center",
    "SSC": "Stennis Space Center",
    "FAA": "Federal Aviation Administration",
}

# a API devolve a categoria em minúsculas; aqui está o nome usado no site software.nasa.gov
CATEGORIAS = {
    "aeronautics": "Aeronautics",
    "autonomous systems": "Autonomous Systems",
    "business systems and project management": "Business Systems and Project Management",
    "crew and life support": "Crew and Life Support",
    "data and image processing": "Data and Image Processing",
    "data servers processing and handling": "Data Servers Processing and Handling",
    "design and integration tools": "Design and Integration Tools",
    "electronics and electrical power": "Electronics and Electrical Power",
    "environmental science earth air space exoplanet": "Environmental Science",
    "materials and processes": "Materials and Processes",
    "operations": "Operations",
    "propulsion": "Propulsion",
    "structures and mechanisms": "Structures and Mechanisms",
    "system testing": "System Testing",
    "vehicle management space air ground": "Vehicle Management",
}

# padrões para limpar os textos
DESTAQUE_BUSCA = re.compile(r"</?span[^>]*>")       # <span class="highlight"> que a API coloca
TAG_HTML = re.compile(r"</?[a-zA-Z][^>]*>")
LINK = re.compile(r"https?://[^\s,;]+")

def log(mensagem):
    print(mensagem, flush=True)

def esconder_segredos(texto):
    """Troca as chaves por *** para que elas nunca apareçam em logs nem no banco."""
    texto = str(texto)
    for nome in ("NASA_API_KEY", "SUPABASE_SERVICE_KEY"):
        segredo = os.getenv(nome)
        if segredo:
            texto = texto.replace(segredo, "***")
    return texto

# limpeza dos dados
def limpar_texto(valor, separar_paragrafos=False):
    """Tira HTML, converte entidades (&amp; vira &) e devolve None se o texto ficar vazio."""
    if valor is None:
        return None
    texto = str(valor)
    if separar_paragrafos:
        texto = re.sub(r"(?i)</p\s*>|<br\s*/?>", "\n\n", texto)
    texto = TAG_HTML.sub("", texto)
    texto = html.unescape(texto)
    texto = re.sub(r"[ \t\r\f\v]+", " ", texto)      # espaços repetidos viram um só
    texto = re.sub(r" ?\n ?", "\n", texto)
    texto = re.sub(r"\n{3,}", "\n\n", texto)
    return texto.strip() or None

def normalizar_linha(linha):
    """
    Transforma uma linha da API (lista de 13 posições) em um dicionário.
    Posições usadas: 0 id, 1 código, 2 título, 3 descrição, 5 categoria,
    6 licença, 7 notas de acesso, 8 links, 9 centro, 12 score da busca.
    Levanta ValueError se a linha não tiver o formato esperado.
    """
    if not isinstance(linha, list) or len(linha) != COLUNAS_API:
        tamanho = len(linha) if isinstance(linha, list) else type(linha).__name__
        raise ValueError(f"linha com formato inesperado ({tamanho})")
    if not isinstance(linha[0], str) or not isinstance(linha[1], str) or not linha[1].strip():
        raise ValueError("id ou código inválido")
    if isinstance(linha[12], bool) or not isinstance(linha[12], (int, float)):
        raise ValueError("score (posição 12) não é número")

    categoria_da_api = limpar_texto(linha[5])
    categoria = CATEGORIAS.get((categoria_da_api or "").lower(), categoria_da_api)

    centro = (limpar_texto(linha[9]) or "").upper() or None      # "LaRC" vira "LARC"
    links = list(dict.fromkeys(LINK.findall(str(linha[8] or ""))))  # sem repetidos, mesma ordem

    # Guardamos a linha original, mas sem o destaque de busca e sem o score
    original = [DESTAQUE_BUSCA.sub("", c) if isinstance(c, str) else c for c in linha]
    original[12] = None

    return {
        "codigo": linha[1].strip(),
        "id_nasa": linha[0],
        "titulo": limpar_texto(linha[2]),
        "descricao": limpar_texto(linha[3], separar_paragrafos=True),
        "categoria": categoria,
        "centro": centro,
        "centro_nome": CENTROS.get(centro),
        "licenca": limpar_texto(linha[6]),
        "notas_acesso": limpar_texto(linha[7], separar_paragrafos=True),
        "urls": links,
        "raw": original,
    }

# API da NASA
def montar_url(base, termo, chave):
    termo = quote(termo, safe="")
    base = base.rstrip("/")
    if "api.nasa.gov" in base:                       # formato do api.nasa.gov: /?termo&api_key=...
        return f"{base}/?{termo}&api_key={chave or 'DEMO_KEY'}"
    return f"{base}/{termo}"                         # formato direto: /software/termo

def baixar_termo(sessao, base, termo, chave, tentativas=3):
    """Faz a chamada à NASA. Se falhar, espera um pouco e tenta de novo."""
    ultimo_erro = None
    for tentativa in range(1, tentativas + 1):
        try:
            resposta = sessao.get(montar_url(base, termo, chave), timeout=(10, 120))
            resposta.raise_for_status()
            dados = resposta.json()
            if not isinstance(dados, dict) or not isinstance(dados.get("results"), list):
                raise ValueError("a resposta não tem a lista 'results'")
            return dados
        except Exception as erro:
            ultimo_erro = erro
            time.sleep(2 * tentativa)
    raise RuntimeError(esconder_segredos(ultimo_erro))

def coletar(sessao, base, termos, chave_nasa):
    """Busca todos os termos. Devolve (softwares sem repetição, relatório por termo, linhas recebidas)."""
    softwares = {}          # código -> software; usar o código como chave elimina os repetidos
    relatorio = []
    linhas_recebidas = 0

    for termo in termos:
        resultado = {"termo": termo}
        try:
            dados = baixar_termo(sessao, base, termo, chave_nasa)
        except Exception as erro:
            resultado["erro"] = str(erro)[:200]
            relatorio.append(resultado)
            log(f"[ERRO] {termo}: {resultado['erro']}")
            time.sleep(PAUSA_S)
            continue

        linhas = dados["results"]
        total = dados.get("total")
        novos = invalidas = 0
        for linha in linhas:
            linhas_recebidas += 1
            try:
                software = normalizar_linha(linha)
            except ValueError:
                invalidas += 1
                continue
            if software["codigo"] not in softwares:
                softwares[software["codigo"]] = software
                novos += 1

        resultado.update(recebidos=len(linhas), total=total, novos=novos)
        if invalidas:
            resultado["linhas_invalidas"] = invalidas
        if isinstance(total, int) and total > len(linhas):
            resultado["truncada"] = True    # a NASA corta em 1000 resultados: falta coisa
        relatorio.append(resultado)
        log(f"[ok] {termo:12} recebidos={len(linhas):4} novos={novos:4} total={len(softwares)}")
        time.sleep(PAUSA_S)

    return softwares, relatorio, linhas_recebidas

def contar_problemas(relatorio):
    falhas = sum(1 for r in relatorio if "erro" in r)
    truncadas = sum(1 for r in relatorio if r.get("truncada"))
    invalidas = sum(r.get("linhas_invalidas", 0) for r in relatorio)
    return falhas, truncadas, invalidas

# Supabase
def sessao_supabase(chave):
    sessao = requests.Session()
    sessao.headers.update({"apikey": chave, "Content-Type": "application/json"})
    if chave.startswith("eyJ"):     # chave antiga (JWT) também vai no Authorization
        sessao.headers["Authorization"] = f"Bearer {chave}"
    return sessao

def codigos_no_banco(db, url):
    """Lista os códigos que já estão na tabela (de 1000 em 1000, limite do Supabase)."""
    codigos, inicio = set(), 0
    while True:
        resposta = db.get(f"{url}/rest/v1/softwares", timeout=60,
                          params={"select": "codigo", "order": "id", "limit": 1000, "offset": inicio})
        resposta.raise_for_status()
        pagina = resposta.json()
        codigos.update(item["codigo"] for item in pagina)
        if len(pagina) < 1000:
            return codigos
        inicio += 1000

def enviar_em_lotes(db, url, softwares, agora):
    """Upsert em lotes. Devolve (quantidade de lotes, quantidade de lotes que falharam)."""
    # Todos os itens precisam ter as mesmas chaves para o envio em lote funcionar
    registros = [dict(s, ativo=True, ultima_vez_visto=agora) for s in softwares]
    lotes = falhas = 0

    for inicio in range(0, len(registros), TAMANHO_LOTE):
        lote = registros[inicio:inicio + TAMANHO_LOTE]
        lotes += 1
        deu_certo = False
        for _ in range(2):      # uma segunda tentativa se for falha temporária
            try:
                resposta = db.post(
                    f"{url}/rest/v1/softwares", params={"on_conflict": "codigo"},
                    data=json.dumps(lote), timeout=120,
                    headers={"Prefer": "resolution=merge-duplicates,return=minimal"})
                if resposta.status_code < 300:
                    deu_certo = True
                    break
                log(f"[ERRO] lote {lotes}: HTTP {resposta.status_code} "
                    f"{esconder_segredos(resposta.text[:300])}")
                if resposta.status_code < 500:      # erro nosso (permissão, formato): repetir não ajuda
                    break
            except Exception as erro:
                log(f"[ERRO] lote {lotes}: {esconder_segredos(erro)}")
            time.sleep(3)
        if not deu_certo:
            falhas += 1

    return lotes, falhas

def inativar_antigos(db, url, limite):
    """Marca como inativo o que não foi visto desde a data limite. Devolve quantos foram."""
    resposta = db.patch(
        f"{url}/rest/v1/softwares", data=json.dumps({"ativo": False}), timeout=60,
        params={"ativo": "eq.true", "ultima_vez_visto": f"lt.{limite}", "select": "codigo"},
        headers={"Prefer": "return=representation"})
    resposta.raise_for_status()
    return len(resposta.json())

def registrar_execucao(db, url, execucao):
    try:
        resposta = db.post(f"{url}/rest/v1/execucoes", data=json.dumps(execucao), timeout=30,
                           headers={"Prefer": "return=minimal"})
        if resposta.status_code >= 300:
            log(f"[ERRO] não consegui gravar em execucoes: HTTP {resposta.status_code} {resposta.text[:200]}")
    except Exception as erro:
        log(f"[ERRO] não consegui gravar em execucoes: {esconder_segredos(erro)}")

# programa principal
def main(argv=None):
    parser = argparse.ArgumentParser(description="Coleta softwares da NASA e grava no Supabase")
    parser.add_argument("--dry-run", action="store_true", help="só consulta a NASA, não grava no banco")
    parser.add_argument("--terms", help="termos separados por vírgula (padrão: lista do script)")
    args = parser.parse_args(argv)

    inicio = datetime.now(timezone.utc)
    base_nasa = os.getenv("NASA_API_BASE") or URL_PADRAO
    chave_nasa = os.getenv("NASA_API_KEY") or ""
    supabase_url = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    supabase_chave = os.getenv("SUPABASE_SERVICE_KEY") or ""
    termos = [t.strip().lower() for t in args.terms.split(",")] if args.terms else TERMOS

    if not args.dry_run and not (supabase_url and supabase_chave):
        log("[ERRO CRÍTICO] defina SUPABASE_URL e SUPABASE_SERVICE_KEY (Secrets do GitHub).")
        return 1

    nasa = requests.Session()
    nasa.headers["User-Agent"] = "nasa-techtransfer-pipeline/1.0 (trabalho academico)"
    db = None if args.dry_run else sessao_supabase(supabase_chave)

    status, mensagem = "erro_critico", None
    softwares, relatorio = {}, []
    lotes = erros = novos = inativados = 0

    try:
        log(f"Coletando {len(termos)} termos ({base_nasa.split('//')[-1].split('/')[0]})...")
        softwares, relatorio, linhas_recebidas = coletar(nasa, base_nasa, termos, chave_nasa)

        falhas, truncadas, invalidas = contar_problemas(relatorio)
        erros = falhas + truncadas + invalidas
        log(f"Softwares únicos: {len(softwares)} (de {linhas_recebidas} linhas) | "
            f"falhas={falhas} truncadas={truncadas} linhas_invalidas={invalidas}")

        # decide o status da coleta antes de gravar
        if not softwares or falhas > len(termos) / 2:
            status, mensagem = "erro_critico", "a coleta falhou: poucos termos responderam"
        elif erros == 0:
            status = "concluido"
        else:
            status = "erro_parcial"
            mensagem = (f"{falhas} chamada(s) com falha, {truncadas} resposta(s) truncada(s), "
                        f"{invalidas} linha(s) inválida(s)")

        if args.dry_run:
            for software in list(softwares.values())[:3]:
                resumo = {k: v for k, v in software.items() if k != "raw"}
                log(json.dumps(resumo, ensure_ascii=False)[:300])
            log(f"[dry-run] status previsto: {status}")
            return 0 if status == "concluido" else 1

        if status != "erro_critico":
            ja_no_banco = codigos_no_banco(db, supabase_url)
            if ja_no_banco and len(softwares) < 0.5 * len(ja_no_banco):
                status = "erro_critico"
                mensagem = (f"a coleta trouxe {len(softwares)} softwares e o banco tem "
                            f"{len(ja_no_banco)}: gravação cancelada por segurança")
            else:
                novos = len(set(softwares) - ja_no_banco)
                lotes, lotes_com_falha = enviar_em_lotes(
                    db, supabase_url, list(softwares.values()), inicio.isoformat())
                erros += lotes_com_falha
                if lotes_com_falha:
                    status = "erro_parcial" if lotes_com_falha < lotes else "erro_critico"
                    mensagem = (mensagem + "; " if mensagem else "") + f"{lotes_com_falha} lote(s) falharam"
                if status == "concluido":
                    limite = (inicio - timedelta(days=DIAS_PARA_INATIVAR)).isoformat()
                    inativados = inativar_antigos(db, supabase_url, limite)

    except Exception as erro:
        status = "erro_critico"
        mensagem = esconder_segredos(f"{type(erro).__name__}: {erro}")[:500]
        erros += 1
        log(f"[ERRO CRÍTICO] {mensagem}")

    execucao = {
        "iniciada_em": inicio.isoformat(),
        "finalizada_em": datetime.now(timezone.utc).isoformat(),
        "status": status,
        "registros_processados": len(softwares) if status != "erro_critico" else 0,
        "registros_novos": novos,
        "registros_inativados": inativados,
        "lotes": lotes,
        "erros": erros,
        "termos_executados": len(termos),
        "mensagem": mensagem,
        "detalhes": {"fonte": base_nasa.split("//")[-1].split("/")[0], "termos": relatorio},
    }
    if db is not None:
        registrar_execucao(db, supabase_url, execucao)
    log(f"Execução: {status} | softwares={execucao['registros_processados']} novos={novos} "
        f"lotes={lotes} erros={erros} inativados={inativados}")
    return 0 if status == "concluido" else 1

if __name__ == "__main__":
    sys.exit(main())