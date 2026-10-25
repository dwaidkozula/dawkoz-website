# DAWKOZ

Strona firmowa z prywatnym panelem dokumentów, obsługiwana przez serwer Node.js. Wymagany Node.js 20 lub nowszy; brak zależności npm i kroku budowania.

## Oferta startowa

Warunki w `commercial/offer.json` są decyzją cenową DAWKOZ, nie zestawieniem stawek konkurencji. Kwoty są cenami końcowymi do zapłaty, z VAT w cenie, jeżeli jest należny. Faktyczny status VAT sprzedawcy nadal wymaga potwierdzenia w umowie i na fakturze.

| Pakiet | Wdrożenie od | Abonament | Minuty / części SMS | Drobne zmiany |
| --- | ---: | ---: | --- | --- |
| IVR Start | 990 zł | 249 zł/mies. | 100 / 0 | 15 min/mies. |
| Bot telefoniczny AI | 2990 zł | 699 zł/mies. | 200 / 50 | 30 min/mies. |
| Bot + centrala | 3990 zł | 899 zł/mies. | 250 / 100 | 60 min/mies. |

Warunki startowe dotyczą trzech nowych wdrożeń AI, z dostępnością potwierdzaną w indywidualnej ofercie. Nie ma automatycznego licznika miejsc. Po ich wykorzystaniu należy zmienić ofertę dla nowych klientów; podpisane umowy nie zmieniają ceny automatycznie. Zakres podstawowy AI: jeden proces z wariantami rozmowy, do 20 uzgodnionych odpowiedzi związanych z procesem na materiałach klienta, zebranie danych i podsumowanie przekazane do jednej standardowej integracji biznesowej. Telefonia, AI i SMS w limitach nie są kolejnymi integracjami. Testy z klientem, dwie rundy uwag i instrukcja są częścią wdrożenia; konto w panelu klienta osobno. Strona od 1990 zł: jedna strona do sześciu sekcji i jeden język. Automatyzacja od 990 zł: jeden proces do dwóch aplikacji. Opcjonalna opieka WWW od 149 zł/mies. i automatyzacji od 399 zł/mies.; domeny, hosting WWW i licencje klienta osobno.

Przykłady automatyzacji mają określony zakres: zapytania od 990 zł (jedno źródło i jedno miejsce docelowe), przypomnienia od 1490 zł (jedno źródło, jeden kanał, jedna reguła) i faktury do weryfikacji od 1990 zł (jedna skrzynka, jeden uzgodniony typ tekstowego PDF, do pięciu pól, arkusz do sprawdzenia przez człowieka). OCR skanów, automatyczne księgowanie i KSeF nie są częścią tego zakresu. Kwoty i założenia pracy są w `commercial/offer.json`; teksty jedenastu wersji w `commercial/automation-copy.json`, a fragment w `commercial/automation.html`.

Zwiększenie bota do 200 minut nie jest oparte na taryfie dostawcy: przy progu 1,20 zł/min, VAT 23%, pracy i rezerwie pozostaje 148,29 zł miesięcznej nadwyżki przed PIT/CIT/ZUS i kosztami ogólnymi; przy kosztach zmiennych wyższych o 50% tylko 20,79 zł. Zestaw 899 zł/250 minut pozostaje bez zwiększenia (175,89 zł / 10,89 zł). Nie oferować podwojenia limitów bez pomiaru kosztów. Szacunek czasu wdrożenia AI zwiększono do 16/20 godzin, uwzględniając ustalenie bazy odpowiedzi.

Zużycie ponad pakiet wymaga akceptacji: domyślny dodatkowy budżet 0 zł, IVR 1,49 zł/min, AI 2,49 zł/min, SMS 0,69 zł/część. Prace dodatkowe 160 zł/godz. po akceptacji wyceny. Minuty liczone osobno i zaokrąglane w górę na każdym płatnym odcinku; dłuższe SMS i kodowanie mogą zwiększać liczbę części. Maksymalny czas rozmowy: 5 min AI, 15 min przekierowania IVR. Ostatnia przyjęta rozmowa kończy się w tym limicie bez nieuzgodnionej dopłaty. Limity i czas zmian nie przechodzą na kolejny miesiąc. Wsparcie pon.–pt. 9–17 czasu polskiego poza świętami; reakcja krytyczna do 8 godzin roboczych, pozostała do 2 dni roboczych. Nie jest to gwarantowany termin naprawy.

**Ważny zakres implementacji:** ta zmiana publikuje ofertę i przygotowuje dokumenty. Repozytorium nie zawiera silnika bota, integracji Twilio/OpenAI/SMSAPI, liczników rozmów, alertów ani blokady wydatków dostawcy. Ich konfiguracja i test są warunkiem aktywacji klienta. Uzgodnienie w dokumencie nie jest zabezpieczeniem technicznym.

`commercial/costs.js` liczy scenariusze w groszach. Założenia kosztu 0,60 zł/min IVR, 1,20 zł/min AI z telefonią, 0,30 zł/część SMS, koszt pracy 100 zł/godz. i budżet infrastruktury są **niezweryfikowanymi progami planowania**, nie taryfami dostawców. Model uwzględnia VAT 23%, pracę i rezerwę; nadwyżka jest przed PIT/CIT, ZUS i innymi kosztami ogólnymi. Faktyczne koszty, dostępność numeru i mechanizmy limitów należy potwierdzić przed podpisaniem oferty. Przy przekroczeniu progu zmienić technologię lub ofertę przed zawarciem umowy.

Po zmianie konfiguracji zaktualizuj materiały:

```sh
node scripts/sync-offer.cjs
node scripts/sync-automations.cjs
python scripts/export-documents.py
python scripts/export-commercial.py
npm test
```

Pierwsze dwa polecenia aktualizują statyczną stronę, jedenaście katalogów językowych, konkretne automatyzacje i pakiety w bibliotece. `commercial/copy.json` zawiera teksty handlowe, a `commercial/credibility-copy.json` etykiety demonstracji i zasad współpracy. Usunięto historyczne, nieużywane `pricing.js` i `trust.js` oraz niepotwierdzone statystyki opinii i adresów. `export-commercial.py` wymaga deweloperskich bibliotek `reportlab`, `python-docx` i `openpyxl`; zapisuje ofertę, plan wewnętrzny, Excel/CSV i trzy projekty JSON do `/workspace/exports/dawkoz-oferta-startowa`, a obok tworzy ZIP. Przy innym checkoutcie katalog docelowy można podać jako pierwszy argument. Uruchomienie strony nie wymaga tych bibliotek.

## Demonstracja panelu klienta

`/panel-klienta.html` to publiczny, polskojęzyczny demonstrator na fikcyjnych danych, oznaczony `noindex`. Zakładki zapytań, dokumentów i zużycia działają w przeglądarce: filtrowanie, szczegóły, statusy, oznaczenie dokumentu jako sprawdzonego i eksport widocznych spraw do CSV. Eksport chroni przed formułami arkusza. Stan jest wyłącznie w pamięci karty, resetuje się po przeładowaniu; brak kont, wysyłania, wczytywania plików klientów i localStorage. Nie są to dane z telefonii, OCR, KSeF ani księgowości. Przy braku JS strona podaje informację o potrzebnej obsłudze i kontakt.

Realny panel dla firm wymaga osobnego zakresu: kont i odzyskiwania dostępu, izolacji klientów, trwałej bazy, uprawnień, kopii i odtworzenia, retencji, dziennika zmian i integracji z rzeczywistymi źródłami. Biblioteki operatora `/app` nie można użyć jako wspólnego konta klientów. Można wykorzystać działający serwer jako punkt startu i później dodać PWA, co unika osobnej aplikacji sklepowej; nie oznacza to darmowej infrastruktury ani gotowej aplikacji produkcyjnej. Demo nie uruchamia nowej płatnej usługi.

## Audyt informacji prawnych

Poprawiono trzy podstrony prawne i ich tłumaczenia, m.in. cookie sesji operatora, localStorage preferencji, kontakt e-mail, stan danych w edytorze i syntetyczne demo. Nie przypisuje się Kozbud odpowiedzialności ani wystawiania faktur bez ustalenia modelu współpracy. Pełna tożsamość administratora danych i rzeczywistego sprzedawcy, podstawa współpracy, dane rejestrowe, status VAT oraz dostawcy i retencja nadal wymagają potwierdzenia. To jawny brak, nie dowód kompletnej zgodności RODO. Szczegóły w `docs/audyt-prawny.md`.

## Wersje językowe

Przełącznik z flagami jest dostępny na stronie głównej i trzech podstronach dokumentów. Języki są uporządkowane alfabetycznie według polskich nazw: angielski, francuski, hiszpański, niemiecki, norweski, polski, portugalski, rosyjski, szwedzki, ukraiński i włoski.

Adres `/?lang=en` otwiera wersję angielską; pozostałe kody to `fr`, `es`, `de`, `no`, `pl`, `pt`, `ru`, `sv`, `uk` i `it`. Domyślny język to polski. Tłumaczenia są renderowane przez serwer, więc odnośniki językowe działają także bez JavaScriptu. Skrypt zapamiętuje wybór w localStorage (`dawkoz-language`), przywraca go podczas kolejnej wizyty i zachowuje bieżącą sekcję przy zmianie języka. Niedostępność localStorage nie blokuje przełączania. Kwoty pozostają w PLN.

`i18n.js` łączy polskie teksty HTML z katalogami `locales/*.json`. Przy zmianie treści należy uaktualnić odpowiadający jej wpis w `pl.json` i pozostałych katalogach, zachowując istniejące klucze. `ui.json` zawiera etykiety funkcji interaktywnych. Dokumenty zachowują status projektu i `noindex` we wszystkich językach. Flagi SVG pochodzą z `country-flag-icons` 1.6.20, na licencji MIT zachowanej w `public/flags/LICENSE.txt`; nie wymagają zależności ani zewnętrznych żądań.

## Prywatny panel dokumentów

Wejście do panelu znajduje się w menu strony jako „Panel DAWKOZ” (na telefonie po rozwinięciu menu), a także w stopce jako „Dokumenty i umowy”. Oba odnośniki prowadzą przez logowanie; dokumenty pozostają prywatne.

Panel jest dostępny pod `/app` (biblioteka po zalogowaniu: `/app/documents`). Zawiera 12 polskich wzorów B2B: ofertę, umowę wdrożeniową, zakres prac, protokół odbioru, umowę opieki, powierzenie danych, NDA, przekazanie systemu, brief, informację dla rozmówców AI, przeniesienie praw i kartę DAWKOZ–Kozbud. Wzory są projektami do dostosowania; nie potwierdzają danych firmy, limitów ani zgody właściciela Kozbud.

### Aktywacja w Railway

W zmiennych **usługi Railway**, która uruchamia tę stronę, ustaw `DAWKOZ_PANEL_PASSWORD` na własne, silne hasło o długości od 16 do 256 znaków i wdroż zmianę. Nie zapisuj hasła w repozytorium ani w dokumentach i nie wysyłaj go w rozmowie. To zmienna aplikacji, nie klucz wysyłany do zewnętrznego dostawcy. Bez niej lub z hasłem krótszym niż 16 znaków logowanie pozostaje wyłączone; dokumenty i API są niedostępne. Publiczna strona działa niezależnie. Zmiana hasła wymaga restartu procesu i unieważnia dotychczasowe sesje.

Panel obsługuje jednego operatora. Sesje są losowe, przechowywane w pamięci procesu, ważne 8 godzin; cookie jest HttpOnly, SameSite=Strict i w produkcji Secure. Wylogowanie unieważnia sesję. Wiele replik wymaga wspólnego magazynu sesji lub przywiązania sesji do instancji. Ograniczanie prób logowania korzysta z adresu połączenia, bez ufania nagłówkom klienta; za proxy może obejmować wspólny adres. Nie należy udostępniać tego hasła klientom jako konta wieloużytkownikowego.

### Korzystanie

Wybierz wzór, uzupełnij pola i pobierz prawdziwy plik DOCX. Przycisk „Drukuj / zapisz PDF” otwiera drukowanie przeglądarki z samym dokumentem, bez panelu. Puste PDF/DOCX oraz ZIP są przygotowane z góry i dostępne po logowaniu. „Zapisz projekt” pobiera JSON; „Wczytaj projekt” przywraca go w panelu. Pola pozostają w pamięci karty, bez automatycznego zapisu w localStorage i bez wysyłania danych klientów na serwer. Pobrane pliki zawierające dane klienta należy chronić na urządzeniu użytkownika.

W ofercie, umowie wdrożeniowej, załączniku zakresu i umowie opieki można wybrać pakiet IVR / AI / Bot + centrala i jawnie zastosować warunki. Ceny i limity są uzupełniane dopiero po naciśnięciu „Ustaw warunki”; sama zmiana wyboru niczego nie nadpisuje. Dane stron, konto i wpisany status VAT pozostają bez zmian. Przy zastępowaniu wcześniej zmienionych warunków jest potwierdzenie. Kwota abonamentu w nowym pustym wzorze nie jest domyślnie przypisana do każdego rodzaju projektu. Gotowe pliki `projekt-*.json` z pakietu handlowego można wczytać jako punkt startowy oferty. Nie wpisują tożsamości klienta ani wykonawcy i nie potwierdzają statusu podatkowego; pusty wzór nie wpisuje też domyślnie NIP Kozbud. Dokumenty są wersją 1.2.

Źródłem treści jest `documents/catalog.json`. Pliki `documents/generated/` oraz kod i HTML panelu leżą poza `public`; serwer udostępnia je wyłącznie przez wskazane trasy `/app`. Udostępniany bez logowania arkusz CSS nie zawiera dokumentów. API nie przyjmuje danych projektów. Dla publicznej witryny zachowano odrębną politykę CSP i blokadę metod zapisu.

Do odtworzenia pustych PDF/DOCX na maszynie deweloperskiej użyj `python scripts/export-documents.py` (potrzebne `reportlab`, `python-docx` i fonty DejaVu Sans). Gotowe pliki są w repozytorium; aplikacja Node.js nadal nie wymaga zależności npm ani generowania PDF podczas wdrożenia. Po zmianie wzorów odtwórz pliki i sprawdź ich zgodność. Testy obejmują logowanie, zamknięcie dostępu bez konfiguracji, ciasteczka sesji, CSRF, ograniczenie prób, wylogowanie, prywatne pobieranie, integralność katalogu i eksport OOXML.

## Film demonstracyjny

Sekcja „Wdrożenie” zawiera 25-sekundową animację przykładowego zgłoszenia: połączenie, rozmowa z AI, zebranie danych i przekazanie sprawy zespołowi. Film ma napisy, nie zawiera ścieżki dźwiękowej i uruchamia się po kliknięciu. Odtwarzacz początkowo pobiera tylko miniaturę.

Gotowe pliki znajdują się w `public/media/` (MP4 H.264, 1920 × 1080, 30 kl./s oraz miniatura WebP). Samodzielne, edytowalne źródło animacji jest w `design/dawkoz-demo.html`; można je otworzyć w przeglądarce. Wdrożenie korzysta z gotowego MP4 i nie wymaga renderowania filmu ani dodatkowych zależności. Serwer obsługuje zakresy bajtów do odtwarzania i przewijania wideo.

Film zachowuje polskie napisy w obrazie. Dodatkowe ścieżki WebVTT w `public/media/subtitles/` opisują pięć etapów w każdym obsługiwanym języku; w obcych wersjach strony odpowiednia ścieżka jest domyślnie włączona. Opis pod filmem również jest przetłumaczony.

## Uruchomienie i testy

```sh
npm test
npm start
```

Serwer używa zmiennej `PORT`, domyślnie 3000. Testy sprawdzają m.in. ochronę przed odczytem plików spoza `public`, obsługę błędnych żądań, nagłówki ochronne i przekierowanie HTTPS.

## Publikacja w Railway

1. W ustawieniach usługi sprawdź repozytorium `dwaidkozula/dawkoz-website`, gałąź wdrażaną przez Railway i polecenie startowe `npm start`.
2. Jeśli usługa wdraża `main` automatycznie, wysłanie nowego commita do tej gałęzi uruchamia wdrożenie. W przeciwnym razie wybierz odpowiednią wersję w panelu Railway i uruchom wdrożenie.
3. W sekcji Networking / Custom Domains sprawdź podpięcie `dawkoz.com`. Jeżeli używasz również `www.dawkoz.com`, sprawdź tę nazwę oddzielnie.
4. Porównaj rekordy DNS w OVHcloud z wartościami wyświetlanymi przez Railway dla każdego hosta. Użyj dokładnych rekordów i celów z panelu, zamiast zgadywać adres IP lub cel CNAME. Zachowaj rekordy dotyczące poczty i jej przekierowania.
5. Sprawdź w Railway status weryfikacji domeny i wystawienia certyfikatu. Certyfikat musi obejmować każdą nazwę używaną do wejścia przez HTTPS.
6. Otwórz `https://dawkoz.com/`, sprawdź ważność certyfikatu i brak błędów połączenia. Wejście przez HTTP powinno kierować na HTTPS. Sprawdź również HTTPS dla `www`, jeśli ta nazwa jest udostępniana.

Railway obsługuje certyfikat i zakończenie połączenia TLS. Serwer aplikacji działa za jego proxy. W trybie produkcyjnym (`NODE_ENV=production` lub obecność `RAILWAY_ENVIRONMENT_ID`) żądania oznaczone przez proxy jako HTTP są przekierowywane na `https://dawkoz.com`; żądania HTTPS otrzymują HSTS na 24 godziny. Bez nagłówka protokołu serwer obsługuje lokalne i wewnętrzne żądania HTTP. HSTS nie obejmuje subdomen.

Nagłówki aplikacji nie zastępują poprawnego certyfikatu. Ustawianie własnego certyfikatu w Node.js nie jest wymagane przy zakończeniu TLS w Railway.

## Ostrzeżenia przeglądarki

| Komunikat | Co sprawdzić |
| --- | --- |
| „Niezabezpieczona” przy adresie `http://` | Dostęp przez HTTPS i przekierowanie HTTP w działającym wdrożeniu. |
| `ERR_CERT_COMMON_NAME_INVALID` | Czy certyfikat obejmuje dokładną nazwę z adresu, w tym wariant z `www`, oraz czy DNS wskazuje właściwą usługę. |
| `ERR_CERT_DATE_INVALID` | Daty ważności certyfikatu oraz datę i godzinę na urządzeniu użytkownika. |
| `ERR_CERT_AUTHORITY_INVALID` | Łańcuch certyfikatu; porównaj połączenie na innym urządzeniu i w innej sieci. |
| `ERR_SSL_PROTOCOL_ERROR` | Czy domena trafia do punktu wejścia HTTPS Railway i czy jej konfiguracja jest zakończona. |

Do diagnozy potrzebne są dokładny adres i treść ostrzeżenia. Projekty dokumentów prawnych w stopce wymagają jeszcze potwierdzenia oznaczonych danych biznesowych i ustawień dostawców.
