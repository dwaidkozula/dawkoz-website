# Audyt informacji prawnych DAWKOZ

Zakres: kod strony, teksty publiczne, mechanizmy prywatnego panelu dokumentów i publiczny pokaz panelu klienta. Nie jest to potwierdzenie pełnej zgodności prawnej całej działalności ani przegląd umów zawartych z dostawcami. Nie zweryfikowano danych rejestrowych sprzedawcy, rachunku, podatków, dostawców ani konfiguracji kont usługowych.

## Wniosek

Informacje o prywatności były niezgodne z aktualnym działaniem aplikacji: twierdziły, że nie ma cookies i kont, mimo prywatnego logowania operatora. Opisy rozliczeń przypisywały Kozbud wystawianie faktur, choć nie potwierdzono rzeczywistego modelu współpracy i zgody tej firmy. Te twierdzenia usunięto lub poprawiono. Dane kontaktowe marki nie wystarczają do wskazania sprzedawcy i administratora danych.

Dokumenty pozostają wyraźnie oznaczonymi projektami i mają `noindex`. Nie można rzetelnie nazwać polityki prywatności kompletną, dopóki nie zostaną uzupełnione rzeczywiste informacje o administratorze, dostawcach, retencji i transferach. Jest to brak wymagający uzupełnienia teraz, ponieważ strona już przyjmuje wizyty i umożliwia korespondencję, a nie dopiero przy uruchomieniu pierwszego bota.

## Zmiany w tej aktualizacji

- Usunięto z trzech dokumentów niepotwierdzony adres kontaktowy ul. Wolności 123 oraz twierdzenia, że Kozbud jest zatwierdzonym wystawcą faktur. Usunięto NIP z publicznych dokumentów; NIP Kozbud nie identyfikuje Dawida Kozuli ani samej marki.
- Wyraźnie oddzielono markę DAWKOZ, osobę kontaktową Dawida Kozulę, rzeczywistego sprzedawcę i administratora danych. Nie dopisano zgody ani roli innej firmy.
- Opisano cookie `dawkoz_panel_session` dla operatora `/app`: maksymalnie 8 godzin, Path `/app`, HttpOnly, SameSite=Strict i Secure w produkcji. Wylogowanie usuwa cookie i sesję; restart unieważnia sesje. Dodano cel zabezpieczania panelu i ograniczania logowań.
- Zachowano zgodny z kodem opis preferencji `dawkoz-language` i `dawkoz-pause-motion` w localStorage. Są ustawieniami użytkownika, bez dodanej analityki lub pikseli reklamowych w kodzie.
- Uściślono, że publiczne linki kontaktowe otwierają pocztę. Wpisy w dokumentach i wczytane projekty nie są wysyłane na serwer; pobrane pliki wymagają ochrony na urządzeniu użytkownika.
- Oddzielono prywatny panel operatora od publicznego pokazu panelu klienta. Pokaz ma wyłącznie dane przykładowe i stan w pamięci karty; nie jest klientowskim kontem produkcyjnym ani skrzynką na rzeczywiste dokumenty.
- Poprawiono opis OVHcloud na usługi domeny/poczty, bez twierdzenia, że strona działa na jego hostingu. Dodano rolę Cloudflare zależną od konfiguracji DNS/proxy. Hosting strony wskazano jako Railway, pocztę odbiorczą jako Google Gmail. Szczegóły prawnych podmiotów, regionów i umów wymagają potwierdzenia.
- Warunki odsyłają do aktualnego cennika, bez kopiowania cen do osobnej, szybko dezaktualizującej się tabeli. Wyraźnie mówią o kwotach końcowych z VAT, jeśli należny, i o potwierdzeniu ceny „od” przed umową.
- Dodano konieczność informowania rozmówcy o AI, odrębnego ustalenia zasad nagrywania/transkrypcji oraz kontroli błędów. Samo połączenie nie oznacza zgody na dowolne wykorzystanie rozmowy.
- Doprecyzowano, że odczyt faktury przez AI nie oznacza poprawnego księgowania, przesłania do KSeF ani akceptacji płatności.
- Dodano 28 nowych akapitów w 11 językach w kluczach `legal.v2.*`. Stare klucze pozostają dla zgodności pozostałych tekstów, lecz zastąpione akapity nie są wykorzystywane w aktualnych dokumentach.

## Fakty potwierdzalne w kodzie

| Obszar | Stan |
| --- | --- |
| Analityka / reklama | W publicznym kodzie nie dodano analityki, pikseli ani reklamowych cookies. Zachowanie zewnętrznego hostingu/CDN wymaga sprawdzenia konfiguracji. |
| Publiczny kontakt | Linki `mailto`, bez automatycznego wysyłania wiadomości przez aplikację. Kopiowanie tylko zapisuje jawny adres do schowka. |
| Dokumenty | Operator wypełnia je lokalnie; eksport DOCX/PDF/JSON. Brak serwerowego magazynu projektów klienta. |
| Sesje operatora | Losowy token, hash w pamięci procesu, do 8 godzin, brak kont klientów. |
| Próby logowania | Limit 5 prób w 15 minut na adres połączenia. Za proxy adres może być wspólny. |
| Sekrety | Hasło panelu pobierane ze zmiennej środowiskowej, bez ujawniania użytkownikowi. |
| Pokaz panelu klienta | Dane demonstracyjne; nie zastępuje autoryzowanego, wieloklientowego systemu. |

## Informacje wymagające rzeczywistego uzupełnienia

1. Administrator strony i korespondencji: pełne oznaczenie, adres i faktyczna odpowiedzialność. Jeśli dane ma przetwarzać więcej podmiotów, określić ich role.
2. Sprzedawca i wykonawca: kto podpisuje umowę, odpowiada za usługę, przyjmuje zapłatę i wystawia fakturę; upoważnienia i podstawa współpracy. Potwierdzić właściwe dane rejestrowe i status VAT. Nie stosować modelu „pożyczenia faktury”.
3. Właściwe jednostki prawne Railway, OVHcloud, Google i Cloudflare oraz zakres używanych usług, region przetwarzania, umowy powierzenia, dalsi podwykonawcy i ewentualne transfery poza EOG wraz z podstawą i zabezpieczeniami. Nie wystarczy ogólne stwierdzenie „dostawcy mają RODO”.
4. Konkretne okresy lub dostatecznie określone kryteria retencji korespondencji, logów, kopii i dokumentacji. Usuwanie musi działać w rzeczywistej konfiguracji; nie należy wpisywać przypadkowych liczb, których nikt nie egzekwuje.
5. Tryb reklamacji, terminy, odpowiedzialność, zakończenie współpracy i przekazanie danych w umowie konkretnego sprzedawcy. Jeśli klient ma uprawnienia konsumenckie, nie można ich wyłączyć samą etykietą B2B.
6. Przy prawdziwym botcie: odpowiednia umowa powierzenia, cele i kategorie danych, minimalizacja, dostawcy, dostęp operatorów, informacja dla rozmówców, nagrywanie/transkrypcja tylko po ustaleniu podstawy i retencji, obsługa incydentów i praw osób.
7. Przy prawdziwym panelu klientów: osobne konta i izolacja firm, role, bezpieczne resetowanie dostępu, baza i retencja danych, kopie zapasowe z testem odtworzenia, dziennik działań, ograniczenie eksportu i transmisja tylko niezbędnych danych do zatwierdzonych dostawców. Demonstracji nie wolno przedstawiać jako gotowej ochrony rzeczywistych danych.
8. Przy automatyzacji faktur: uprawnienia do dokumentów i ich odczytu, weryfikacja przez człowieka, obsługa błędnych pól i duplikatów, zgodność z systemem księgowym i ewentualnym KSeF. Integracja z księgowością/KSeF wymaga osobnego zakresu i testów.

## Czego audyt nie potwierdza

Nie potwierdzono certyfikacji, audytu prawnika, zgodności organizacyjnej całego procesu, umów z dostawcami, uprawnień Kozbud, działania produkcyjnego silnika AI, izolacji rzeczywistych firm, retencji po stronie dostawców ani ceny dostawców. Poprawny interfejs i nagłówki HTTP nie zastępują tych ustaleń.
