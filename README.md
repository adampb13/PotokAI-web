### PotokAI
Lekki interfejs webowy typu local-first oraz backend zaprojektowany do interakcji z lokalnymi modelami dużych języków (LLM) za pośrednictwem Ollama. Aplikacja, zbudowana w oparciu o Node.js i Express, udostępnia uporządkowane API oraz responsywny interfejs klienta do lokalnej inferencji LLM, śledzenia zasobów systemowych, wstrzykiwania kontekstu z plików oraz obsługi wyszukiwania sieciowego.

### Przegląd Techniczny
PotokAI opiera się na klasycznej architekturze klient-serwer. Backend zarządza stanem procesu lokalnego, integruje się z API Ollama, obsługuje wieloczęściowe przesyłanie plików (multipart upload) oraz przesyła strumieniowo odpowiedzi modelu za pomocą technologii Server-Sent Events (SSE). Frontend wykorzystuje czysty (vanilla) JavaScript i CSS do renderowania historii konwersacji sformatowanej w Markdown oraz wskaźników telemetrii w czasie rzeczywistym.

server.js - Backend Express, obsługa tras i integracja z Ollama
config.json - Konfiguracja aplikacji i parametry modelu
package.json - Metadane projektu i zależności
README.md - Dokumentacja
index.html - Interfejs użytkownika, logika kliencka i silnik renderowania
uploads - Tymczasowy magazyn kontekstu dokumentów

### Kluczowe Funkcje
Integracja z LLM: Bezpośrednia komunikacja z lokalnymi instancjami Ollama z obsługą strumieniowania odpowiedzi w czasie rzeczywistym.

Wsparcie dla kontekstu i pobierania danych: Narzędzia do iniekcji dokumentów pozwalające na dołączanie kontekstu plików bezpośrednio do aktywnej sesji roboczej.

Wzbogacanie danych z sieci: Zintegrowana otoczka (wrapper) API DuckDuckGo umożliwiająca modelowi wykonywanie ukierunkowanych zapytań zewnętrznych na podstawie słów kluczowych.

Telemetria systemowa: Endpointy działające w tle, monitorujące zużycie pamięci RAM systemu oraz VRAM kart graficznych NVIDIA.

Strojenie parametrów generacji: Konfigurowalne w czasie rzeczywistym parametry generacji tekstu, w tym temperatura, Top P oraz Top K.

### Wymagania Wstępne
Node.js (wersja 18 lub nowsza)

Ollama zainstalowana i uruchomiona lokalnie (ollama serve)

Karta graficzna NVIDIA (opcjonalnie, zalecana do przyspieszenia generacji tokenów przez CUDA)

### Instalacja i Konfiguracja
Przejdź do katalogu projektu:

cd PotokAI
Zainstaluj zależności Node.js:

npm install
Zweryfikuj ustawienia w pliku konfiguracyjnym (config.json):

JSON
{
  "model": "qwen2.5-coder:7b",
  "temperature": 0.2
}
Upewnij się, że lokalny demon Ollama jest aktywny, i pobierz model:

ollama pull qwen2.5-coder:7b
Uruchamianie Aplikacji
Uruchom serwer Express za pomocą środowiska Node.js:

node server.js
Po uruchomieniu serwera otwórz interfejs użytkownika w przeglądarce pod adresem:
http://localhost:3000

### Endpointy API
POST /chat
Wysyła zapytanie i parametry generacji do aktywnego modelu.

Payload: {"prompt": "string", "temperature": float, "topP": float, "topK": int}

Odpowiedź: Strumień tekstowy w formacie Server-Sent Events (SSE).

POST /upload
Przesyła dokument referencyjny w celu dołączenia go do aktywnego okna kontekstu.

Payload: FormData zawierający docelowy plik (file).

POST /reset
Czyści aktywną historię wiadomości oraz usuwa tymczasowe pliki kontekstowe.

GET /api/info
Zwraca ogólny status serwera oraz konfigurację aktywnego modelu.

GET /api/memory
Pobiera aktualne dane telemetryczne dotyczące zużycia pamięci RAM, dostępnego VRAM oraz licznik elementów w aktywnej sesji kontekstowej.
