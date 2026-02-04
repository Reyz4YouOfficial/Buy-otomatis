const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');

const app = express();
app.use(express.json());

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
        console.error("Panel Error:", error.response?.data || error.message);
        return { success: false };
    }
}

app.post('/buy', (req, res) => {
    const { username, ramChoice } = req.body;
    if (!username) return res.status(400).json({ success: false });

    let nominal = ramChoice === "unlimited" ? config.hargaPanel.unlimited : parseInt(ramChoice) * config.hargaPanel.perGB;
    const orderId = `PTERO_${username.replace(/\s/g, '')}_${ramChoice}_${Date.now()}`;
    const paymentUrl = `https://app.pakasir.com/pay/${config.pembayaran.slug}/${nominal}?order_id=${orderId}&qris_only=1&redirect=${config.pembayaran.redirectUrl}`;

    res.json({ success: true, paymentUrl });
});

app.post('/webhook/pakasir', async (req, res) => {
    const { status, order_id } = req.body;
    if (status === 'PAID' && order_id && order_id.startsWith('PTERO_')) {
        const parts = order_id.split('_');
        const username = parts[1];
        const ramChoice = parts[2];

        let ramMB = ramChoice === "unlimited" ? 0 : parseInt(ramChoice) * 1024;
        let diskMB = ramChoice === "unlimited" ? 0 : 5120; // Default 5GB
        let cpu = ramChoice === "unlimited" ? 0 : 100;

        await createPanelAccount(username, ramMB, diskMB, cpu);
    }
    res.send('OK');
});

module.exports = app;
