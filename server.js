const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Tu będą pliki strony WWW

app.post('/chat', async (req, res) => {
    try {
        // 1. Ustawiamy nagłówki dla strumieniowania
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // 2. Prosimy Ollamę o stream (stream: true)
        const response = await axios({
            method: 'post',
            url: 'http://127.0.0.1:11434/api/generate',
            data: {
                model: "huihui_ai/qwen2.5-coder-abliterate:14b",
                prompt: req.body.prompt,
                stream: true // KLUCZOWE: Włączamy strumień
            },
            responseType: 'stream' // Axios musi wiedzieć, że to strumień danych
        });

        // 3. Przekazujemy każdy kawałek (chunk) z Ollamy prosto do przeglądarki
        response.data.on('data', (chunk) => {
            const jsonString = chunk.toString();
            try {
                const json = JSON.parse(jsonString);
                if (json.response) {
                    res.write(json.response); // Wysyłamy słowo do frontendu
                }
            } catch (e) {
                // Czasem chunk zawiera niepełny JSON, ignorujemy błędy parsowania w locie
            }
        });

        response.data.on('end', () => res.end());

    } catch (err) {
        console.error(err);
        res.status(500).end();
    }
});

app.listen(3000, '0.0.0.0', () => console.log("Serwer: http://localhost:3000"));