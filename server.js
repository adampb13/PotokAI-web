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

        // Budujemy prompt z historii sesji
        let fullPrompt = '';
        session.history.forEach(msg => {
            fullPrompt += `${msg.role === 'user' ? 'User: ' : 'AI: '}${msg.content}\n`;
        });

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