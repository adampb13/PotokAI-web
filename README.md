# 🌊 PotokAI - Lokalny Agent AI

Interaktywny interfejs webowy do lokalnego modelu AI oparty na Ollama. Zapewnia pełne możliwości czatowania z zaawansowanymi parametrami modelu, monitorowaniem zasobów i obsługą przesyłania plików.

## ✨ Główne Funkcje

- 🤖 **Czat z lokalnym modelem AI** - Streaming odpowiedzi w czasie rzeczywistym
- 🎛️ **Zaawansowane parametry** - Temperatura, Top P, Top K z presetami (Precyzyjny, Zbalansowany, Kreatywny)
- 💾 **Monitorowanie zasobów** - Śledzenie wykorzystania RAM i VRAM
- 📁 **Zarządzanie plikami** - Przesyłanie plików do kontekstu z wyświetlaniem listy
- 📝 **Formatowanie Markdown** - Piękne renderowanie odpowiedzi z podświetlaniem kodu
- ♿ **Dostęp do internetu** - Wyszukiwanie sieciowe (DuckDuckGo API)
- ⌨️ **Wygodne sterowanie** - Enter wysyła wiadomość, kontrola z UI

---

## 📋 Wymagania

### Systemu
- **Node.js** v18+ ([pobierz](https://nodejs.org/))
- **Ollama** - Lokalne środowisko AI ([pobierz](https://ollama.ai))
- **Windows 10+** (lub Linux/macOS)

### Modele AI
- Zainstalowany model w Ollama, np.:
  ```bash
  ollama pull huihui_ai/qwen2.5-coder:7b
  ollama pull llama2
  ollama pull mistral
  ```

### GPU (Opcjonalnie)
- NVIDIA GPU dla przyspieszenia (CUDA support)
- `nvidia-smi` będzie automatycznie wykryte

---

## 🚀 Instalacja

### 1. Klonowanie/Pobieranie projektu
```bash
cd Documents/GitHub
git clone <repo-url> && cd FREEAI-web
# lub rozpakuj ZIP do folderu FREEAI-web
```

### 2. Instalacja zależności Node.js
```bash
npm install
```

Wymagane pakiety:
- `express` - framework webowy
- `axios` - HTTP client
- `cors` - Cross-Origin Resource Sharing
- `multer` - obsługa uploadu plików

### 3. Sprawdzenie pliku konfiguracji
```bash
cat config.json
```

---

## ⚙️ Konfiguracja

### `config.json`
```json
{
  "model": "huihui_ai/qwen2.5-coder:7b",
  "temperature": 0.2
}
```

| Opcja | Opis | Przykład |
|-------|------|---------|
| `model` | Nazwa modelu w Ollama | `"huihui_ai/qwen2.5-coder:7b"` |
| `temperature` | Domyślna temperatura (0.0-2.0) | `0.2` |

**Dostępne modele w Ollama:**
```bash
ollama list
```

---

## 🏃 Uruchamianie

### Uniwersalnie (Node.js musi być w PATH)
```bash
node server.js
```

### Z pełną ścieżką (bezpieczniej)
```bash
"C:\Program Files\nodejs\node.exe" server.js
```

### Z PowerShell
```powershell
& "C:\Program Files\nodejs\node.exe" server.js
```

### ✅ Serwer uruchomiony
```
Serwer: http://localhost:3000
```

Otwórz w przeglądarce: **http://localhost:3000**

---

## 📖 Jak Używać

### Zadawanie Pytań
1. Wpisz pytanie w pole input
2. Naciśnij **Enter** lub kliknij "Wyślij"
3. Odpowiedź pojawi się ze streamingiem

### Presety Parametrów
- **📍 Precyzyjny** - Temp: 0.1, Top P: 0.9, Top K: 40 (kod, debugowanie)
- **⚖️ Zbalansowany** - Temp: 0.5, Top P: 0.9, Top K: 50 (normalne pytania)
- **✨ Kreatywny** - Temp: 1.2, Top P: 0.95, Top K: 70 (pisanie, ideacja)

### Przesyłanie Plików
1. Kliknij "Wybierz plik"
2. Wybierz plik (TXT, PDF, CODE, itp.)
3. Kliknij "Prześlij plik"
4. Zawartość zostanie dodana do kontekstu rozmowy

### Resetowanie Kontekstu
- Kliknij "Resetuj kontekst" aby wyczyścić historię rozmowy
- Usuwa wiadomości i przesłane pliki

---

## 🎛️ Parametry Modelu

### Temperature (Temperatura)
- **Zakres:** 0.0 - 2.0
- **Efekt:** Losowość odpowiedzi
- **Niska (0.1-0.3)**: Precyzyjne, konserwatywne
- **Wysoka (1.0+)**: Kreatywne, chaotyczne

### Top P (Nucleus Sampling)
- **Zakres:** 0.0 - 1.0
- **Efekt:** Filtruje słowa po prawdopodobieństwie
- **Rekomendacja:** 0.85-0.95

### Top K
- **Zakres:** 0 - 100
- **Efekt:** Wybiera K najbardziej prawdopodobnych słów
- **Rekomendacja:** 30-70 (wyżej = mniej restrykcyjnie)

### Ikony Informacyjne (i)
- Kliknij **i** obok parametru aby zobaczyć opis

---

## 💾 Monitorowanie Zasobów

Panel "💾 Monitorowanie zasobów" pokazuje:

| Metryka | Opis |
|---------|------|
| **RAM** | Zużyta / Całkowita pamięć systemowa |
| **GPU** | VRAM (jeśli NVIDIA dostępna) |
| **Wiadomości** | Liczba wiadomości w kontekście rozmowy |
| **Pliki** | Liczba przesłanych plików |

**Kolorowanie pasków:**
- 🔵 Niebieskie (<60%) - Normalne
- 🟠 Pomarańczowe (60-80%) - Wysokie
- 🔴 Czerwone (>80%) - Krytyczne

Odświeża się automatycznie co 2 sekundy.

---

## 🌐 Wyszukiwanie w Internecie

Aby model wyszukał w internecie, napisz zapytanie zawierające:
- "szukaj [temat]"
- "search [topic]"
- "internet [pytanie]"
- "web [pytanie]"

Przykład:
```
szukaj najnowsze wiadomości o AI
```

Model automatycznie pobierze wyniki z DuckDuckGo API.

---

## 🔌 API Endpoints

### POST `/chat`
Wysyła zapytanie do modelu

**Request:**
```json
{
  "prompt": "Cześć, jak się masz?",
  "temperature": 0.2,
  "topP": 0.9,
  "topK": 40
}
```

**Response:** Stream tekstu (Server-Sent Events)

### POST `/upload`
Przesyła plik do kontekstu

**Request:** FormData z polem `file`

**Response:**
```
File uploaded and added to context.
```

### POST `/reset`
Resetuje rozmowę i kontekst

**Response:**
```
Context reset.
```

### GET `/api/info`
Informacje o serwerze

**Response:**
```json
{
  "model": "huihui_ai/qwen2.5-coder:7b",
  "status": "connected",
  "version": "1.0.0",
  "timestamp": "2026-04-06T12:00:00.000Z"
}
```

### GET `/api/memory`
Monitorowanie zasobów

**Response:**
```json
{
  "ram": {
    "used": "4096",
    "total": "16384",
    "percent": 25.0
  },
  "gpu": {
    "available": true,
    "used": 2048,
    "total": 8192,
    "percent": "25.00"
  },
  "uploadedFiles": [
    {
      "name": "plik.txt",
      "size": 1024,
      "uploadTime": "2026-04-06T12:00:00.000Z"
    }
  ],
  "contextSize": 5
}
```

---

## 🐛 Rozwiązywanie Problemów

### Problem: "node: The term 'node' is not recognized"

**Rozwiązanie:**
```powershell
# Dodaj Node.js do PATH
$env:PATH += ";C:\Program Files\nodejs"

# Lub sprawdź pełną ścieżkę
"C:\Program Files\nodejs\node.exe" server.js
```

### Problem: "Cannot find module 'X'"

**Rozwiązanie:**
```bash
npm install
```

### Problem: Ollama nie odpowiada

**Rozwiązanie:**
```bash
# Sprawdź czy Ollama działa
ollama serve

# W innym terminalu
ollama list
```

### Problem: "Cannot find module 'C:\...\server.js'"

**Rozwiązanie:**
```powershell
cd FREEAI-web
& "C:\Program Files\nodejs\node.exe" server.js
```

### Problem: GPU nie jest wykrywane

**Rozwiązanie:**
- GPU jest opcjonalne, aplikacja będzie działać z CPU
- Dla NVIDIA zainstaluj `nvidia-smi` lub CUDA toolkit

---

## 📚 Architektura

```
FREEAI-web/
├── server.js           # Serwer Express + API
├── config.json         # Konfiguracja modelu
├── package.json        # Zależności Node.js
├── README.md          # Ta dokumentacja
├── public/
│   └── index.html     # Frontend UI + JavaScript
└── uploads/           # Tymczasowe pliki (auto-czyszcze)
```

### Przepływ Danych

1. **Użytkownik** → wpisuje pytanie w UI
2. **Frontend** → wysyła `POST /chat` z parametrami
3. **Backend** → buduje prompt z historią + wyszukiwaniem
4. **Ollama** → generuje odpowiedź (stream)
5. **Backend** → przesyła do frontendu (SSE)
6. **UI** → renderuje Markdown + kod

---

## 🔒 Bezpieczeństwo

- ✅ Aplikacja działa lokalnie
- ✅ CORS włączony dla localhost
- ✅ Tymczasowe pliki automatycznie usuwane
- ⚠️ Nie przesyłaj wrażliwych danych (bez szyfrowania)
- ⚠️ Ollama musi być uruchomiona lokalnie (nie eksponuj publicznie)

---

## 📦 Rozszerzenia (Future)

- [ ] Obsługa więcej modeli AI (OpenAI, Claude API)
- [ ] Zapis/Wczytanie rozmów (JSON, TXT)
- [ ] OCR dla obrazów
- [ ] Dark/Light theme toggle
- [ ] Eksport do PDF
- [ ] Multi-user support
- [ ] Web UI customization

---

## 📝 Licencja

Projekt znajduje się w rozwoju. Użytkownik: `Adam P.`

---

## 🤝 Support

W razie problemów:
1. Sprawdzaj **Rozwiązywanie problemów** wyżej
2. Sprawdź konsolę przeglądarki (F12)
3. Sprawdź terminal serwera pod kątem błędów
4. Upewnij się że Ollama działa: `ollama serve`

---

## 🎯 Przydatne Linki

- [Ollama Official](https://ollama.ai)
- [Node.js Download](https://nodejs.org/)
- [Marked.js Docs](https://marked.js.org/)
- [Express.js Docs](https://expressjs.com/)

---

**Dziękujemy za używanie PotokAI! 🌊**
