(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  let catalog, selected = null, category = 'all', values = Object.create(null), dirty = false, timer;
  const icon = '<svg viewBox="0 0 24 28" fill="none" aria-hidden="true"><path d="M5 2h9l6 6v17H5z" stroke="currentColor" stroke-width="1.4"/><path d="M14 2v7h6M8 14h9M8 18h9M8 22h6" stroke="currentColor" stroke-width="1.2"/></svg>';
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function notify(text) {
    $('#toast').textContent = text; $('#toast').hidden = false;
    clearTimeout(timer); timer = setTimeout(() => { $('#toast').hidden = true; }, 5000);
  }
  function defaults() { return Object.fromEntries(Object.entries(catalog.fields).map(([id, field]) => [id, field.default || ''])); }
  function fill(text) { return text.replace(/\{\{([a-z_]+)\}\}/g, (_, key) => values[key]?.trim() ? values[key] : `[${catalog.fields[key].label}]`); }
  function richText(node, source) {
    const pattern = /\{\{([a-z_]+)\}\}/g; let start = 0, match;
    while ((match = pattern.exec(source))) {
      node.append(document.createTextNode(source.slice(start, match.index)));
      if (values[match[1]]?.trim()) node.append(document.createTextNode(values[match[1]]));
      else node.append(element('mark', 'placeholder', `[${catalog.fields[match[1]].label}]`));
      start = pattern.lastIndex;
    }
    node.append(document.createTextNode(source.slice(start)));
  }
  function renderedDocument() {
    return { title: selected.title, version: selected.version, note: selected.notes || catalog.notice,
      sections: selected.sections.map(section => ({ title: fill(section.title), paragraphs: section.paragraphs.map(fill) })) };
  }
  function preview() {
    const paper = $('#document-preview'); paper.replaceChildren();
    paper.append(element('div', 'document-brand', 'DAWKOZ / DOKUMENTY'), element('h2', '', selected.title),
      element('p', 'document-meta', `Projekt do uzgodnienia • wzór B2B • wersja ${selected.version}`), element('p', 'document-note', selected.notes || catalog.notice));
    for (const section of selected.sections) {
      const block = element('section', 'document-section'), title = element('h3'); richText(title, section.title); block.append(title);
      for (const source of section.paragraphs) { const p = element('p'); richText(p, source); block.append(p); }
      paper.append(block);
    }
    const done = selected.fields.filter(id => values[id]?.trim()).length;
    $('#fields-progress').textContent = `${done} z ${selected.fields.length} pól uzupełnionych`;
    $('#edit-status').textContent = dirty ? 'Zmiany w przeglądarce — zapisz plik projektu, aby do nich wrócić.' : 'Dane pozostają w tej przeglądarce.';
  }
  function fields() {
    const form = $('#document-fields'); form.replaceChildren();
    const groups = new Map();
    for (const id of selected.fields) { const field = catalog.fields[id]; if (!groups.has(field.group)) groups.set(field.group, []); groups.get(field.group).push(field); }
    let index = 0;
    for (const [group, items] of groups) {
      const details = element('details', 'field-group'); details.open = index++ === 0;
      const summary = element('summary', '', `${group} · ${items.length}`), content = element('div', 'field-group-content');
      details.append(summary, content);
      for (const field of items) {
        const wrapper = element('div', 'field'), label = element('label', '', field.label); label.htmlFor = `field-${field.id}`;
        const input = element(field.type === 'textarea' ? 'textarea' : field.type === 'select' ? 'select' : 'input');
        input.id = `field-${field.id}`; input.name = field.id;
        if (field.type === 'select') { const empty = element('option', '', 'Wybierz…'); empty.value = ''; input.append(empty); for (const option of field.options) { const item = element('option', '', option); item.value = option; input.append(item); } }
        else { if (input.tagName === 'INPUT') input.type = field.type; input.maxLength = field.type === 'textarea' ? 6000 : 500; }
        input.value = values[field.id] || '';
        input.addEventListener('input', () => { values[field.id] = input.value; dirty = true; preview(); });
        wrapper.append(label, input); content.append(wrapper);
      }
      form.append(details);
    }
  }
  function openTemplate(id) {
    selected = catalog.templates.find(item => item.id === id); if (!selected) return;
    $('#library-view').hidden = true; $('#editor-view').hidden = false;
    $('#editor-category').textContent = selected.category.toLocaleUpperCase('pl');
    $('#editor-title').textContent = selected.title; $('#editor-description').textContent = selected.description;
    $('#blank-pdf').href = `/app/templates/${selected.id}.pdf`;
    fields(); preview(); document.title = `${selected.title} — DAWKOZ`;
    $('#editor-title').tabIndex = -1; $('#editor-title').focus({ preventScroll: true }); window.scrollTo(0, 0);
  }
  function library() {
    $('#library-view').hidden = false; $('#editor-view').hidden = true; document.title = 'Dokumenty — DAWKOZ';
    const term = $('#search').value.trim().toLocaleLowerCase('pl');
    const templates = catalog.templates.filter(item => (category === 'all' || item.category === category) && `${item.title} ${item.description} ${item.category}`.toLocaleLowerCase('pl').includes(term));
    const grid = $('#template-grid'); grid.replaceChildren();
    for (const template of templates) {
      const card = element('article', 'template-card'), header = element('div', 'card-header'), graphic = element('span', 'document-icon');
      graphic.innerHTML = icon; header.append(graphic, element('span', 'card-category', template.category));
      const meta = element('div', 'card-meta'); meta.append(element('span', '', 'PDF + WORD'), element('span', '', `${template.fields.length} pól`), element('span', '', 'PL'));
      const actions = element('div', 'card-actions'), button = element('button', 'use-template', 'Użyj wzoru'); button.type = 'button'; button.append(element('span', '', '→')); button.setAttribute('aria-label', `Użyj wzoru: ${template.title}`); button.addEventListener('click', () => openTemplate(template.id));
      const download = element('a', 'blank-download', 'PDF ↓'); download.href = `/app/templates/${template.id}.pdf`; download.download = `${template.id}.pdf`; download.setAttribute('aria-label', `Pobierz pusty PDF: ${template.title}`);
      actions.append(button, download); card.append(header, element('h2', '', template.title), element('p', '', template.description), meta, actions); grid.append(card);
    }
    $('#results-count').textContent = `Dokumenty: ${templates.length} z ${catalog.templates.length}`;
    $('#empty-state').hidden = templates.length > 0;
    for (const button of $('#categories').querySelectorAll('button')) { const active = button.dataset.category === category; button.classList.toggle('active', active); if (active) button.setAttribute('aria-current', 'true'); else button.removeAttribute('aria-current'); }
  }
  function filename(prefix, extension) { const ref = (values.reference || values.project_name || 'projekt').replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 70).replace(/^-+|-+$/g, '') || 'projekt'; return `${prefix}-${ref}.${extension}`; }
  function download(data, name, type) {
    const blob = new Blob([data], { type }), url = URL.createObjectURL(blob), link = element('a'); link.href = url; link.download = name; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function importData(project) {
    if (!project || project.type !== 'DAWKOZ_DOCUMENT_PROJECT' || project.version !== 1 || !project.values || typeof project.values !== 'object' || Array.isArray(project.values)) throw new Error('To nie jest obsługiwany plik projektu DAWKOZ.');
    const imported = defaults();
    for (const [id, value] of Object.entries(project.values)) {
      if (!Object.hasOwn(catalog.fields, id) || typeof value !== 'string' || value.length > (catalog.fields[id].type === 'textarea' ? 6000 : 500)) throw new Error('Plik projektu zawiera nieprawidłowe pola.');
      const field = catalog.fields[id];
      if (field.type === 'select' && value && !field.options.includes(value)) throw new Error('Plik zawiera nieobsługiwaną opcję.');
      if (field.type === 'date' && value) {
        const date = new Date(value + 'T00:00:00Z');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('Nieprawidłowa data w pliku projektu.');
      }
      imported[id] = value;
    }
    values = imported; dirty = false;
    openTemplate(catalog.templates.some(item => item.id === project.templateId) ? project.templateId : catalog.templates[0].id);
  }
  async function start() {
    const response = await fetch('/app/api/templates', { credentials: 'same-origin', cache: 'no-store' });
    if (response.status === 401) { location.replace('/app/login'); return; }
    if (!response.ok) throw new Error('Nie udało się wczytać biblioteki. Odśwież stronę lub zaloguj się ponownie.');
    catalog = await response.json(); values = defaults();
    $('#document-fields').addEventListener('submit', event => event.preventDefault());
    $('#template-count').textContent = catalog.templates.length;
    const counts = new Map(); for (const template of catalog.templates) counts.set(template.category, (counts.get(template.category) || 0) + 1);
    for (const [name, count] of counts) { const button = element('button', 'category', name); button.type = 'button'; button.dataset.category = name; button.append(element('b', '', count)); $('#categories').append(button); }
    $('#categories').addEventListener('click', event => { const button = event.target.closest('button[data-category]'); if (!button) return; category = button.dataset.category; library(); });
    $('#search').addEventListener('input', library);
    $('#clear-search').addEventListener('click', () => { category = 'all'; $('#search').value = ''; library(); });
    $('#back-library').addEventListener('click', () => { library(); window.scrollTo(0, 0); });
    $('#reset-fields').addEventListener('click', () => { if (!confirm('Wyczyścić dane tego wzoru? Zmieni to również wspólne pola projektu.')) return; for (const id of selected.fields) values[id] = catalog.fields[id].default || ''; dirty = true; fields(); preview(); });
    $('#download-word').addEventListener('click', () => { download(DawkozDocx.create(renderedDocument()), filename(selected.id, 'docx'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); notify('Pobrano edytowalny dokument Word. Sprawdź pola przed podpisaniem.'); });
    $('#print-document').addEventListener('click', () => { document.title = `${selected.title} — ${values.client_name || 'DAWKOZ'}`; window.print(); });
    $('#save-project').addEventListener('click', () => { download(JSON.stringify({ type: 'DAWKOZ_DOCUMENT_PROJECT', version: 1, templateId: selected.id, values }, null, 2), filename('dawkoz-projekt', 'json'), 'application/json'); dirty = false; preview(); notify('Pobrano plik projektu. Możesz go później wczytać w panelu.'); });
    $('#import-project').addEventListener('click', () => { if (dirty && !confirm('Wczytanie pliku zastąpi bieżące dane. Kontynuować?')) return; $('#project-file').click(); });
    $('#project-file').addEventListener('change', async event => { const file = event.target.files[0]; if (!file) return; try { if (file.size > 1024 * 1024) throw new Error('Plik jest zbyt duży. Maksymalny rozmiar to 1 MB.'); importData(JSON.parse(await file.text())); notify('Wczytano projekt.'); } catch (error) { notify(error instanceof SyntaxError ? 'Plik nie zawiera poprawnego projektu JSON.' : error.message); } finally { event.target.value = ''; } });
    window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
    library();
  }
  start().catch(error => { $('#app-error').textContent = error.message; $('#app-error').hidden = false; $('#results-count').textContent = 'Biblioteka niedostępna'; });
})();
