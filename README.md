# DAWKOZ

Strona firmowa obsługiwana przez serwer statyczny Node.js. Wymagany Node.js 20 lub nowszy; brak zależności npm i kroku budowania.

## Film demonstracyjny

Sekcja „Wdrożenie” zawiera 25-sekundową animację przykładowego zgłoszenia: połączenie, rozmowa z AI, zebranie danych i przekazanie sprawy zespołowi. Film ma napisy, nie zawiera ścieżki dźwiękowej i uruchamia się po kliknięciu. Odtwarzacz początkowo pobiera tylko miniaturę.

Gotowe pliki znajdują się w `public/media/` (MP4 H.264, 1920 × 1080, 30 kl./s oraz miniatura WebP). Samodzielne, edytowalne źródło animacji jest w `design/dawkoz-demo.html`; można je otworzyć w przeglądarce. Wdrożenie korzysta z gotowego MP4 i nie wymaga renderowania filmu ani dodatkowych zależności. Serwer obsługuje zakresy bajtów do odtwarzania i przewijania wideo.

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
