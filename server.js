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

// Przechowywanie kontekstu rozmowy (prosta implementacja dla jednej karty)
let conversationHistory = [];
let uploadedFiles = []; // Śledzenie przesłanych plików

// Konfiguracja multer dla uploadu plików
const upload = multer({ dest: 'uploads/' });

app.post('/chat', async (req, res) => {
    try {
        // 1. Ustawiamy nagłówki dla strumieniowania
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Dodajemy wiadomość użytkownika do historii
        conversationHistory.push({ role: 'user', content: req.body.prompt });

        // Budujemy prompt z historii
        let fullPrompt = '';
        conversationHistory.forEach(msg => {
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
            // Dodajemy odpowiedź AI do historii
            conversationHistory.push({ role: 'assistant', content: aiResponse });
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

    // Czytamy zawartość pliku (zakładamy tekst)
    fs.readFile(req.file.path, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).send('Error reading file.');
        }

        // Dodajemy zawartość pliku do kontekstu
        conversationHistory.push({ role: 'system', content: `Uploaded file content:\n${data}` });
        
        // Dodajemy informację o pliku do listy przesłanych plików
        uploadedFiles.push({
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

// Endpoint do resetowania kontekstu
app.post('/reset', (req, res) => {
    conversationHistory = [];
    uploadedFiles = [];
    res.send('Context reset.');
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
        res.json({
            ram: {
                used: (usedMem / (1024 * 1024)).toFixed(2),
                total: (totalMem / (1024 * 1024)).toFixed(2),
                percent: parseFloat(ramPercent)
            },
            gpu: gpuInfo,
            uploadedFiles: uploadedFiles,
            contextSize: conversationHistory.length
        });
    }
});

app.listen(3000, '0.0.0.0', () => console.log("Serwer: http://localhost:3000"));