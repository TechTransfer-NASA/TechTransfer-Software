const MAX_PER_PAGE = 10;

const CAMPOS =
  "id,iniciada_em,finalizada_em,status,registros_processados,registros_novos,registros_inativados,lotes,erros,mensagem,detalhes";

const STATUS = {
  concluido: { label: "Concluído", icon: "\u2714", css: "status_concluido" },
  erro_parcial: {
    label: "Erro parcial",
    icon: "!",
    css: "status_erro_parcial",
  },
  erro_critico: {
    label: "Erro crítico",
    icon: "\u2716",
    css: "status_erro_critico",
  },
};

const state = {
  loaded: 0,
  total: null,
  versao: 0,
  last: null,
  active: null,
};

async function get_supabase(table, params, extra = {}) {
  const headers = { apikey: SUPABASE_KEY, ...extra };

  if (SUPABASE_KEY.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${SUPABASE_KEY}`;
  }

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));

    console.error("Erro Supabase:", err);

    throw new Error(`HTTP ${resp.status}: ${err.message || resp.statusText}`);
  }

  return resp;
}

function read_total(resp) {
  const m = /\/(\d+)$/.exec(resp.headers.get("Content-Range") || "");

  return m ? Number(m[1]) : null;
}

async function get_active_count() {
  const params = new URLSearchParams({
    select: "codigo",
    ativo: "eq.true",
    limit: 1,
  });

  const resp = await get_supabase("softwares", params, {
    Prefer: "count=exact",
  });

  return read_total(resp);
}

function get_status(value) {
  return (
    STATUS[value] || {
      label: String(value),
      icon: "?",
      css: "status_desconhecido",
    }
  );
}

function status_html(value) {
  const st = get_status(value);

  return `<span class="status ${st.css}"><span aria-hidden="true">${st.icon}</span> ${escape_html(st.label)}</span>`;
}

function format_date(iso) {
  const date = new Date(iso);

  if (isNaN(date)) return "-";

  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function relative_time(iso) {
  const seconds = Math.round((new Date(iso) - Date.now()) / 1000);

  if (isNaN(seconds)) return "";

  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

  for (const [unit, size] of [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ]) {
    if (Math.abs(seconds) >= size) {
      return rtf.format(Math.round(seconds / size), unit);
    }
  }

  return "agora há pouco";
}

function format_duration(start, end) {
  const seconds = Math.round((new Date(end) - new Date(start)) / 1000);

  if (isNaN(seconds) || seconds < 0) return "-";

  return seconds >= 60
    ? `${Math.floor(seconds / 60)} min ${seconds % 60} s`
    : `${seconds} s`;
}

function terms_html(detalhes) {
  const termos =
    detalhes && Array.isArray(detalhes.termos) ? detalhes.termos : [];

  if (termos.length === 0) {
    return '<p class="run_nota">Sem detalhes por termo nesta execução.</p>';
  }

  const received = termos.reduce((sum, t) => sum + (t.recebidos || 0), 0);

  const rows = termos
    .map((t) => {
      const notes = [];

      if (t.erro) notes.push(`Falhou: ${t.erro}`);

      if (t.truncada) {
        notes.push(`Resposta cortada (total ${format_number(t.total)})`);
      }

      if (t.linhas_invalidas) {
        notes.push(`${format_number(t.linhas_invalidas)} linha(s) inválida(s)`);
      }

      return `
        <tr class="${notes.length ? "termo_problema" : ""}">
          <td>${escape_html(t.termo)}</td>
          <td>${format_number(t.recebidos || 0)}</td>
          <td>${format_number(t.novos || 0)}</td>
          <td>${escape_html(notes.join("; "))}</td>
        </tr>`;
    })
    .join("");

  const source = detalhes.fonte
    ? ` Fonte: ${escape_html(detalhes.fonte)}.`
    : "";

  return `
    <p class="run_nota">
      ${format_number(received)} linhas recebidas da NASA em ${format_number(termos.length)} termos.${source}
      "Novos" conta só os softwares ainda não vistos nesta execução: o mesmo software aparece em várias buscas e é deduplicado pelo código.
    </p>
    <div class="termos_wrap">
      <table class="termos">
        <thead>
          <tr><th>Termo</th><th>Recebidos</th><th>Novos</th><th>Observação</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function run_html(r) {
  const numbers = [
    ["registros_processados", "processados"],
    ["registros_novos", "novos"],
    ["registros_inativados", "inativados"],
    ["lotes", "lotes"],
    ["erros", "erros"],
  ]
    .map(([campo, rotulo]) => {
      const problem = campo === "erros" && r.erros > 0 ? " numero_erro" : "";

      return `<span class="numero${problem}"><b>${format_number(r[campo] ?? 0)}</b> ${rotulo}</span>`;
    })
    .join("");

  return `
    <details class="run">
      <summary>
        ${status_html(r.status)}
        <span class="run_data">
          ${escape_html(format_date(r.finalizada_em))}
          <small>(${escape_html(relative_time(r.finalizada_em))})</small>
        </span>
        <span class="run_duracao">${escape_html(format_duration(r.iniciada_em, r.finalizada_em))}</span>
        <span class="run_numeros">${numbers}</span>
      </summary>

      <div class="run_corpo">
        ${r.mensagem ? `<p class="run_msg">${escape_html(r.mensagem)}</p>` : ""}
        ${terms_html(r.detalhes)}
      </div>
    </details>`;
}

function render_summary() {
  const last = state.last;

  if (!last) {
    document.getElementById("summary").innerHTML = "";
    return;
  }

  const active = state.active === null ? "-" : format_number(state.active);
  const total = state.total === null ? "-" : format_number(state.total);

  document.getElementById("summary").innerHTML = `
    <div class="resumo_card">
      <p class="resumo_label">Última atualização</p>
      <p class="resumo_valor">${escape_html(format_date(last.finalizada_em))}</p>
      <p class="resumo_sub">${status_html(last.status)} ${escape_html(relative_time(last.finalizada_em))}</p>
    </div>
    <div class="resumo_card">
      <p class="resumo_label">Softwares ativos</p>
      <p class="resumo_valor">${active}</p>
      <p class="resumo_sub">no banco (Supabase)</p>
    </div>
    <div class="resumo_card">
      <p class="resumo_label">Execuções registradas</p>
      <p class="resumo_valor">${total}</p>
      <p class="resumo_sub">coleta semanal e execuções manuais</p>
    </div>`;
}

function render_alert() {
  const last = state.last;

  if (!last || last.status === "concluido") {
    document.getElementById("alert").innerHTML = "";
    return;
  }

  document.getElementById("alert").innerHTML = `
    <div class="state state-erro">
      A última execução terminou com ${status_html(last.status)}
      ${last.mensagem ? ` ${escape_html(last.mensagem)}` : ""}
    </div>`;
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
    '<button type="button" data-acao="tentar">Tentar novamente</button>';
}

function update_screen(recebidos) {
  const { loaded, total } = state;

  if (loaded === 0) {
    show_state("Nenhuma execução registrada ainda.", "vazio");
    document.getElementById("more").hidden = true;

    return;
  }

  show_state("", "");

  document.getElementById("more").hidden =
    total === null ? recebidos < MAX_PER_PAGE : loaded >= total;
}

async function load(reboot = false) {
  const version = ++state.versao;

  if (reboot) {
    state.loaded = 0;
    state.total = null;
    document.getElementById("runs").innerHTML = "";
  }

  document.getElementById("more").hidden = true;

  show_state("Carregando...", "carregando");

  try {
    const params = new URLSearchParams({
      select: CAMPOS,
      order: "finalizada_em.desc",
      limit: MAX_PER_PAGE,
      offset: state.loaded,
    });

    const resp = await get_supabase("execucoes", params, {
      Prefer: "count=exact",
    });

    const rows = await resp.json();

    if (version !== state.versao) return;

    state.total = read_total(resp);

    if (reboot) {
      state.last = rows[0] || null;
      render_alert();
    }

    document
      .getElementById("runs")
      .insertAdjacentHTML("beforeend", rows.map(run_html).join(""));

    state.loaded += rows.length;

    render_summary();
    update_screen(rows.length);
  } catch (erro) {
    console.error("Erro ao carregar execuções:", erro);

    if (version === state.versao) {
      show_error();
    }
  }
}

function start() {
  if (
    typeof SUPABASE_URL === "undefined" ||
    typeof SUPABASE_KEY === "undefined"
  ) {
    show_state("Supabase não configurado", "erro");
    return;
  }

  document.getElementById("more").addEventListener("click", () => load(false));

  document.getElementById("state").addEventListener("click", (e) => {
    if (e.target.dataset.acao === "tentar") {
      load(true);
    }
  });

  load(true);

  get_active_count()
    .then((count) => {
      state.active = count;
      render_summary();
    })
    .catch((erro) => console.error("Erro ao contar softwares:", erro));
}

document.addEventListener("DOMContentLoaded", start);
