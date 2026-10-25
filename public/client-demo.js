(() => {
  'use strict';

  const statusLabels = { new: 'Nowe', progress: 'W toku', closed: 'Zamknięte' };
  const requestSeed = [
    { id: 'DEMO-007', title: 'Awaria domofonu', category: 'Usterka', channel: 'Bot AI', time: '09:42', day: 'Dziś', status: 'new', place: 'Obiekt A · wejście 2', person: 'Osoba A (przykład)', duration: '1 min 24 s', summary: 'Rozmówca zgłosił brak sygnału w domofonie. Bot zebrał oznaczenie obiektu, opis problemu i preferowaną porę kontaktu. Sprawa wymaga sprawdzenia przez serwis.', next: 'Przypisz zgłoszenie do osoby odpowiedzialnej i potwierdź sposób kontaktu.' },
    { id: 'DEMO-006', title: 'Pytanie o ofertę serwisu', category: 'Zapytanie ofertowe', channel: 'Formularz', time: '09:18', day: 'Dziś', status: 'new', place: 'Obiekt B', person: 'Osoba B (przykład)', duration: 'Nie dotyczy', summary: 'W formularzu wskazano zainteresowanie stałą obsługą techniczną obiektu. Zebrano zakres potrzeb oraz preferencję kontaktu e-mail. Oferta nie została przygotowana automatycznie.', next: 'Zweryfikuj zakres potrzeb i przygotuj indywidualną odpowiedź.' },
    { id: 'DEMO-005', title: 'Termin przeglądu instalacji', category: 'Prośba o kontakt', channel: 'Bot AI', time: '08:56', day: 'Dziś', status: 'progress', place: 'Obiekt C', person: 'Osoba C (przykład)', duration: '2 min 03 s', summary: 'Rozmówca poprosił o kontakt w sprawie przeglądu. Bot zebrał typ instalacji i oczekiwany termin. Nie potwierdził rezerwacji ani dostępności pracownika.', next: 'Sprawdź kalendarz zespołu i uzgodnij termin z klientem.' },
    { id: 'DEMO-004', title: 'Uzupełnienie danych zgłoszenia', category: 'Aktualizacja sprawy', channel: 'Bot AI', time: '16:20', day: 'Wczoraj', status: 'new', place: 'Obiekt D · wejście 1', person: 'Osoba D (przykład)', duration: '0 min 48 s', summary: 'Rozmówca podał dodatkowe informacje do wcześniejszego zgłoszenia. W prawdziwym wdrożeniu powiązanie spraw wymaga ustalonych zasad identyfikacji.', next: 'Sprawdź zgodność danych i powiąż aktualizację z właściwą sprawą.' },
    { id: 'DEMO-003', title: 'Prośba o zmianę zakresu prac', category: 'Prośba o kontakt', channel: 'Formularz', time: '14:35', day: 'Wczoraj', status: 'progress', place: 'Obiekt E', person: 'Osoba E (przykład)', duration: 'Nie dotyczy', summary: 'Zgłoszono potrzebę rozszerzenia wcześniej uzgodnionych prac. Zespół otrzymał opis zmiany do oceny. Bot nie zaakceptował dodatkowego kosztu w imieniu firmy.', next: 'Oceń zmianę i przedstaw klientowi zakres oraz wycenę do akceptacji.' },
    { id: 'DEMO-002', title: 'Potwierdzenie przyjęcia zgłoszenia', category: 'Informacja', channel: 'Bot AI', time: '11:07', day: 'Wczoraj', status: 'closed', place: 'Obiekt F', person: 'Osoba F (przykład)', duration: '0 min 39 s', summary: 'Przekazano ustaloną informację o sposobie obsługi zgłoszeń. Sprawa została zakończona w przykładowym procesie.', next: 'Brak kolejnych działań w tym przykładzie.' },
    { id: 'DEMO-001', title: 'Kontakt do opiekuna obiektu', category: 'Prośba o kontakt', channel: 'Bot AI', time: '10:12', day: 'Wczoraj', status: 'closed', place: 'Obiekt G', person: 'Osoba G (przykład)', duration: '1 min 12 s', summary: 'Bot zebrał prośbę o kontakt z opiekunem i przekazał ją zespołowi. Zmiana statusu na zamknięte oznacza decyzję człowieka w tym podglądzie.', next: 'Brak kolejnych działań w tym przykładzie.' },
  ];
  const documentSeed = [
    { id: 'DOC-DEMO-003', number: 'FV/DEMO/003', supplier: 'Przykładowy dostawca A', amountCents: 123000, status: 'review', note: 'Sprawdź odczytaną kwotę i termin.', issueDate: 'Przykładowy miesiąc, dzień 12', dueDate: 'Przykładowy miesiąc, dzień 26', source: 'Skrzynka e-mail (przykład)', summary: 'Przykład dokumentu odczytanego z załącznika. Pola wymagają porównania z dokumentem źródłowym przed dalszym przekazaniem.', review: 'Kwota oraz termin płatności wymagają sprawdzenia. W demo nie ma pliku źródłowego ani prawdziwej faktury.' },
    { id: 'DOC-DEMO-002', number: 'FV/DEMO/002', supplier: 'Przykładowy dostawca B', amountCents: 49200, status: 'review', note: 'Możliwy duplikat — wymaga decyzji.', issueDate: 'Przykładowy miesiąc, dzień 10', dueDate: 'Przykładowy miesiąc, dzień 24', source: 'Skrzynka e-mail (przykład)', summary: 'System może wskazać dokument o podobnym numerze i dostawcy. Taki sygnał wymaga weryfikacji, zanim dokument trafi dalej.', review: 'Sprawdź możliwy duplikat. Samo oznaczenie dokumentu w tym demo nie jest jego zatwierdzeniem do księgowania.' },
    { id: 'DOC-DEMO-001', number: 'FV/DEMO/001', supplier: 'Przykładowy dostawca C', amountCents: 256000, status: 'checked', note: 'Oznaczone jako sprawdzone w przykładzie.', issueDate: 'Przykładowy miesiąc, dzień 8', dueDate: 'Przykładowy miesiąc, dzień 22', source: 'Formularz (przykład)', summary: 'Przykład zakończonej weryfikacji odczytanych danych przez człowieka. Wdrożenie może dalej przekazać dokument do uzgodnionego systemu, jeśli przewidziano taką integrację.', review: 'Dane demonstracyjne. Dokument nie został nigdzie przesłany.' },
  ];

  function normalize(value) {
    return String(value).toLocaleLowerCase('pl').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').trim();
  }

  function filterRequests(requests, query, status) {
    const search = normalize(query);
    return requests.filter(item => (status === 'all' || item.status === status) && normalize(`${item.id} ${item.title} ${item.category} ${item.place} ${item.channel}`).includes(search));
  }

  function csvCell(value) {
    let cell = String(value);
    // Even a local demo should not create executable spreadsheet formulas.
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(cell)) cell = `'${cell}`;
    return `"${cell.replace(/"/g, '""')}"`;
  }

  function exportRequestsCsv(requests) {
    const rows = [['DEMO — WYŁĄCZNIE DANE PRZYKŁADOWE'], ['Numer', 'Temat', 'Kategoria', 'Kanał', 'Status', 'Dzień', 'Godzina']];
    for (const request of requests) rows.push([request.id, request.title, request.category, request.channel, statusLabels[request.status], request.day, request.time]);
    return `\uFEFF${rows.map(row => row.map(csvCell).join(';')).join('\r\n')}\r\n`;
  }

  // Shared pure functions keep the actual filtering/export behavior testable without a browser.
  if (typeof module !== 'undefined' && module.exports) module.exports = { normalize, filterRequests, csvCell, exportRequestsCsv, requestSeed, documentSeed };
  if (typeof document === 'undefined') return;

  const requests = requestSeed.map(item => ({ ...item }));
  const documents = documentSeed.map(item => ({ ...item }));
  const byId = id => document.getElementById(id);
  const tabs = [...document.querySelectorAll('[role="tab"][data-view]')];
  const dialog = byId('detail-dialog');
  const detailContent = byId('detail-content');
  let visibleRequests = requests;

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined && text !== null) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function arrow() {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'request-arrow');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '1.6');
    icon.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M6 18 18 6 M6 6h12v12');
    icon.append(path);
    return icon;
  }

  function statusBadge(status, label) {
    return element('span', label || statusLabels[status], `status-badge ${status}`);
  }

  function money(cents) {
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(cents / 100);
  }

  function announce(message) {
    byId('demo-announcement').textContent = message;
  }

  function showView(view, focusTab = false) {
    for (const tab of tabs) {
      const active = tab.dataset.view === view;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      byId(`view-${tab.dataset.view}`).hidden = !active;
      if (active && focusTab) tab.focus();
    }
  }

  function renderRequests() {
    visibleRequests = filterRequests(requests, byId('request-search').value, byId('request-status').value);
    const target = byId('request-list');
    const fragment = document.createDocumentFragment();
    for (const item of visibleRequests) {
      const row = element('button', null, 'request-row');
      row.type = 'button';
      row.dataset.requestId = item.id;
      row.setAttribute('aria-label', `${item.title}, ${item.id}, ${statusLabels[item.status]}. Pokaż szczegóły.`);
      const topic = element('span', null, 'request-topic');
      topic.append(element('b', item.title), element('small', `${item.id} · ${item.category}`));
      const time = element('span', item.time, 'request-time');
      time.append(element('small', item.day));
      row.append(topic, element('span', item.channel, 'request-channel'), statusBadge(item.status), time, arrow());
      row.addEventListener('click', () => openRequest(item.id));
      fragment.append(row);
    }
    if (!visibleRequests.length) fragment.append(element('p', 'Nie ma spraw pasujących do tych filtrów. Zmień status lub wpisz inny temat.', 'empty-state'));
    target.replaceChildren(fragment);
    byId('request-result-count').textContent = `Widoczne zgłoszenia: ${visibleRequests.length} z ${requests.length}`;
    byId('stat-total').textContent = String(requests.length);
    byId('stat-new').textContent = String(requests.filter(item => item.status === 'new').length);
    byId('stat-progress').textContent = String(requests.filter(item => item.status === 'progress').length);
    byId('stat-closed').textContent = String(requests.filter(item => item.status === 'closed').length);
  }

  function renderDocuments() {
    const target = byId('document-list');
    const fragment = document.createDocumentFragment();
    for (const item of documents) {
      const row = element('button', null, 'document-row');
      row.type = 'button';
      row.dataset.documentId = item.id;
      const label = item.status === 'checked' ? 'Sprawdzone' : 'Do weryfikacji';
      row.setAttribute('aria-label', `${item.number}, ${item.supplier}, ${label}. Pokaż szczegóły.`);
      const icon = element('span', '≡', 'document-icon');
      icon.setAttribute('aria-hidden', 'true');
      const data = element('span', null, 'document-data');
      data.append(element('b', item.number), element('small', item.supplier), element('em', item.note));
      row.append(icon, data, element('span', money(item.amountCents), 'document-amount'), statusBadge(item.status === 'checked' ? 'closed' : 'review', label), arrow());
      row.addEventListener('click', () => openDocument(item.id));
      fragment.append(row);
    }
    target.replaceChildren(fragment);
    const pending = documents.filter(item => item.status === 'review').length;
    byId('document-count').textContent = `Oczekują na weryfikację: ${pending}`;
  }

  function title(text, meta) {
    const heading = element('h2', text, 'detail-title');
    heading.id = 'detail-title';
    return [heading, element('p', meta, 'detail-meta')];
  }

  function fields(pairs) {
    const list = element('dl', null, 'detail-field-list');
    for (const [key, value] of pairs) {
      const group = element('div');
      group.append(element('dt', key), element('dd', value));
      list.append(group);
    }
    return list;
  }

  function showDialog(type) {
    byId('detail-type').textContent = type;
    if (!dialog.open) dialog.showModal();
  }

  function detailFooter() {
    return element('p', 'Wyłącznie dane demonstracyjne. Zmiany pozostają w pamięci tej karty i znikają po odświeżeniu. Żadne dane ani wiadomości nie są wysyłane.', 'demo-detail-footer');
  }

  function openRequest(id) {
    const item = requests.find(value => value.id === id);
    if (!item) return;
    const summary = element('p', item.summary, 'detail-summary');
    const nextStep = element('p', item.next, 'detail-note');
    const history = element('div', null, 'detail-history');
    history.append(element('h3', 'Przebieg w przykładzie'));
    const events = [[item.time, `Przyjęto sprawę przez kanał: ${item.channel}.`], [item.time, 'Utworzono podsumowanie i przekazano sprawę do panelu.']];
    if (item.status !== 'new') events.push(['Teraz', item.status === 'closed' ? 'Sprawa oznaczona jako zamknięta.' : 'Sprawa oznaczona jako w toku.']);
    for (const [time, description] of events) {
      const row = element('p', null, 'history-item');
      row.append(element('span', time), element('b', description));
      history.append(row);
    }
    const actions = element('div', null, 'detail-actions');
    for (const status of ['new', 'progress', 'closed']) {
      if (status === item.status) continue;
      const action = element('button', `Oznacz: ${statusLabels[status].toLocaleLowerCase('pl')}`, `button ${status === 'progress' ? 'primary' : 'secondary'}`);
      action.type = 'button';
      action.addEventListener('click', () => {
        item.status = status;
        renderRequests();
        dialog.close();
        const focusTarget = [...byId('request-list').querySelectorAll('[data-request-id]')].find(node => node.dataset.requestId === item.id) || byId('request-search');
        focusTarget.focus();
        announce(`Demo: sprawa ${item.id} ma teraz status „${statusLabels[status]}”. Zmiana nie została nigdzie wysłana.`);
      });
      actions.append(action);
    }
    detailContent.replaceChildren(...title(item.title, `${item.id} · ${item.day}, ${item.time} · przykład`), statusBadge(item.status), summary, fields([['Obiekt', item.place], ['Kontakt', item.person], ['Kanał', item.channel], ['Czas rozmowy', item.duration]]), element('h3', 'Następny krok', 'detail-section-heading'), nextStep, history, actions, detailFooter());
    showDialog('SZCZEGÓŁY ZGŁOSZENIA / DEMO');
  }

  function openDocument(id) {
    const item = documents.find(value => value.id === id);
    if (!item) return;
    const actions = element('div', null, 'detail-actions');
    if (item.status === 'review') {
      const action = element('button', 'Oznacz jako sprawdzone (demo)', 'button primary');
      action.type = 'button';
      action.addEventListener('click', () => {
        item.status = 'checked';
        item.note = 'Oznaczone jako sprawdzone w tym podglądzie.';
        renderDocuments();
        dialog.close();
        const focusTarget = [...byId('document-list').querySelectorAll('[data-document-id]')].find(node => node.dataset.documentId === item.id);
        if (focusTarget) focusTarget.focus();
        announce(`Demo: dokument ${item.number} oznaczono jako sprawdzony. Nie został przesłany ani zaksięgowany.`);
      });
      actions.append(action);
    } else actions.append(element('p', 'Dokument ma status „Sprawdzone” wyłącznie w tym przykładzie. Nie został przesłany do księgowości.', 'detail-confirmed'));
    const label = item.status === 'checked' ? 'Sprawdzone' : 'Do weryfikacji';
    detailContent.replaceChildren(...title(item.number, `${item.id} · dokument fikcyjny`), statusBadge(item.status === 'checked' ? 'closed' : 'review', label), element('p', item.summary, 'detail-summary'), fields([['Dostawca', item.supplier], ['Kwota przykładowa', money(item.amountCents)], ['Wystawienie', item.issueDate], ['Termin', item.dueDate], ['Źródło', item.source], ['Weryfikacja', label]]), element('p', item.review, 'detail-warning'), actions, detailFooter());
    showDialog('DOKUMENT DO WERYFIKACJI / DEMO');
  }

  for (const tab of tabs) {
    tab.addEventListener('click', () => showView(tab.dataset.view));
    tab.addEventListener('keydown', event => {
      const index = tabs.indexOf(tab);
      let next;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      showView(tabs[next].dataset.view, true);
    });
  }
  byId('request-search').addEventListener('input', renderRequests);
  byId('request-status').addEventListener('change', renderRequests);
  byId('close-detail').addEventListener('click', () => dialog.close());
  byId('export-requests').addEventListener('click', () => {
    const blob = new Blob([exportRequestsCsv(visibleRequests)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = element('a');
    link.href = url;
    link.download = 'dawkoz-zgloszenia-DEMO.csv';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce(`Pobrano CSV z widocznymi zgłoszeniami: ${visibleRequests.length}. Plik zawiera wyłącznie dane przykładowe.`);
  });

  renderRequests();
  renderDocuments();
  showView('requests');
})();
