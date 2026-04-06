const express = require('express');
const axios = require('axios');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const app = express();

// Wczytujemy konfigurację z pliku
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Tu będą pliki strony WWW

// Przechowywanie sesji czatów
let chatSessions = {}; // { sessionId: { history: [], files: [], name: '', createdAt: '' } }
let uploadedFiles = []; // Śledzenie przesłanych plików (deprecated - kept for compatibility)

// Funkcja do generowania ID sesji
function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Funkcja do tworzenia nowej sesji
function createSession(name = null) {
    const sessionId = generateSessionId();
    const sessionName = name || `Chat ${new Date().toLocaleString('pl-PL')}`;
    chatSessions[sessionId] = {
        id: sessionId,
        name: sessionName,
        history: [],
        files: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    return sessionId;
}

// Konfiguracja multer dla uploadu plików
const upload = multer({ dest: 'uploads/' });

// Funkcja do wyszukiwania w DuckDuckGo
async function searchDuckDuckGo(query, maxResults = 5) {
    try {
        console.log('🔍 Szukam w DuckDuckGo:', query);
        const response = await axios.get('https://api.duckduckgo.com/', {
            params: {
                q: query,
                format: 'json',
                no_html: 1,
                skip_disambig: 1
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        const results = [];
        
        // Pobierz wyniki z Abstract
        if (response.data.AbstractText && response.data.AbstractText.trim()) {
            console.log('✅ DuckDuckGo: znaleziono AbstractText');
            results.push({
                title: response.data.Heading || query,
                snippet: response.data.AbstractText,
                source: 'DuckDuckGo'
            });
        }
        
        // Pobierz wyniki z Results
        if (response.data.Results && Array.isArray(response.data.Results) && response.data.Results.length > 0) {
            console.log('✅ DuckDuckGo: znaleziono Results:', response.data.Results.length);
            response.data.Results.slice(0, maxResults - results.length).forEach(result => {
                if (result.Text) {
                    results.push({
                        title: result.Title || 'Wynik',
                        snippet: result.Text,
                        source: 'DuckDuckGo'
                    });
                }
            });
        }
        
        console.log(`✅ DuckDuckGo zwrócił ${results.length} wyników`);
        return results;
    } catch (error) {
        console.error('❌ Błąd DuckDuckGo:', error.message);
        return [];
    }
}

// Funkcja do wyszukiwania w Wikipedia
async function searchWikipedia(query, maxResults = 3) {
    try {
        console.log('📚 Szukam w Wikipedia:', query);
        // Najpierw spróbuj polską Wikipedię
        const response = await axios.get('https://pl.wikipedia.org/w/api.php', {
            params: {
                action: 'query',
                list: 'search',
                srsearch: query,
                format: 'json',
                srlimit: maxResults
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        if (!response.data.query || !response.data.query.search || response.data.query.search.length === 0) {
            console.log('📚 Polska Wikipedia nie zwróciła wyników, próbuję English...');
            // Fallback na English Wikipedia jeśli brak wyników
            const enResponse = await axios.get('https://en.wikipedia.org/w/api.php', {
                params: {
                    action: 'query',
                    list: 'search',
                    srsearch: query,
                    format: 'json',
                    srlimit: maxResults
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            if (!enResponse.data.query || !enResponse.data.query.search) {
                return [];
            }
            const results = enResponse.data.query.search.map(item => ({
                title: item.title,
                snippet: item.snippet.replace(/<\/?[^>]+(>|$)/g, ''), // Usuń HTML tags
                source: 'Wikipedia (EN)'
            }));
            console.log(`✅ English Wikipedia zwróciła ${results.length} wyników`);
            return results;
        }
        
        const results = response.data.query.search.map(item => ({
            title: item.title,
            snippet: item.snippet.replace(/<\/?[^>]+(>|$)/g, ''), // Usuń HTML tags
            source: 'Wikipedia (PL)'
        }));
        
        console.log(`✅ Polska Wikipedia zwróciła ${results.length} wyników`);
        return results;
    } catch (error) {
        console.error('❌ Błąd Wikipedia:', error.message);
        return [];
    }
}

app.post('/chat', async (req, res) => {
    try {
        // 1. Ustawiamy nagłówki dla strumieniowania
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Pobieramy lub tworzymy sesję
        let sessionId = req.body.sessionId;
        console.log('📨 Otrzymano request, sessionId z body:', sessionId);
        console.log('🔍 Dostępne sesje:', Object.keys(chatSessions));
        
        if (!sessionId || !chatSessions[sessionId]) {
            console.log('⚠️ SessionId nie znaleziony, tworząc nową sesję');
            sessionId = createSession();
        } else {
            console.log('✅ SessionId znaleziony, używam istniejący');
        }
        
        const session = chatSessions[sessionId];
        console.log('📌 Pracuję z sesją:', sessionId);

        // Dodajemy wiadomość użytkownika do historii sesji
        session.history.push({ role: 'user', content: req.body.prompt });
        session.updatedAt = new Date().toISOString();

        // Web Search - jeśli włączony
        let webSearchContext = '';
        if (req.body.webSearchEnabled === true) {
            console.log('🔍 Web Search jest włączony, szukam wyników...');
            let searchResults = [];
            
            // Najpierw spróbuj Wikipedia (lepiej dla pytań w języku polskim)
            searchResults = await searchWikipedia(req.body.prompt, 3);
            
            // Jeśli Wikipedia nie znalazła nic, spróbuj DuckDuckGo
            if (searchResults.length === 0) {
                console.log('📚 Wikipedia nie znalazła wyników, próbuję DuckDuckGo...');
                searchResults = await searchDuckDuckGo(req.body.prompt, 3);
            }
            
            if (searchResults.length > 0) {
                webSearchContext = `\n\n[WYSZUKANIE INTERNETOWE - ${searchResults.length} wyników]\n\n`;
                searchResults.forEach((result, index) => {
                    webSearchContext += `WYNIK ${index + 1}:\n`;
                    webSearchContext += `Tytuł: ${result.title}\n`;
                    webSearchContext += `Źródło: ${result.source}\n`;
                    webSearchContext += `Treść: ${result.snippet}\n`;
                    webSearchContext += `---\n\n`;
                });
                console.log('✅ Dodano', searchResults.length, 'wyników wyszukiwania do kontekstu');
            } else {
                console.log('⚠️ Brak wyników wyszukiwania');
            }
        }

        // Budujemy prompt z historii sesji
        let fullPrompt = '';
        
        // Dodaj bieżącą datę i TOP SYSTEM INSTRUCTIONS na początek
        const today = new Date().toLocaleDateString('pl-PL', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        fullPrompt += `###### SYSTEM INSTRUCTIONS - OBOWIĄZKOWE ######\n`;
        fullPrompt += `Bieżąca data: ${today}\n`;
        fullPrompt += `Język odpowiedzi: ZAWSZE Polski\n`;
        
        if (webSearchContext) {
            fullPrompt += `\n!!! WEB SEARCH JEST WŁĄCZONY - KRYTYCZNE INSTRUKCJE !!!\n`;
            fullPrompt += `1. Poniżej masz wyniki z AKTUALNEGO wyszukiwania internetowego.\n`;
            fullPrompt += `2. Odpowiadaj WYŁĄCZNIE na podstawie tych wyników.\n`;
            fullPrompt += `3. Ignoruj CAŁKOWICIE swoją wiedzę treningową, jeśli wyniki mówią coś innego.\n`;
            fullPrompt += `4. Zawsze PREFERUJ informacje z wyszukiwania przed wiedzą treningową.\n`;
            fullPrompt += `5. Jeśli wyniki mówią X, a Ty wiesz że to Y z treningu, POWIEDZ że wyniki mówią X.\n`;
            fullPrompt += `6. Nie kombinuj - BEZPOŚREDNIO cytuj i bazuj na wynikach poniżej.\n`;
        } else {
            fullPrompt += `\nWEB SEARCH JEST WYŁĄCZONY - Używaj swojej wiedzy treningowej.\n`;
        }
        
        fullPrompt += `###### KONIEC SYSTEM INSTRUCTIONS ######\n\n`;
        
        // Dodaj wyniki web searchu ZARAZ PO INSTRUKCJACH
        if (webSearchContext) {
            fullPrompt += `########## AKTUALNE WYNIKI WYSZUKIWANIA Z INTERNETU ##########\n\n`;
            fullPrompt += webSearchContext;
            fullPrompt += `\n########## KONIEC WYNIKÓW WYSZUKIWANIA ##########\n\n`;
        }
        
        // Dodaj historię czatu
        fullPrompt += `=== HISTORIA ROZMOWY ===\n`;
        session.history.forEach(msg => {
            fullPrompt += `${msg.role === 'user' ? 'User: ' : 'AI: '}${msg.content}\n`;
        });
        fullPrompt += `\nTwoja odpowiedź (pamiętaj instrukcje powyżej):\n`;

        // 2. Prosimy Ollamę o stream (stream: true)
        const response = await axios({
            method: 'post',
            url: 'http://127.0.0.1:11434/api/generate',
            data: {
                model: config.model,
                prompt: fullPrompt,
                stream: true, // KLUCZOWE: Włączamy strumień
                options: {
                    temperature: req.body.temperature !== undefined ? req.body.temperature : (config.temperature || 0.7),
                    top_p: req.body.topP !== undefined ? req.body.topP : 0.9,
                    top_k: req.body.topK !== undefined ? req.body.topK : 40
                }
            },
            responseType: 'stream' // Axios musi wiedzieć, że to strumień danych
        });

        let aiResponse = '';

        // 3. Przekazujemy każdy kawałek (chunk) z Ollamy prosto do przeglądarki
        response.data.on('data', (chunk) => {
            const jsonString = chunk.toString();
            try {
                const json = JSON.parse(jsonString);
                if (json.response) {
                    res.write(json.response); // Wysyłamy słowo do frontendu
                    aiResponse += json.response;
                }
            } catch (e) {
                // Czasem chunk zawiera niepełny JSON, ignorujemy błędy parsowania w locie
            }
        });

        response.data.on('end', () => {
            // Dodajemy odpowiedź AI do historii sesji
            session.history.push({ role: 'assistant', content: aiResponse });
            session.updatedAt = new Date().toISOString();
            res.end();
        });

    } catch (err) {
        console.error(err);
        res.status(500).end();
    }
});

// Endpoint do uploadu plików
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    // Pobieramy lub tworzymy sesję
    let sessionId = req.query.sessionId || req.body.sessionId;
    if (!sessionId || !chatSessions[sessionId]) {
        sessionId = createSession();
    }
    
    const session = chatSessions[sessionId];

    // Czytamy zawartość pliku (zakładamy tekst)
    fs.readFile(req.file.path, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).send('Error reading file.');
        }

        // Dodajemy zawartość pliku do kontekstu sesji
        session.history.push({ role: 'system', content: `Uploaded file content:\n${data}` });
        
        // Dodajemy informację o pliku do listy przesłanych plików sesji
        session.files.push({
            name: req.file.originalname,
            size: req.file.size,
            uploadTime: new Date().toISOString()
        });

        // Usuwamy tymczasowy plik
        fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error deleting temp file:', err);
        });

        res.send('File uploaded and added to context.');
    });
});

// Endpoint do resetowania kontekstu sesji
app.post('/reset', (req, res) => {
    const sessionId = req.body.sessionId;
    if (sessionId && chatSessions[sessionId]) {
        chatSessions[sessionId].history = [];
        chatSessions[sessionId].files = [];
        chatSessions[sessionId].updatedAt = new Date().toISOString();
    }
    res.send('Context reset.');
});

// Endpoint do tworzenia nowego czatu
app.post('/api/chats/new', (req, res) => {
    const sessionId = createSession(req.body.name || null);
    const session = chatSessions[sessionId];
    console.log('✅ POST /api/chats/new - utworzono sesję:', sessionId, 'name:', session.name);
    res.json({
        id: session.id,
        name: session.name,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messageCount: session.history.length,
        fileCount: session.files.length
    });
});

// Endpoint do pobrania listy czatów
app.get('/api/chats', (req, res) => {
    const chatsList = Object.values(chatSessions).map(session => ({
        id: session.id,
        name: session.name,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messageCount: session.history.length,
        fileCount: session.files.length
    }));
    res.json(chatsList);
});

// Endpoint do usuwania czatu
app.delete('/api/chats/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    if (chatSessions[sessionId]) {
        delete chatSessions[sessionId];
        res.json({ success: true, message: 'Chat deleted.' });
    } else {
        res.status(404).json({ success: false, message: 'Chat not found.' });
    }
});

// Endpoint do pobrania sesji
app.get('/api/chats/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    if (chatSessions[sessionId]) {
        res.json(chatSessions[sessionId]);
    } else {
        res.status(404).json({ error: 'Chat not found.' });
    }
});

// Endpoint do zwracania informacji o serwerze
app.get('/api/info', (req, res) => {
    res.json({
        model: config.model,
        status: 'connected',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Endpoint do monitorowania pamięci
app.get('/api/memory', (req, res) => {
    const os = require('os');
    const util = require('util');
    const exec = util.promisify(require('child_process').exec);

    // RAM memory
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramPercent = ((usedMem / totalMem) * 100).toFixed(2);

    // VRAM monitoring
    let gpuInfo = { available: false, used: 0, total: 0, percent: 0 };

    // Spróbuj pobrać informacje o GPU (nvidia-smi jeśli dostępne)
    exec('nvidia-smi --query-gpu=memory.used,memory.total --format=csv,nounits,noheader')
        .then(({ stdout }) => {
            const lines = stdout.trim().split('\n');
            if (lines.length > 0) {
                const [used, total] = lines[0].split(',').map(x => parseInt(x.trim()));
                gpuInfo = {
                    available: true,
                    used: used,
                    total: total,
                    percent: ((used / total) * 100).toFixed(2)
                };
            }
            sendResponse();
        })
        .catch(() => {
            // GPU nie dostępne
            sendResponse();
        });

    function sendResponse() {
        // Pobieramy sessionId z query params
        const sessionId = req.query.sessionId;
        const session = chatSessions[sessionId] || { history: [], files: [] };

        res.json({
            ram: {
                used: (usedMem / (1024 * 1024)).toFixed(2),
                total: (totalMem / (1024 * 1024)).toFixed(2),
                percent: parseFloat(ramPercent)
            },
            gpu: gpuInfo,
            uploadedFiles: session.files,
            contextSize: session.history.length
        });
    }
});

app.listen(3000, '0.0.0.0', () => console.log("Serwer: http://localhost:3000"));