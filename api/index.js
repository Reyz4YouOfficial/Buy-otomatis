const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');

const app = express();
app.use(express.json());

// --- FUNGSI CREATE PANEL (Tetap Sama) ---
async function createPanelAccount(username, ram, disk, cpu) {
    try {
        const headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.panel.apikey}`
        };
        const randomStr = crypto.randomBytes(2).toString('hex');
        const password = `${username}${randomStr}`;
        const email = `${username.toLowerCase()}${randomStr}@gmail.com`;

        const userRes = await axios.post(`${config.panel.domain}/api/application/users`, {
            email, username: username.toLowerCase(), first_name: username, last_name: "User", language: "en", password
        }, { headers });

        const user = userRes.data.attributes;

        await axios.post(`${config.panel.domain}/api/application/servers`, {
            name: `${username} Server`,
            user: user.id,
            egg: config.panel.eggId,
            docker_image: config.panel.image,
            startup: config.panel.startup,
            environment: { INST: "npm", USER_UPLOAD: "0", AUTO_UPDATE: "0", CMD_RUN: "npm start" },
            limits: { memory: ram, swap: 0, disk: disk, io: 500, cpu: cpu },
            feature_limits: { databases: 1, backups: 1, allocations: 1 },
            deploy: { locations: [config.panel.locationId], dedicated_ip: false, port_range: [] }
        }, { headers });

        return { success: true, password };
    } catch (error) {
        console.error(error.message);
        return { success: false };
    }
}

// --- ROUTES ---
app.post('/buy', async (req, res) => {
    const { username, ramChoice } = req.body;
    let nominal = ramChoice === "unlimited" ? config.hargaPanel.unlimited : parseInt(ramChoice) * config.hargaPanel.perGB;

    try {
        const response = await axios.post('https://api.pakasir.id/v1/create-transaction', {
            apiKey: config.pakasir.apiKey,
            nominal: nominal,
            note: `PTERO-${ramChoice}-${username}`
        });
        res.json({ success: true, qrUrl: response.data.qr_url });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.post('/webhook/pakasir', async (req, res) => {
    const { status, note } = req.body;
    if (status === 'PAID') {
        const [, ramChoice, username] = note.split('-');
        let ramMB = ramChoice === "unlimited" ? 0 : parseInt(ramChoice) * 1024;
        await createPanelAccount(username, ramMB, ramMB, ramMB === 0 ? 0 : 100);
    }
    res.send('OK');
});

module.exports = app; // Export untuk Vercel
