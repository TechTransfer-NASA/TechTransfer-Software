// URL de tradução para a descrição de cada software
// https://api.mymemory.translated.net/get?q=${encodeURIComponent(texto)}&langpair=en|pt-BR

const MAX_PER_PAGE = 10;

const CAMPOS =
  "codigo,titulo,descricao,categoria,centro,centro_nome,licenca,urls,url_detalhe";

const state = {
  loaded: 0,
  total: null,
  versao: 0,
};

async function get_softwares(params, extra = {}) {
  const url = `${SUPABASE_URL}/rest/v1/softwares?${params}`;

  const resp = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      ...extra,
    },
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));

    console.error("Erro Supabase:", err);

    throw new Error(`HTTP ${resp.status}: ${err.message || resp.statusText}`);
  }

  return resp;
}

function read_filters() {
  return {
    search: document
      .getElementById("search")
      .value.replace(/[(),*%\\]/g, " ")
      .trim(),

    category: document.getElementById("category_filter").value,
    center: document.getElementById("center_filter").value,
    license: document.getElementById("license_filter").value,
  };
}

function set_params(offset) {
  const p = new URLSearchParams({
    select: CAMPOS,
    ativo: "eq.true",
    order: "titulo.asc.nullslast,codigo.asc",
    limit: MAX_PER_PAGE,
    offset,
  });

  const f = read_filters();

  if (f.category) {
    p.set("categoria", `eq.${f.category}`);
  }

  if (f.center) {
    p.set("centro", `eq.${f.center}`);
  }

  if (f.license) {
    p.set("licenca", `eq.${f.license}`);
  }

  if (f.search.length >= 2) {
    if (/\d/.test(f.search) && /^[\w-]+$/.test(f.search)) {
      p.set("codigo", `ilike.*${f.search}*`);
    } else {
      p.set("busca", `wfts(english).${f.search}`);
    }
  }

  return p;
}

function cardHtml(s) {
  const titulo = s.titulo || s.codigo;

  const detalhe = escape_html(secure_link(s.url_detalhe));

  const repo = (s.urls || []).map(secure_link).find((u) => u !== "#");

  const etiquetas = [
    ["categoria", s.categoria],
    ["centro", s.centro],
    ["licenca", s.licenca],
  ]
    .filter(([, valor]) => valor)
    .map(
      ([tipo, valor]) =>
        `<span class="etiqueta etiqueta-${tipo}">${escape_html(valor)}</span>`,
    )
    .join("");

  const linkRepo = repo
    ? `<a class="card_repo" href="${escape_html(repo)}" target="_blank">${escape_html(new URL(repo).hostname)}</a>`
    : "";

  return `
    <section class="card">
      <h3 class="card_titulo">
        <p href="${detalhe}" target="_blank">
          ${escape_html(titulo)}
        </p>
      </h3>

      <p class="card_codigo">
        ${escape_html(s.codigo)}
      </p>

      <p class="card_desc">
        ${escape_html(s.descricao || "Sem descrição disponível.")}
      </p>
      
      <button type="button" class="card_mais" data-acao="alternar" aria-expanded="false" hidden>Ler mais</button>

      <div class="card_footer">
        ${etiquetas}
      </div>

      ${linkRepo}
    </section>
  `;
}

function show_read_more() {
  document
    .querySelectorAll(".card_desc:not(.card_desc_aberta)")
    .forEach((desc) => {
      desc.nextElementSibling.hidden =
        desc.scrollHeight <= desc.clientHeight + 1;
    });
}

function show_state(texto, tipo) {
  const caixa = document.getElementById("state");

  caixa.textContent = texto;
  caixa.className = texto ? `state state-${tipo}` : "";
}

function show_error() {
  const caixa = document.getElementById("state");

  caixa.className = "state state-erro";

  caixa.innerHTML =
    "Não foi possível carregar os dados. Verifique a conexão e tente de novo. " +
    '<button type="button">Tentar novamente</button>';

  document.getElementById("resumo").textContent = "";
}

function update_screen(recebidos) {
  const { loaded, total } = state;

  if (loaded === 0) {
    show_state(
      "Nenhum software encontrado. Tente outros filtros ou outra busca.",
      "vazio",
    );

    document.getElementById("resumo").textContent = "0 resultados";
    document.getElementById("more").hidden = true;

    return;
  }

  show_state("", "");

  document.getElementById("resumo").textContent =
    total === null
      ? `Mostrando ${format_number(loaded)}`
      : `Mostrando ${format_number(loaded)} de ${format_number(total)}`;

  document.getElementById("more").hidden =
    total === null ? recebidos < MAX_PER_PAGE : loaded >= total;
}

async function load(reboot = false) {
  const version = ++state.versao;

  if (reboot) {
    state.loaded = 0;
    state.total = null;
    document.getElementById("cards").innerHTML = "";
  }

  document.getElementById("more").hidden = true;

  show_state("Carregando...", "carregando");

  try {
    const resp = await get_softwares(set_params(state.loaded), {
      Prefer: "count=exact",
    });

    const linhas = await resp.json();

    if (version !== state.versao) return;

    const contentRange = resp.headers.get("Content-Range") || "";

    const m = /\/(\d+)$/.exec(contentRange);

    state.total = m ? Number(m[1]) : null;

    document
      .getElementById("cards")
      .insertAdjacentHTML("beforeend", linhas.map(cardHtml).join(""));

    show_read_more();

    state.loaded += linhas.length;

    update_screen(linhas.length);
  } catch (erro) {
    console.error("Erro ao carregar softwares:", erro);

    if (version === state.versao) {
      show_error();
    }
  }
}

function fill_select(id, mapa, rotuloTodos) {
  const opcoes = [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1]));

  document.getElementById(id).innerHTML =
    `<option value="">${escape_html(rotuloTodos)}</option>` +
    opcoes
      .map(
        ([valor, rotulo]) =>
          `<option value="${escape_html(valor)}">${escape_html(rotulo)}</option>`,
      )
      .join("");
}

async function fill_filters() {
  const cat = new Map();
  const cen = new Map();
  const lic = new Map();

  for (let offset = 0; ; offset += 1000) {
    const p = new URLSearchParams({
      select: "categoria,centro,centro_nome,licenca",
      ativo: "eq.true",
      order: "id.asc",
      limit: 1000,
      offset,
    });

    const resp = await get_softwares(p);
    const linhas = await resp.json();

    for (const l of linhas) {
      if (l.categoria) {
        cat.set(l.categoria, l.categoria);
      }

      if (l.centro) {
        cen.set(
          l.centro,
          l.centro_nome ? `${l.centro} - ${l.centro_nome}` : l.centro,
        );
      }

      if (l.licenca) {
        lic.set(l.licenca, l.licenca);
      }
    }

    if (linhas.length < 1000) break;
  }

  fill_select("category_filter", cat, "Todas as categorias");
  fill_select("center_filter", cen, "Todos os centros");
  fill_select("license_filter", lic, "Todas as licenças");
}

function wait(func, ms) {
  let t;

  return (...args) => {
    clearTimeout(t);

    t = setTimeout(() => {
      func(...args);
    }, ms);
  };
}

async function start() {
  if (
    typeof SUPABASE_URL === "undefined" ||
    typeof SUPABASE_KEY === "undefined"
  ) {
    show_state("Supabase não configurado", "erro");
    return;
  }

  const reload = () => load(true);

  document
    .getElementById("search")
    .addEventListener("input", wait(reload, 350));

  ["category_filter", "center_filter", "license_filter"].forEach((id) => {
    document.getElementById(id).addEventListener("change", reload);
  });

  document.getElementById("cards").addEventListener("click", (e) => {
    const button = e.target.closest("[data-acao='alternar']");

    if (!button) return;

    const open =
      button.previousElementSibling.classList.toggle("card_desc_aberta");

    button.textContent = open ? "Ler menos" : "Ler mais";
    button.setAttribute("aria-expanded", open);
  });

  window.addEventListener("resize", wait(show_read_more, 200));

  document.getElementById("clear").addEventListener("click", () => {
    document.getElementById("search").value = "";

    ["category_filter", "center_filter", "license_filter"].forEach((id) => {
      document.getElementById(id).value = "";
    });

    load(true);
  });

  document.getElementById("more").addEventListener("click", () => load(false));

  document.getElementById("state").addEventListener("click", (e) => {
    if (e.target.dataset.acao === "tentar") {
      load(true);
    }
  });

  try {
    await fill_filters();
    await load(true);
  } catch (erro) {
    console.error("Erro ao inicializar catálogo:", erro);
    show_error();
  }
}

document.addEventListener("DOMContentLoaded", start);
