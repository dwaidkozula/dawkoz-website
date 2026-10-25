'use strict';
const offer = require('./offer.json');
const money = cents => (cents / 100).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00a0/g, ' ') + ' zł';

function presets() {
  return Object.entries(offer.plans).map(([id, p]) => ({
    id, label: `${p.name} — ${money(p.setupCents)} + ${money(p.monthlyCents)}/mies.`,
    values: {
      project_name: p.name,
      scope: `Pakiet ${p.name}: 1 polski numer, ${p.ivrOptions ? `menu IVR do ${p.ivrOptions} opcji, ` : ''}${p.scenarios ? `1 proces obsługi z wariantami rozmowy AI i bazą do ${p.faqAnswers} odpowiedzi związanych z tym procesem, na materiałach klienta, ` : ''}przyjmowanie połączeń krajowych i przekazywanie zgłoszeń zgodnie z zatwierdzonym zakresem. ${p.scenarios ? `Scenariusz obejmuje pytania pomocnicze, uzupełnianie brakujących danych i przekazanie sprawy do człowieka w ustalonym narzędziu, bez obietnicy płatnego przełączenia telefonicznego poza pakietem. Limit rozmowy AI: ${offer.billing.maxCallMinutes} minut. ` : ''}${p.ivrOptions ? `Limit przekierowania IVR: ${offer.billing.maxForwardedCallMinutes} minut.` : ''}`,
      deliverables: 'Konfiguracja, uzgodniony proces rozmowy lub menu, testy odbiorowe z klientem, instrukcja obsługi, lista kont i protokół przekazania. Dwie rundy uwag do scenariusza lub menu; usunięcie niezgodności z zakresem nie jest ograniczone liczbą rund. Dla AI: zebranie uzgodnionych pól i przekazanie podsumowania zgłoszenia do jednego narzędzia. Raport miesięcznego zużycia udostępniany klientowi; panel z kontem klienta jest odrębnym zakresem.',
      integrations: p.integrations ? '1 standardowa integracja, np. przekazanie zgłoszenia do e-mail, Telegrama lub arkusza. Konkretny odbiorca, zakres danych i uprawnienia wymagają wskazania w załączniku. Nowe API lub niestandardowy konektor: osobna wycena.' : 'Przekierowania krajowe zgodnie z zatwierdzonym menu; brak zewnętrznych integracji w pakiecie podstawowym.',
      exclusions: 'Dodatkowe numery, nowe scenariusze, niestandardowe integracje, kampanie wychodzące, numery premium i połączenia międzynarodowe. Każda rozbudowa wymaga wcześniejszej wyceny i akceptacji. Przeniesienie praw autorskich wymaga osobnego uzgodnienia.',
      setup_fee: money(p.setupCents),
      price_basis: 'brutto',
      deposit: `${money(p.setupCents / 2)} — 50% ceny przed rozpoczęciem prac, po zawarciu umowy`,
      payment_stages: `Pozostałe ${money(p.setupCents / 2)} po wyraźnym odbiorze wdrożenia.`,
      payment_days: String(offer.billing.paymentDays),
      monthly_fee: money(p.monthlyCents),
      billing_start: 'Od odbioru i aktywacji systemu. Kolejne miesięczne okresy liczone od dnia aktywacji, płatne z góry. Ostatni okres kończy się zgodnie z zasadami wypowiedzenia.',
      care_scope: 'Utrzymanie uzgodnionej konfiguracji, monitorowanie dostępności i błędów, kopie konfiguracji, obsługa usterek oraz drobne zmiany w limicie. Nowe funkcje i integracje wymagają odrębnego zamówienia. Usuwanie niezgodności z odebranym zakresem nie pomniejsza czasu drobnych zmian.',
      support_hours: 'Poniedziałek–piątek 9:00–17:00, Europe/Warsaw, z wyłączeniem polskich świąt.',
      support_channel: 'kontakt@dawkoz.com; temat: nazwa klienta, nazwa systemu i opis problemu.',
      response: 'Awaria krytyczna uniemożliwiająca podstawowe działanie: rozpoczęcie obsługi do 8 godzin roboczych. Pozostałe zgłoszenia: do 2 dni roboczych. To czas reakcji, nie gwarantowany termin naprawy. Termin i postęp naprawy komunikowane odrębnie.',
      change_hours: `${p.changeMinutes} minut miesięcznie, bez przenoszenia na następny okres; prace ponad limit ${money(offer.billing.extraWorkHourCents)}/godz. wyłącznie po akceptacji wyceny.`,
      minute_limit: String(p.minutes),
      sms_limit: String(p.smsParts),
      usage_alert: `${offer.billing.alertPercent}% i 100% miesięcznego limitu; e-mail do osoby wskazanej przez klienta.`,
      usage_metering: `Każde połączenie i każdy płatny odcinek przekierowania zaokrąglane osobno w górę do pełnej minuty. Przekierowanie może zużywać dwa odcinki równocześnie. SMS liczone w częściach według kodowania i długości, a nie liczby wiadomości. Dokończenie ostatniej przyjętej rozmowy do limitu ${offer.billing.maxCallMinutes} minut AI / ${offer.billing.maxForwardedCallMinutes} minut przekierowania IVR nie powoduje nieuzgodnionej dopłaty.`,
      limit_policy: 'Niewykorzystane minuty, części SMS i czas drobnych zmian nie przechodzą na kolejny okres. Po wyczerpaniu limitu nowe płatne rozmowy i SMS są wstrzymywane do pisemnej akceptacji dodatkowego budżetu. Nie uruchamia się nieuzgodnionych płatnych przekierowań. Raport zużycia dostępny dla klienta. Limity i powiadomienia muszą być skonfigurowane oraz przetestowane przed uruchomieniem.',
      extra_minute: money(id === 'ivr' ? offer.billing.ivrExtraMinuteCents : offer.billing.aiExtraMinuteCents),
      extra_sms: money(offer.billing.extraSmsPartCents),
      extra_budget: '0,00 zł; zwiększenie wymaga wyraźnej akceptacji kwoty i stawek przed naliczeniem dodatkowego zużycia.',
      maintenance: 'Planowane prace po wcześniejszym powiadomieniu, co do zasady co najmniej 2 dni robocze wcześniej. Pilne działania bezpieczeństwa komunikowane bez zbędnej zwłoki.',
      notice_period: 'Umowa utrzymania na czas nieoznaczony, wypowiedzenie z 30-dniowym wyprzedzeniem ze skutkiem na koniec miesięcznego okresu rozliczeniowego. Cena uzgodniona z klientem nie wzrasta automatycznie po zakończeniu oferty startowej; zmiana wymaga uzgodnienia stron. Przy umowie wdrożeniowej rozlicza się faktycznie wykonany, uzgodniony zakres i zaliczkę według umowy.',
      third_party: 'Koszt numeru, AI, telefonii i SMS w limitach ponosi Wykonawca w abonamencie. Rzeczywiste nazwy dostawców, regiony przetwarzania, konta i licencje należy wskazać przed podpisaniem dokumentów. Narzędzia i licencje klienta poza pakietem wymagają odrębnego uzgodnienia kosztów.',
      schedule: `Cel organizacyjny: do ${p.deliveryBusinessDays} dni roboczych od otrzymania zaliczki, kompletnych materiałów i dostępów. Termin potwierdzany w ofercie: analiza, konfiguracja, testy klienta i uruchomienie. Opóźnienia po stronie dostawców lub materiałów wymagają uzgodnienia nowej daty.`,
      review_days: '5',
      fix_days: 'Termin potwierdzany po ocenie uwag; plan poprawek przekazywany do 2 dni roboczych od kompletnego zgłoszenia.',
      launch: 'Wyraźny odbiór, zapłata zgodnie z umową, ustalone role i zasady przetwarzania danych oraz informacja dla rozmówców. Przed aktywacją: weryfikacja kosztów dostawców, test scenariusza, powiadomień 80%/100%, blokady nowego zużycia, raportu i odtworzenia konfiguracji. Nowe płatne funkcje uruchamiane wyłącznie po akceptacji.',
      criteria: 'Poprawne wykonanie zatwierdzonych scenariuszy, przekazanie zgłoszenia do ustalonego odbiorcy, bezpieczna obsługa braku danych i błędu integracji, czytelny raport zużycia oraz potwierdzony test limitów. Odbiór wymaga wyraźnego potwierdzenia, nie samego braku uwag.',
      backup: 'Codzienna kopia konfiguracji, retencja 7 dni; test odtworzenia przed uruchomieniem i po istotnych zmianach. Retencja danych rozmówców i nagrań wymaga osobnych ustaleń zgodnych z rzeczywistym przetwarzaniem.',
      channels: 'Ustalenia handlowe i odbiór: wskazani przedstawiciele stron przez uzgodnione adresy e-mail. Kontakt techniczny: Dawid Kozula, kontakt@dawkoz.com.',
    },
  }));
}
module.exports = { presets };
