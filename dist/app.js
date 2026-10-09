const app = document.querySelector("#app");
const STORAGE_KEY = "voto-informado-29n.v1";
const SCALE_CHOICES = [
  { id: "very-agree", label: "Muy de acuerdo" },
  { id: "agree", label: "De acuerdo" },
  { id: "neutral", label: "Ni de acuerdo ni en desacuerdo" },
  { id: "disagree", label: "En desacuerdo" },
  { id: "very-disagree", label: "Muy en desacuerdo" }
];

let questionData;
let evidenceData;
let questionIndex = 0;
let view = "home";
let evidenceTab = "records";
let shareDialog = false;
let privacyDialog = false;
let shareGenerated = "";
let sharedReadOnly = false;
let notice = "";
let filters = { organization: "", area: "", year: "", status: "", sourceType: "", institution: "", commitmentType: "", responsibleInstitution: "" };
let state = { answers: {}, importance: {}, essential: {} };

const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"']/g, (ch) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
}[ch]));
const formatDate = (value) => value ? new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) : "Fecha no indicada";
const allQuestions = () => questionData.blocks.flatMap((block, blockIndex) => block.questions.map((q) => ({ ...q, blockId: block.id, blockTitle: block.title, blockIndex })));
const answerLabel = (q, value) => {
  if (!value) return "Sin respuesta";
  const shared = questionData.responseOptions.find((item) => item.id === value);
  if (shared) return shared.label;
  if (q.type === "scale") return SCALE_CHOICES.find((item) => item.id === value)?.label || "Respuesta no disponible";
  return q.answers.find((item) => item.id === value)?.label || "Respuesta no disponible";
};
const priorityLabel = (id) => questionData.importanceLevels.find((item) => item.id === String(id))?.label || "Sin indicar";

function sanitizePayload(raw) {
  const clean = { answers: {}, importance: {}, essential: {} };
  const questionMap = new Map(allQuestions().map((q) => [q.id, q]));
  for (const [id, value] of Object.entries(raw?.answers || {})) {
    const q = questionMap.get(id);
    if (!q || typeof value !== "string") continue;
    const valid = q.type === "scale" ? SCALE_CHOICES.some((x) => x.id === value) : q.answers.some((x) => x.id === value);
    if (valid || questionData.responseOptions.some((x) => x.id === value)) clean.answers[id] = value;
  }
  for (const [id, value] of Object.entries(raw?.importance || {})) {
    if (questionMap.has(id) && ["0", "1", "2", "3"].includes(String(value))) clean.importance[id] = String(value);
  }
  for (const [id, value] of Object.entries(raw?.essential || {})) {
    if (questionMap.has(id) && value === true) clean.essential[id] = true;
  }
  return clean;
}

function readSharedProfile() {
  const match = location.hash.match(/^#perfil=([A-Za-z0-9_-]+)$/);
  if (!match) return null;
  try {
    const base64 = match[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(escape(atob(base64)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function persist() {
  if (sharedReadOnly) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, questionIndex }));
  } catch {
    notice = "No se pudo guardar el progreso en este navegador.";
  }
}

function loadLocal() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved) return;
    state = sanitizePayload(saved);
    const max = allQuestions().length - 1;
    questionIndex = Number.isInteger(saved.questionIndex) ? Math.max(0, Math.min(max, saved.questionIndex)) : 0;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function setView(nextView) {
  view = nextView;
  shareDialog = false;
  privacyDialog = false;
  notice = "";
  render();
  document.querySelector("#main")?.focus({ preventScroll: true });
}

function navMarkup() {
  const items = [
    ["home", "Inicio"],
    ["questionnaire", "Cuestionario"],
    ["results", "Mi perfil"],
    ["evidence", "Evidencias"],
    ["method", "Método"]
  ].filter(([id]) => !(sharedReadOnly && id === "questionnaire"));
  return `<nav class="primary-nav" aria-label="Navegación principal">${items.map(([id, label]) => `<button class="nav-item ${view === id ? "active" : ""}" data-action="view" data-view="${id}" aria-current="${view === id ? "page" : "false"}">${label}</button>`).join("")}</nav>`;
}

function renderHome() {
  const count = Object.keys(state.answers).length;
  return `
    <section class="intro-grid">
      <div class="intro-copy">
        <div class="eyebrow"><span class="eyebrow-line"></span> Una herramienta para pensar con fuentes</div>
        <h1>Tu decisión.<br><span>Con más contexto.</span></h1>
        <p class="lede">Ordena tus preferencias políticas y consulta qué información está documentada para las elecciones del 29N.</p>
        <div class="cta-row">
          <button class="button button-primary" data-action="start">${count ? "Continuar cuestionario" : "Comenzar cuestionario"}</button>
          <button class="button button-secondary" data-action="view" data-view="evidence">Explorar evidencias</button>
          <button class="button button-quiet" data-action="copy-tool">Compartir herramienta</button>
        </div>
        <p class="micro-note">43 preguntas · 14 ámbitos · sin cuenta y sin recomendación de voto</p>
      </div>
      <aside class="intro-note" aria-label="Estado de la información electoral">
        <div class="note-mark"><span>29</span><span>N</span></div>
        <div>
          <p class="note-kicker">Estado de la investigación</p>
          <h2>La convocatoria está confirmada.</h2>
          <p>La Junta Electoral prevé proclamar las candidaturas el 2 de noviembre. Los programas de 2026 y la trayectoria por partido todavía no están validados en esta base.</p>
          <button class="inline-link" data-action="view" data-view="evidence">Ver qué está verificado</button>
        </div>
      </aside>
    </section>
    <section class="home-lower">
      <div class="section-heading">
        <span class="section-index">01 / TU PERFIL</span>
        <h2>Primero, decide qué te importa.</h2>
      </div>
      <div class="three-points">
        <article class="point-card"><span class="point-number">A</span><h3>Expresa tus prioridades</h3><p>Responde sobre medidas concretas y marca asuntos importantes o innegociables.</p></article>
        <article class="point-card"><span class="point-number">B</span><h3>Consulta las fuentes</h3><p>Los documentos originales están enlazados. Una norma o un voto no se presentan como prueba de resultados.</p></article>
        <article class="point-card"><span class="point-number">C</span><h3>Mantén tu criterio</h3><p>No hay porcentajes de afinidad, notas de honestidad, ranking ni recomendación automática.</p></article>
      </div>
      <div class="privacy-strip"><span class="privacy-icon" aria-hidden="true">⌂</span><p><strong>Privacidad por diseño.</strong> Tu progreso se guarda localmente en este navegador. Nada se envía a un servidor. Compartir una comparación requiere una acción y confirmación explícitas.</p><button class="text-button" data-action="privacy">Detalles</button></div>
    </section>`;
}

function renderImportance(q) {
  const chosen = state.importance[q.id] ?? "";
  const levels = questionData.importanceLevels;
  return `<fieldset class="importance-field"><legend>¿Cuánta importancia tiene para ti este asunto?</legend><div class="importance-options">${levels.map((level) => `<button type="button" class="importance-option ${chosen === level.id ? "selected" : ""}" data-action="importance" data-id="${q.id}" data-value="${level.id}" aria-pressed="${chosen === level.id}">${level.label}</button>`).join("")}</div><label class="essential-toggle"><input type="checkbox" data-action="essential" data-id="${q.id}" ${state.essential[q.id] ? "checked" : ""}><span>Marcar como innegociable para mí</span></label></fieldset>`;
}

function renderEvidenceLinks(q) {
  const records = (q.evidenceIds || []).map((id) => evidenceData.records.find((item) => item.id === id)).filter(Boolean);
  if (!records.length) return `<div class="evidence-empty"><span class="evidence-glyph" aria-hidden="true">i</span><span>No hay evidencia partidista validada asociada a esta pregunta en el corte actual.</span></div>`;
  return `<div class="question-evidence"><div class="mini-label">Contexto documental disponible</div>${records.map((record) => `<article class="mini-evidence"><strong>${escapeHtml(record.status)}</strong><p>${escapeHtml(record.statement)}</p><button class="inline-link" data-action="view" data-view="evidence">Abrir ficha y fuentes</button></article>`).join("")}</div>`;
}

function renderQuestion() {
  const questions = allQuestions();
  const q = questions[questionIndex];
  const progress = Math.round(((questionIndex + 1) / questions.length) * 100);
  const selected = state.answers[q.id] || "";
  const optionList = q.type === "scale" ? SCALE_CHOICES : q.answers;
  const answerButtons = optionList.map((answer) => `<button type="button" class="answer-card ${selected === answer.id ? "selected" : ""}" data-action="answer" data-id="${q.id}" data-value="${answer.id}" aria-pressed="${selected === answer.id}"><span class="radio-mark" aria-hidden="true"></span><span>${escapeHtml(answer.label)}</span></button>`).join("");
  const extraButtons = questionData.responseOptions.map((answer) => `<button type="button" class="uncertainty-option ${selected === answer.id ? "selected" : ""}" data-action="answer" data-id="${q.id}" data-value="${answer.id}" aria-pressed="${selected === answer.id}">${escapeHtml(answer.label)}</button>`).join("");
  return `
    <div class="workspace-top">${navMarkup()}</div>
    <section class="quiz-shell">
      <div class="quiz-progress-row"><div><span class="eyebrow">${escapeHtml(q.blockTitle)}</span><span class="question-count">Pregunta ${questionIndex + 1} de ${questions.length}</span></div><span class="progress-percent">${progress}%</span></div>
      <div class="progress-track" role="progressbar" aria-label="Progreso del cuestionario" aria-valuemin="0" aria-valuemax="${questions.length}" aria-valuenow="${questionIndex + 1}"><span style="width:${progress}%"></span></div>
      <div class="quiz-grid">
        <section class="question-main">
          <span class="question-id">${escapeHtml(q.id)}</span>
          <h1 tabindex="-1">${escapeHtml(q.prompt)}</h1>
          ${q.help ? `<p class="question-help">${escapeHtml(q.help)}</p>` : ""}
          <div class="answer-list" role="group" aria-label="Opciones de respuesta">${answerButtons}</div>
          <div class="uncertainty-block"><p class="mini-label">También puedes dejar tu posición abierta</p><div class="uncertainty-list">${extraButtons}</div></div>
          <div class="quiz-actions"><button class="button button-secondary" data-action="back" ${questionIndex === 0 ? "disabled" : ""}>Anterior</button><button class="button button-primary" data-action="next">${questionIndex === questions.length - 1 ? "Ver mi perfil" : "Siguiente"}</button></div>
        </section>
        <aside class="question-side">
          <div class="side-card side-priority">${renderImportance(q)}</div>
          <div class="side-card"><span class="side-number">${String(q.blockIndex + 1).padStart(2, "0")}</span><h2>Un asunto cada vez</h2><p>Las alternativas muestran enfoques posibles; no pretenden cubrir todas las políticas. Puedes cambiar cualquier respuesta después.</p></div>
          ${renderEvidenceLinks(q)}
        </aside>
      </div>
      ${notice ? `<div class="notice" role="status">${escapeHtml(notice)}</div>` : ""}
    </section>`;
}

function responseSummary() {
  const questions = allQuestions();
  const answered = questions.filter((q) => state.answers[q.id] && !["unknown", "undecided", "omitted"].includes(state.answers[q.id])).length;
  const unknown = questions.filter((q) => state.answers[q.id] === "unknown").length;
  const undecided = questions.filter((q) => state.answers[q.id] === "undecided").length;
  const omitted = questions.filter((q) => !state.answers[q.id] || state.answers[q.id] === "omitted").length;
  return { answered, unknown, undecided, omitted, total: questions.length };
}

function renderResults() {
  const questions = allQuestions();
  const stats = responseSummary();
  const essential = questions.filter((q) => state.essential[q.id]);
  const highPriority = questions.filter((q) => ["2", "3"].includes(state.importance[q.id]));
  const blockCards = questionData.blocks.map((block) => {
    const qs = block.questions;
    return `<details class="profile-block"><summary><span>${escapeHtml(block.title)}</span><span class="summary-count">${qs.filter((q) => !!state.answers[q.id]).length} / ${qs.length} con respuesta</span></summary><div class="profile-answers">${qs.map((q) => `<article class="profile-answer"><div class="profile-answer-top"><span class="question-id">${escapeHtml(q.id)}</span><span class="priority-badge">${escapeHtml(priorityLabel(state.importance[q.id]))}${state.essential[q.id] ? " · Innegociable" : ""}</span></div><h3>${escapeHtml(q.prompt)}</h3><p class="answer-quote">${escapeHtml(answerLabel(q, state.answers[q.id]))}</p>${sharedReadOnly ? "" : `<button class="inline-link" data-action="edit-question" data-id="${q.id}">Cambiar respuesta</button>`}</article>`).join("")}</div></details>`;
  }).join("");
  const orgCards = evidenceData.organizationsToVerify.map((org) => `<article class="org-status-card"><div class="org-title-row"><h3>${escapeHtml(org.name)}</h3><span class="status-label status-pending">Por verificar</span></div><dl><div><dt>Candidatura 29N</dt><dd>Pendiente de proclamación oficial</dd></div><div><dt>Programa 2026</dt><dd>No incorporado a esta base</dd></div><div><dt>Trayectoria 2018–2026</dt><dd>Revisión partidista no cerrada</dd></div></dl></article>`).join("");
  return `
    <div class="workspace-top">${navMarkup()}</div>
    ${sharedReadOnly ? `<div class="shared-banner" role="status"><strong>Perfil compartido.</strong> Las respuestas y prioridades de esta comparación vienen codificadas en el fragmento de la URL. Quien tenga el enlace puede verlas; no se han enviado al servidor.</div>` : ""}
    <section class="results-intro"><div><span class="eyebrow">Tu perfil de preferencias</span><h1 tabindex="-1">Lo que has expresado, <span>sin convertirlo en una etiqueta.</span></h1><p>Este resumen organiza tus respuestas. No calcula una afinidad partidista ni decide qué asuntos deben pesar más.</p></div><div class="results-actions">${sharedReadOnly ? "" : `<button class="button button-secondary" data-action="share-open">Compartir mi comparación</button><button class="button button-quiet" data-action="view" data-view="questionnaire">Modificar respuestas</button>`}</div></section>
    <section class="stats-grid" aria-label="Resumen de respuestas"><article class="stat-card stat-primary"><span class="stat-value">${stats.answered}<small> / ${stats.total}</small></span><span>Posición definida</span></article><article class="stat-card"><span class="stat-value">${stats.unknown + stats.undecided}</span><span>Preguntas abiertas</span><small>No lo sé o sin posición definida</small></article><article class="stat-card"><span class="stat-value">${stats.omitted}</span><span>Omitidas o sin respuesta</span><small>No se tratan como desacuerdo</small></article><article class="stat-card"><span class="stat-value">${essential.length}</span><span>Asuntos innegociables</span><small>Marcados por ti</small></article></section>
    <div class="results-columns"><section class="results-section"><div class="section-heading"><span class="section-index">01 / PRIORIDADES</span><h2>Temas que quieres tener en cuenta</h2></div>${essential.length ? `<div class="priority-list">${essential.map((q) => `<article class="priority-item"><span>${escapeHtml(q.blockTitle)}</span><strong>${escapeHtml(q.prompt)}</strong><small>Tu posición: ${escapeHtml(answerLabel(q, state.answers[q.id]))}</small></article>`).join("")}</div>` : `<div class="empty-state"><strong>No has marcado asuntos innegociables.</strong><p>Puedes identificarlos desde cualquier pregunta, sin cambiar el resto de tu perfil.</p></div>`}<div class="priority-summary"><h3>Importancia alta o esencial</h3><p>${highPriority.length ? highPriority.map((q) => `<span class="topic-chip">${escapeHtml(q.blockTitle)}</span>`).join("") : "No has marcado ningún asunto como de importancia alta o esencial."}</p></div></section>
    <aside class="results-aside"><div class="coverage-card"><span class="section-index">02 / CONTEXTO ELECTORAL</span><h2>La comparación por partidos aún no está validada.</h2><p>La convocatoria está confirmada. A fecha de corte, las candidaturas oficiales todavía no se habían proclamado y esta base no contiene una revisión equilibrada de programas, votos, decisiones y compromisos por organización.</p><button class="inline-link" data-action="view" data-view="evidence">Consultar cobertura y fuentes</button></div><div class="reflection-card"><span class="reflection-icon" aria-hidden="true">?</span><h3>Úsalo como punto de partida</h3><p>Revisa las diferencias entre tus prioridades y las evidencias cuando cada ficha esté documentada. Un cambio de postura o un voto requiere contexto antes de interpretarse.</p></div></aside></div>
    <section class="section-block"><div class="section-heading"><span class="section-index">03 / RESPUESTAS</span><h2>Tu perfil por ámbitos</h2></div><div class="profile-accordion">${blockCards}</div></section>
    <section class="section-block"><div class="section-heading"><span class="section-index">04 / ORGANIZACIONES A VERIFICAR</span><h2>Estado de cobertura</h2><p>Son referencias iniciales, no candidaturas confirmadas ni una lista cerrada.</p></div><div class="org-grid">${orgCards}</div></section>
    <div class="results-footer-actions"><button class="button button-secondary" data-action="copy-tool">Compartir herramienta</button>${sharedReadOnly ? "" : `<button class="button button-danger-quiet" data-action="clear">Borrar mis respuestas guardadas</button>`}</div>
    ${shareDialog ? renderShareDialog() : ""}`;
}

function renderFilters() {
  const areas = [...new Set([...evidenceData.records, ...evidenceData.commitments].map((r) => r.area).filter(Boolean))];
  const years = [...new Set([
    ...evidenceData.records.map((r) => r.eventDate?.slice(0, 4)),
    ...evidenceData.commitments.map((r) => String(r.electionYear || ""))
  ].filter(Boolean))].sort().reverse();
  const statuses = evidenceTab === "promises" ? evidenceData.commitmentStates : [...new Set(evidenceData.records.map((r) => r.status))];
  const institutions = [...new Set(evidenceData.sources.map((s) => s.institution))];
  return `<div class="filter-grid">
    <label>Organización<select data-filter="organization"><option value="">Todas / sin atribución</option>${evidenceData.organizationsToVerify.map((o) => `<option value="${o.id}" ${filters.organization === o.id ? "selected" : ""}>${escapeHtml(o.name)}</option>`).join("")}</select></label>
    <label>Año<select data-filter="year"><option value="">Todos</option>${years.map((y) => `<option value="${y}" ${filters.year === y ? "selected" : ""}>${y}</option>`).join("")}</select></label>
    <label>Ámbito<select data-filter="area"><option value="">Todos</option>${areas.map((a) => `<option value="${a}" ${filters.area === a ? "selected" : ""}>${escapeHtml(a.charAt(0).toUpperCase() + a.slice(1))}</option>`).join("")}</select></label>
    <label>${evidenceTab === "promises" ? "Estado del compromiso" : "Estado documental"}<select data-filter="status"><option value="">Todos</option>${statuses.map((s) => `<option value="${escapeHtml(s)}" ${filters.status === s ? "selected" : ""}>${escapeHtml(s)}</option>`).join("")}</select></label>
    <label>Tipo de fuente<select data-filter="sourceType"><option value="">Todos</option><option value="Primaria" ${filters.sourceType === "Primaria" ? "selected" : ""}>Primaria</option><option value="Secundaria" ${filters.sourceType === "Secundaria" ? "selected" : ""}>Secundaria</option></select></label>
    <label>Institución fuente<select data-filter="institution"><option value="">Todas</option>${institutions.map((s) => `<option value="${escapeHtml(s)}" ${filters.institution === s ? "selected" : ""}>${escapeHtml(s)}</option>`).join("")}</select></label>
    ${evidenceTab === "promises" ? `<label>Tipo de compromiso<select data-filter="commitmentType"><option value="">Todos</option>${evidenceData.commitmentTypes.map((s) => `<option value="${escapeHtml(s)}" ${filters.commitmentType === s ? "selected" : ""}>${escapeHtml(s)}</option>`).join("")}</select></label><label>Institución responsable<select data-filter="responsibleInstitution"><option value="">Todas</option>${evidenceData.responsibleInstitutions.map((s) => `<option value="${escapeHtml(s)}" ${filters.responsibleInstitution === s ? "selected" : ""}>${escapeHtml(s)}</option>`).join("")}</select></label>` : ""}
  </div>`;
}

function evidenceMatches(record) {
  if (filters.organization && record.partyId !== filters.organization) return false;
  if (filters.area && record.area !== filters.area) return false;
  if (filters.year && !record.eventDate?.startsWith(filters.year)) return false;
  if (filters.status && record.status !== filters.status) return false;
  const sources = record.sourceIds.map((id) => evidenceData.sources.find((s) => s.id === id)).filter(Boolean);
  if (filters.sourceType && !sources.some((s) => s.sourceType.startsWith(filters.sourceType))) return false;
  if (filters.institution && !sources.some((s) => s.institution === filters.institution)) return false;
  return true;
}

function commitmentMatches(record) {
  if (filters.organization && record.partyId !== filters.organization) return false;
  if (filters.area && record.area !== filters.area) return false;
  if (filters.year && String(record.electionYear) !== filters.year) return false;
  if (filters.status && record.status !== filters.status) return false;
  if (filters.commitmentType && record.commitmentType !== filters.commitmentType) return false;
  if (filters.responsibleInstitution && record.responsibleInstitution !== filters.responsibleInstitution) return false;
  const sources = (record.sourceIds || []).map((id) => evidenceData.sources.find((s) => s.id === id)).filter(Boolean);
  if (filters.sourceType && !sources.some((s) => s.sourceType.startsWith(filters.sourceType))) return false;
  if (filters.institution && !sources.some((s) => s.institution === filters.institution)) return false;
  return true;
}

function renderCommitmentCard(record) {
  const sources = (record.sourceIds || []).map((id) => evidenceData.sources.find((source) => source.id === id)).filter(Boolean);
  return `<article class="evidence-card"><div class="evidence-card-head"><span class="area-tag">${escapeHtml(record.area)}</span><time>${escapeHtml(record.electionYear || "Año no indicado")}</time></div><span class="status-label">${escapeHtml(record.status)}</span><h3>${escapeHtml(record.commitmentText)}</h3><dl class="evidence-meta"><div><dt>Tipo y responsable político</dt><dd>${escapeHtml(record.commitmentType)} · ${escapeHtml(record.partyName)}</dd></div><div><dt>Institución competente</dt><dd>${escapeHtml(record.responsibleInstitution)}</dd></div><div><dt>Actuación y resultado</dt><dd>${escapeHtml(record.actions || "Sin dato incorporado")}. ${escapeHtml(record.result || "")}</dd></div><div><dt>Obstáculos documentados</dt><dd>${escapeHtml(record.obstacles || "No documentados en esta ficha")}</dd></div><div><dt>Revisado</dt><dd>${escapeHtml(formatDate(record.checkedAt))}</dd></div></dl><div class="source-list"><span class="mini-label">Fuentes</span>${sources.map((source) => `<a class="source-link" href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer"><span><strong>${escapeHtml(source.title)}</strong><small>${escapeHtml(source.institution)} · ${escapeHtml(source.sourceType)} · comprobado ${formatDate(source.checkedAt)}</small></span><span aria-hidden="true">↗</span></a>`).join("")}</div></article>`;
}

function renderEvidenceCard(record) {
  const sources = record.sourceIds.map((id) => evidenceData.sources.find((source) => source.id === id)).filter(Boolean);
  return `<article class="evidence-card"><div class="evidence-card-head"><span class="area-tag">${escapeHtml(record.area)}</span><time datetime="${escapeHtml(record.eventDate || "")}">${escapeHtml(formatDate(record.eventDate))}</time></div><span class="status-label">${escapeHtml(record.status)}</span><h3>${escapeHtml(record.statement)}</h3><dl class="evidence-meta"><div><dt>Alcance</dt><dd>${escapeHtml(record.scope)}</dd></div><div><dt>Interpretación</dt><dd>${escapeHtml(record.interpretation)}</dd></div><div><dt>Contraste o límite</dt><dd>${escapeHtml(record.contraryEvidence)}</dd></div><div><dt>Revisado</dt><dd>${escapeHtml(formatDate(record.checkedAt))}</dd></div></dl><div class="source-list"><span class="mini-label">Fuentes originales</span>${sources.map((source) => `<a class="source-link" href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer"><span><strong>${escapeHtml(source.title)}</strong><small>${escapeHtml(source.institution)} · ${escapeHtml(source.sourceType)}${source.publicationDate ? ` · publicación ${formatDate(source.publicationDate)}` : ""} · respaldo: ${escapeHtml(source.support)} · comprobado ${formatDate(source.checkedAt)}</small><small>Referencia: ${escapeHtml(source.documentReference)}</small><small>${escapeHtml(source.note)}</small></span><span aria-hidden="true">↗</span></a>`).join("")}</div></article>`;
}

function renderEvidence() {
  const records = evidenceData.records.filter(evidenceMatches).sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  const partyFiltered = !!filters.organization;
  let content = "";
  if (evidenceTab === "promises") {
    const commitments = evidenceData.commitments.filter(commitmentMatches);
    content = commitments.length ? `<div class="evidence-results-count">${commitments.length} compromisos registrados</div><div class="evidence-grid">${commitments.map(renderCommitmentCard).join("")}</div>` : `<div class="empty-state empty-large"><span class="empty-mark">0</span><div><strong>No hay compromisos partidistas evaluados en este corte.</strong><p>Por tanto, no se clasifican promesas como cumplidas o incumplidas. La ausencia de una ficha no implica que una organización incumpliera un compromiso.</p><p>Cuando se incorporen, cada registro incluirá el texto prometido, responsable institucional, actuaciones, resultado y una de las categorías de cumplimiento definidas en el método.</p></div></div>`;
  } else if (evidenceTab === "timeline") {
    content = `<div class="timeline-note"><strong>Hitos institucionales documentados.</strong><span>Esta línea temporal no contiene aún cambios de postura ni contradicciones atribuidos a partidos.</span></div><div class="timeline-list">${records.slice().sort((a,b)=>a.eventDate.localeCompare(b.eventDate)).map((record) => `<article class="timeline-item"><time datetime="${escapeHtml(record.eventDate)}">${escapeHtml(formatDate(record.eventDate))}</time><div class="timeline-dot"></div><div><span class="area-tag">${escapeHtml(record.area)}</span><h3>${escapeHtml(record.statement)}</h3><p>${escapeHtml(record.status)} · ${escapeHtml(record.interpretation)}</p></div></article>`).join("") || `<div class="empty-state"><strong>No hay hitos con estos filtros.</strong><p>Ajusta los criterios de búsqueda.</p></div>`}</div>`;
  } else if (!records.length) {
    content = `<div class="empty-state empty-large"><span class="empty-mark">${partyFiltered ? "—" : "0"}</span><div><strong>${partyFiltered ? "No hay registros partidistas validados para esta organización." : "No hay registros con estos filtros."}</strong><p>${partyFiltered ? "Los documentos institucionales disponibles se mantienen como contexto y no se atribuyen a partidos. La falta de una ficha no constituye evidencia a favor ni en contra." : "Cambia los filtros para revisar el registro documental disponible."}</p></div></div>`;
  } else {
    content = `<div class="evidence-results-count">${records.length} fichas documentales · Sin puntuaciones de afinidad</div><div class="evidence-grid">${records.map(renderEvidenceCard).join("")}</div>`;
  }
  return `
    <div class="workspace-top">${navMarkup()}</div>
    <section class="page-intro"><span class="eyebrow">Base documental · corte 8 oct 2026</span><h1>Qué está verificado<br><span>y qué falta por investigar.</span></h1><p>La evidencia se conserva como registro separado de la interpretación. Solo aparecen afirmaciones con referencia verificable.</p></section>
    <section class="coverage-overview"><div class="coverage-overview-main"><span class="section-index">COBERTURA ACTUAL</span><h2>El cuestionario está completo. La investigación partidista, no.</h2><p>Esta versión es un piloto documental: confirma la convocatoria y enlaza fuentes institucionales sobre calendario y vivienda. No afirma haber revisado ocho años de trayectoria por partido.</p></div><div class="coverage-counts"><div><strong>${evidenceData.sources.length}</strong><span>fuentes primarias indexadas</span></div><div><strong>${evidenceData.records.length}</strong><span>hechos o registros documentales</span></div><div><strong>0</strong><span>promesas evaluadas por partido</span></div></div></section>
    <section class="section-block evidence-explorer"><div class="evidence-tabs" role="tablist" aria-label="Explorador de evidencias"><button role="tab" aria-selected="${evidenceTab === "records"}" class="evidence-tab ${evidenceTab === "records" ? "active" : ""}" data-action="evidence-tab" data-tab="records">Registros</button><button role="tab" aria-selected="${evidenceTab === "promises"}" class="evidence-tab ${evidenceTab === "promises" ? "active" : ""}" data-action="evidence-tab" data-tab="promises">Compromisos</button><button role="tab" aria-selected="${evidenceTab === "timeline"}" class="evidence-tab ${evidenceTab === "timeline" ? "active" : ""}" data-action="evidence-tab" data-tab="timeline">Línea temporal</button></div>${renderFilters()}<div class="tab-panel" role="tabpanel">${content}</div></section>
    <section class="section-block"><div class="section-heading"><span class="section-index">ORGANIZACIONES</span><h2>Referencias provisionales de seguimiento</h2><p>No se presupone que concurran por separado ni se presentan como candidaturas confirmadas.</p></div><div class="org-grid">${evidenceData.organizationsToVerify.map((org) => `<article class="org-status-card"><div class="org-title-row"><h3>${escapeHtml(org.name)}</h3><span class="status-label status-pending">Pendiente</span></div><p>Programa 2026, candidatura por circunscripción e historial partidista: revisión pendiente en este corte.</p></article>`).join("")}</div></section>
    ${shareDialog ? renderShareDialog() : ""}`;
}

function renderMethod() {
  const topics = questionData.blocks.map((block) => `<li>${escapeHtml(block.title)} <span>${block.questions.length} preguntas</span></li>`).join("");
  return `
    <div class="workspace-top">${navMarkup()}</div>
    <section class="page-intro"><span class="eyebrow">Cómo se construye</span><h1>Una comparación solo vale<br><span>lo que valen sus fuentes.</span></h1><p>La interfaz separa preferencias personales, hechos documentados e interpretación. Esta versión no presenta la fase de investigación como cerrada.</p></section>
    <div class="method-layout"><section class="method-main">
      <article class="method-card"><span class="section-index">01 / FECHA Y ALCANCE</span><h2>Período previsto</h2><p>La investigación debe cubrir del 29 de noviembre de 2018 al 8 de octubre de 2026. La fecha de corte se muestra en la cabecera y en cada registro. No se presentan hechos posteriores como si ya hubieran ocurrido; puede mostrarse un hito futuro anunciado en una fuente oficial, siempre marcado como previsto.</p><p>La convocatoria se verificó en el <a href="https://www.boe.es/boe/dias/2026/10/06/pdfs/BOE-A-2026-20742.pdf" target="_blank" rel="noopener noreferrer">Real Decreto 806/2026</a>. La proclamación de candidaturas aún era un hito futuro según el <a href="https://www.juntaelectoralcentral.es/cs/jec/documentos/eg2026_calendario.pdf" target="_blank" rel="noopener noreferrer">calendario de la Junta Electoral Central</a>.</p></article>
      <article class="method-card"><span class="section-index">02 / CUESTIONARIO</span><h2>Preguntas y prioridades</h2><p>Hay ${allQuestions().length} preguntas en 14 ámbitos. Se usan alternativas de política, escalas de cinco posiciones y dilemas presupuestarios. Las respuestas no muestran partidos y no se transforman en afinidad.</p><p>“No lo sé”, “No tengo una posición definida” y “Prefiero omitir” se guardan de forma diferenciada. No se cuentan como desacuerdo. Las prioridades ordenan tu reflexión, no ponderan una nota partidista.</p><ul class="topic-list">${topics}</ul></article>
      <article class="method-card"><span class="section-index">03 / EVIDENCIA Y RESPONSABILIDAD</span><h2>Qué debe contener una ficha partidista</h2><ul class="check-list"><li>Programa oficial, declaración o texto institucional con fecha y URL.</li><li>Identificación del actor: organización, grupo parlamentario, cargo o persona portavoz.</li><li>Texto de la propuesta, iniciativa o votación concreta, incluida la fase legislativa.</li><li>Competencia institucional y capacidad real de decisión.</li><li>Acción posterior, resultado verificable y obstáculos documentados.</li><li>Fuente contradictoria o contexto relevante cuando exista.</li><li>Fecha de última comprobación y nivel de respaldo.</li></ul><p>Una ley aprobada no demuestra que se ejecutara. Un voto no resume toda la posición de un partido. Una declaración individual no se convierte automáticamente en postura oficial.</p></article>
      <article class="method-card"><span class="section-index">04 / ESTADOS DE COMPROMISO</span><h2>Estados descriptivos, no notas</h2><div class="state-pills">${evidenceData.commitmentStates.map((status) => `<span>${escapeHtml(status)}</span>`).join("")}</div><p>“Sin evidencia suficiente” es una categoría explícita. La falta de datos nunca se codifica como incumplimiento.</p></article>
      <article class="method-card"><span class="section-index">05 / CONTROLES DE NEUTRALIDAD</span><h2>Mismo estándar para todas las organizaciones</h2><p>La comparación futura debe presentar las mismas dimensiones, fechas, tipos de fuente y estados para cada formación. Las listas provisionales no implican candidaturas separadas. Los resultados no mostrarán ranking, porcentaje de afinidad, nota de honestidad ni recomendación electoral.</p><p>Cuando haya interpretaciones en conflicto, se atribuirán a sus fuentes. Los cambios documentados se describirán con fechas y contexto, sin atribuir intenciones.</p></article>
    </section><aside class="method-aside"><div class="status-card"><span class="status-label status-pending">Investigación parcial</span><h2>Lagunas visibles</h2><ul><li>Programas electorales de 2019 y 2023: sin revisión sistemática en este piloto.</li><li>Programas de 2026: no incorporados todavía.</li><li>Votaciones nominales por organización: pendientes de codificación y contraste.</li><li>Decisiones de gobierno y ejecución: pendientes de evaluación.</li><li>Compromisos anteriores y cumplimiento: no evaluados.</li><li>Cambios de postura: no incorporados.</li></ul><p>No se publican comparaciones partidistas hasta cubrir estas lagunas con fuentes trazables.</p><button class="button button-secondary" data-action="view" data-view="evidence">Ver fuentes y cobertura</button></div><div class="status-card privacy-card"><span class="section-index">DATOS PERSONALES</span><h2>Respuestas bajo tu control</h2><ul><li>Guardado en localStorage del navegador.</li><li>Sin cuenta, analítica ni trackers.</li><li>Compartir respuestas requiere confirmación.</li><li>El enlace compartido usa el fragmento #perfil, que no se envía al servidor web.</li><li>Puedes borrar el progreso desde Mi perfil.</li></ul></div></aside></div>
    ${privacyDialog ? renderPrivacyDialog() : ""}`;
}

function renderShareDialog() {
  return `<div class="modal-backdrop" role="presentation"><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="share-title"><button class="modal-close" data-action="close-modal" aria-label="Cerrar">×</button><span class="section-index">COMPARTIR CON CONSENTIMIENTO</span><h2 id="share-title">Tu comparación contiene preferencias políticas.</h2><p>Si generas el enlace, tus respuestas y prioridades se codificarán en la URL. Cualquier persona que tenga el enlace podrá verlas. El fragmento después de <code>#</code> no se envía al servidor, pero quien reciba el enlace sí podrá leer el perfil.</p><p>La herramienta no guarda la comparación compartida en una base de datos.</p>${shareGenerated ? `<label class="share-url-label">Enlace generado<input class="share-url-input" readonly value="${escapeHtml(shareGenerated)}" id="share-url"></label><p class="notice" role="status">${escapeHtml(notice || "Enlace listo para copiar.")}</p><button class="button button-primary" data-action="copy-share">Copiar enlace</button>` : `<div class="modal-actions"><button class="button button-secondary" data-action="close-modal">Cancelar</button><button class="button button-primary" data-action="share-generate">Entiendo y generar enlace</button></div>`}</section></div>`;
}

function renderPrivacyDialog() {
  return `<div class="modal-backdrop" role="presentation"><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="privacy-title"><button class="modal-close" data-action="close-modal" aria-label="Cerrar">×</button><span class="section-index">PRIVACIDAD</span><h2 id="privacy-title">Tus respuestas se quedan en este navegador.</h2><p>El progreso se almacena en localStorage para que puedas continuar más tarde. La aplicación no tiene cuenta, servidor de respuestas, base de datos personal, rastreadores ni analítica.</p><p>“Compartir mi comparación” crea un enlace con las respuestas en el fragmento de URL únicamente después de tu confirmación. No lo compartas si no quieres que otras personas vean tus preferencias políticas.</p><p>Puedes borrar el progreso desde la pantalla “Mi perfil” o desde la configuración de datos del navegador.</p><div class="modal-actions"><button class="button button-primary" data-action="close-modal">Entendido</button></div></section></div>`;
}

function render() {
  if (!questionData || !evidenceData) return;
  let content = "";
  if (view === "home") content = renderHome();
  else if (view === "questionnaire") content = renderQuestion();
  else if (view === "results") content = renderResults();
  else if (view === "evidence") content = renderEvidence();
  else content = renderMethod();
  app.innerHTML = `${content}${notice && !shareDialog ? `<div class="global-notice" role="status">${escapeHtml(notice)}</div>` : ""}${privacyDialog && view !== "method" ? renderPrivacyDialog() : ""}`;
}

function encodeSharePayload() {
  const payload = JSON.stringify({ answers: state.answers, importance: state.importance, essential: state.essential });
  const bytes = new TextEncoder().encode(payload);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    notice = "Enlace copiado.";
  } catch {
    notice = "No se pudo copiar automáticamente. Selecciona y copia el enlace mostrado.";
  }
  render();
}

function handleAction(button) {
  const action = button.dataset.action;
  const id = button.dataset.id;
  const value = button.dataset.value;
  if (action === "home") return setView("home");
  if (action === "view") return setView(button.dataset.view);
  if (action === "start") {
    if (sharedReadOnly) {
      state = { answers: {}, importance: {}, essential: {} };
      sharedReadOnly = false;
      questionIndex = 0;
      history.replaceState(null, "", `${location.pathname}${location.search}`);
    }
    view = "questionnaire";
    render();
    return;
  }
  if (action === "answer") {
    state.answers[id] = value;
    persist();
    render();
    document.querySelector(`.answer-card[data-id="${CSS.escape(id)}"][data-value="${CSS.escape(value)}"], .uncertainty-option[data-id="${CSS.escape(id)}"][data-value="${CSS.escape(value)}"]`)?.focus({ preventScroll: true });
    return;
  }
  if (action === "importance") {
    state.importance[id] = value;
    persist();
    render();
    document.querySelector(`.importance-option[data-id="${CSS.escape(id)}"][data-value="${CSS.escape(value)}"]`)?.focus({ preventScroll: true });
    return;
  }
  if (action === "back") {
    questionIndex = Math.max(0, questionIndex - 1);
    persist();
    render();
    document.querySelector(".question-main h1")?.focus({ preventScroll: true });
    return;
  }
  if (action === "next") {
    const q = allQuestions()[questionIndex];
    if (!state.answers[q.id]) state.answers[q.id] = "omitted";
    if (questionIndex === allQuestions().length - 1) view = "results";
    else questionIndex += 1;
    persist();
    render();
    document.querySelector(view === "results" ? ".results-intro h1" : ".question-main h1")?.focus({ preventScroll: true });
    return;
  }
  if (action === "essential") {
    const checked = button.checked;
    if (checked) state.essential[id] = true;
    else delete state.essential[id];
    persist();
    render();
    document.querySelector(`input[data-action="essential"][data-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
    return;
  }
  if (action === "edit-question") {
    questionIndex = allQuestions().findIndex((q) => q.id === id);
    view = "questionnaire";
    render();
    document.querySelector(".question-main h1")?.focus({ preventScroll: true });
    return;
  }
  if (action === "evidence-tab") { evidenceTab = button.dataset.tab; filters.status = ""; filters.commitmentType = ""; filters.responsibleInstitution = ""; render(); return; }
  if (action === "share-open") { shareDialog = true; shareGenerated = ""; notice = ""; render(); document.querySelector(".modal-close")?.focus(); return; }
  if (action === "share-generate") {
    const url = new URL(location.href);
    url.hash = `perfil=${encodeSharePayload()}`;
    shareGenerated = url.toString();
    shareDialog = true;
    copyText(shareGenerated);
    return;
  }
  if (action === "copy-share") return copyText(shareGenerated);
  if (action === "copy-tool") {
    const url = new URL(location.href);
    url.hash = "";
    return copyText(url.toString());
  }
  if (action === "privacy") { privacyDialog = true; render(); document.querySelector(".modal-close")?.focus(); return; }
  if (action === "close-modal") { shareDialog = false; privacyDialog = false; shareGenerated = ""; notice = ""; render(); return; }
  if (action === "clear") {
    if (!window.confirm("¿Borrar todas las respuestas y prioridades guardadas en este navegador?")) return;
    localStorage.removeItem(STORAGE_KEY);
    state = { answers: {}, importance: {}, essential: {} };
    questionIndex = 0;
    sharedReadOnly = false;
    history.replaceState(null, "", `${location.pathname}${location.search}`);
    return setView("home");
  }
}

app.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (button && button.dataset.action !== "essential") handleAction(button);
});
app.addEventListener("change", (event) => {
  const target = event.target;
  if (target.matches('[data-action="essential"]')) { handleAction(target); return; }
  if (target.matches("[data-filter]")) {
    filters[target.dataset.filter] = target.value;
    render();
  }
});

document.querySelector(".site-header").addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  event.preventDefault();
  handleAction(button);
});

async function init() {
  try {
    const [qResponse, eResponse] = await Promise.all([fetch("./data/questions.json"), fetch("./data/evidence.json")]);
    if (!qResponse.ok || !eResponse.ok) throw new Error("No se pudo cargar la base documental.");
    [questionData, evidenceData] = await Promise.all([qResponse.json(), eResponse.json()]);
    const shared = readSharedProfile();
    if (shared) {
      state = sanitizePayload(shared);
      sharedReadOnly = true;
      view = "results";
    } else loadLocal();
    render();
  } catch (error) {
    app.innerHTML = `<section class="load-error"><h1>No se pudo abrir el cuestionario.</h1><p>Comprueba tu conexión y vuelve a cargar la página. ${escapeHtml(error.message)}</p><button class="button button-primary" onclick="location.reload()">Volver a intentar</button></section>`;
  }
}

init();
