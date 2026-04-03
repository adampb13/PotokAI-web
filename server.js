const express = require('express');
const axios = require('axios');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Tu będą pliki strony WWW

// Przechowywanie kontekstu rozmowy (prosta implementacja dla jednej karty)
let conversationHistory = [];

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
                model: "huihui_ai/qwen2.5-coder-abliterate:14b",
                prompt: fullPrompt,
                stream: true // KLUCZOWE: Włączamy strumień
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
    res.send('Context reset.');
});

app.listen(3000, '0.0.0.0', () => console.log("Serwer: http://localhost:3000"));