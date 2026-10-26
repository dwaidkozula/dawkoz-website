# DAWKOZ — starter bota telefonicznego 0.1

Jedna firma / jedna instancja / SQLite / Twilio Gather + Say / klasyfikator OpenAI Responses / Telegram. **Pilotaż**, a nie cały pakiet handlowy DAWKOZ. Połączeń z prawdziwymi dostawcami nie zweryfikowano w środowisku autora. Domyślnie brak API i kosztów.

## Najpierw lokalnie

Node.js **24.19 lub nowszy 24.x**, terminal w tym folderze; brak zależności npm.

```
npm run init
npm test
npm run check
npm run demo
npm start
```

Otwórz `http://localhost:3001/demo`. Używaj fikcyjnych danych. Ctrl+C zatrzymuje serwer. Demo jest tekstowe, bez mikrofonu, telefonu i wysyłki Telegram. `npm run demo` wykonuje automatyczny przebieg na osobnej tymczasowej bazie, usuwanej po próbie. `npm start` przechowuje demo w `data/`. Po przerwaniu rozmowy demo nowa może być zablokowana przez rezerwację — do świeżej próby użyj osobnego DATA_DIR, nie kasuj bazy prawdziwego klienta.

Edytuj `config/client.json` i wykonaj restart. `npm run init` nie nadpisuje istniejących plików. Pola i FAQ są danymi właściciela firmy. Limit 1–6 pól, do20 FAQ, jedna równoczesna rozmowa. Potwierdzenie podsumowania tworzy zgłoszenie; bot nie rezerwuje terminu i nie ustala ceny. Prośba o człowieka kończy rozmowę bez przekierowania.

## Podłączenie telefonu — dopiero po przygotowaniu kont

Pełna polska instrukcja PDF i prywatny panel: `https://dawkoz.com/app/guide` (rozdział techniczny). Potrzebujesz własnych kont, numeru Twilio Voice, dostępu do modelu OpenAI API oraz prywatnego bota/odbiorcy Telegram. ChatGPT Plus nie opłaca API. Sprawdź taryfy wszystkich składników.

1. Wdrażaj **osobną usługę**, nigdy zamiast strony DAWKOZ. Dockerfile wybiera Node24; uruchom jedną replikę z trwałym volume `/data`, DATA_DIR=/data. Pierwszy start bez konfiguracji może się zatrzymać — uzupełnij Variables i ponów.
2. Nie wgrywaj .env, config/client.json ani data/. Ustaw zatwierdzoną zawartość całego JSON w `CLIENT_CONFIG_JSON` w Variables; ma pierwszeństwo przed plikiem. Dodaj pozostałe zmienne z .env.example jako sekrety na koncie.
3. `BOT_MODE=live`, `ALLOW_LIVE_CALLS=true`, `LIVE_TEST_ONLY=true`, `ALLOWED_CALLERS=+48...` (własny numer), PUBLIC_BASE_URL=rzeczywisty HTTPS bez ścieżki. Dwie jawne daty ISO ze strefą w BILLING_PERIOD_START/END; okres do40dni. Po końcu brak nowych rozmów, wymagane świadome odnowienie. ALLOW_LIVE_CALLS=false przy BOT_MODE=live uniemożliwia start.
4. W Twilio: przychodzące połączenia HTTP POST na `/voice/incoming`; status callback HTTP POST na `/voice/status`. Turn URL z nonce generuje aplikacja. Weryfikacja HMAC-SHA1 wymaga dokładnego publicznego URL, konta i numeru. Nie wyłączaj podpisów.
5. Sprawdź /healthz, co najmniej20 rozmów, faktyczny głos pl-PL/Polly.Ewa, koszty i rzeczywisty TimeLimit, callback końcowy, restart, awarie i limit. W live `/demo` jest niedostępne.
6. Dopiero po zgodzie klienta i spełnieniu kryteriów odbioru zdejmij testową listę przez LIVE_TEST_ONLY=false; to włącza ruch od dowolnych dzwoniących.

## Kolejka i rozliczenie

- Rezerwuje całe `ceil(maxCallSeconds/60)` minut przed przyjęciem (domyślnie5). Końcowe1–4 minuty pakietu mogą pozostać niewykorzystane. Zmiana na przyjmowanie do ostatniej minuty wymaga innego projektu licznika.
- Brak końcowego podpisanego callbacku zachowuje rezerwację i blokadę równoczesności; bez zwalniania na lokalny timeout. Po weryfikacji rekordu w Twilio uruchom **w tej samej instancji** `npm run reconcile -- CA...`. Narzędzie odczytuje zakończony rekord od dostawcy, nie ufa wpisanemu ręcznie czasowi.
- Status końcowy rozlicza minuty z zaokrągleniem w górę. Faktyczny czas może przekroczyć rezerwację: zostanie uwzględniony i może zablokować nowe rozmowy. Nie jest automatyczną dopłatą klienta.
- Stan `working` ponowionej tury nie wywołuje drugi raz AI; po awarii taka tura kończy się kontrolowanie. Nie ma wznawiania rozmowy po restarcie. Konfigurację zmieniaj po zakończeniu ruchu.
- `npm run status`: zużycie i zagregowane stany, bez treści spraw. `npm run jobs`: ID i stany. Serwer automatycznie obsługuje pending/retry; polecenie jobs tylko odczytuje listę.
- Telegram timeout/5xx/niepewna odpowiedź → unknown bez automatycznego powtórzenia. Awaria procesu przy sending → unknown po restarcie. HTTP429 → retry. 4xx → failed. Po ręcznym sprawdzeniu czatu: `npm run jobs -- --delivered ID` albo `npm run jobs -- --retry ID` (może spowodować duplikat, jeśli błędnie oceniono czat). Nie ma gwarancji exactly-once.
- `npm run telegram:chat-id` odczytuje ID prywatnych czatów po wysłaniu /start. Nie usuwa istniejącego webhooka i nie drukuje tokenu. Ta wersja narzędzia nie wybiera grup.

## Dane i ograniczenia

Baza wiązana z clientId+companyName: kolejna firma wymaga nowego dysku, numeru, instancji, sekretów i odbiorcy. Nie zmieniaj właściciela istniejącej bazy. Brak kont klientów i portalu, SMS, IVR, nagrań, przekierowania do pracownika, automatycznych alertów80/100%, panelu administracji bota, fakturowania, OCR i KSeF. Nie sprzedawaj tego jako kompletnej realizacji oferty699zł/mies. Brak gwarancji jakości rozpoznawania, czasu odpowiedzi i zgodności treści modelu.

Treść zgłoszeń i stanu rozmowy jest czyszczona po domyślnie7dniach, najpóźniej przy kolejnym czyszczeniu co godzinę (lub `npm run cleanup`). Metadane zakończonych połączeń/ID/statusy zostają do400dni; uzgodnij zasadność i skróć ten okres przed użyciem rzeczywistych danych. Nierozliczone połączenia pozostają do wyjaśnienia. Telegram, dostawcy, logi infrastruktury i kopie mają osobne reguły retencji — czyszczenie SQLite ich nie usuwa. `store:false` w API nie oznacza braku całej retencji po stronie dostawcy. Nie zbieraj danych zdrowotnych, kart, haseł ani innych danych wrażliwych.

Przed prawdziwym ruchem: ustal administratora i sprzedawcę, umowy powierzenia, podwykonawców, podstawę i zakres przetwarzania, informację dla dzwoniącego, retencję, backup, odtworzenie i koszty. Serwer nie nagrywa audio; transkrypcja jest przetwarzana przez Twilio i OpenAI. Akceptacja limitu API/UI ani HTTP200 nie jest gwarancją twardego limitu kosztu. Ten pilot wymaga pomiaru i uzupełnienia przed produkcją.
