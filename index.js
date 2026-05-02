const { Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const axios = require('axios'); // TDK/Sözlük kontrolü için
const fs = require('fs');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Oyun Botu Aktif!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const prefix = "mem!";
let oyunVerisi = { sayi: {}, tuttu: {}, kelime: {} };

// Verileri kaydetme (Bot kapanınca oyun sıfırlanmasın diye)
if (fs.existsSync('./oyunlar.json')) {
    try { oyunVerisi = JSON.parse(fs.readFileSync('./oyunlar.json', 'utf8')); } catch (e) { console.log("Dosya oluşturuldu."); }
}
function veriKaydet() { fs.writeFileSync('./oyunlar.json', JSON.stringify(oyunVerisi, null, 2)); }

client.on('ready', () => { console.log(`${client.user.tag} Oyun Başladı!`); });

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // --- OYUN KURULUM KOMUTLARI ---
    if (message.content.startsWith(prefix)) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        const kanal = message.mentions.channels.first();

        if (!kanal) return;

        if (command === 'sayısaymaca') {
            oyunVerisi.sayi[kanal.id] = { sonSayi: 0, sonKullanici: null };
            message.reply(`🔢 Sayı saymaca oyunu ${kanal} kanalında başlatıldı! Hedef: 1 Milyon!`);
        }
        if (command === 'tuttututmadı') {
            oyunVerisi.tuttu[kanal.id] = true;
            message.reply(`👍 Tuttu-Tutmadı oyunu ${kanal} kanalında başlatıldı!`);
        }
        if (command === 'kelimeoyunu') {
            oyunVerisi.kelime[kanal.id] = { sonKelime: "", sonKullanici: null };
            message.reply(`🔤 Kelime oyunu ${kanal} kanalında başlatıldı!`);
        }
        veriKaydet();
        return;
    }

    // --- OYUN MANTIKLARI ---

    // 1. Sayı Saymaca
    if (oyunVerisi.sayi[message.channel.id]) {
        const data = oyunVerisi.sayi[message.channel.id];
        const girilenSayi = parseInt(message.content);

        if (isNaN(girilenSayi)) {
            message.delete();
            return message.channel.send(`⚠️ ${message.author}, bu kanala sadece **sayı** yazabilirsin!`).then(m => setTimeout(() => m.delete(), 3000));
        }

        if (girilenSayi !== data.sonSayi + 1) {
            message.delete();
            return message.channel.send(`❌ Yanlış sayı! Sıradaki sayı: **${data.sonSayi + 1}**`).then(m => setTimeout(() => m.delete(), 3000));
        }

        if (message.author.id === data.sonKullanici) {
            message.delete();
            return message.channel.send(`🚫 Üst üste iki kez sayamazsın! başkası yazmalı.`).then(m => setTimeout(() => m.delete(), 3000));
        }

        data.sonSayi = girilenSayi;
        data.sonKullanici = message.author.id;
        message.react('✅');
        veriKaydet();
    }

    // 2. Tuttu-Tutmadı
    if (oyunVerisi.tuttu[message.channel.id]) {
        const msg = message.content.toLowerCase();
        if (!msg.startsWith("tuttu") && !msg.startsWith("tutmadı")) {
            message.delete();
            return message.channel.send(`⚠️ Mesajın **Tuttu** veya **Tutmadı** ile başlamalı!`).then(m => setTimeout(() => m.delete(), 3000));
        }
        message.react('🆗');
    }

    // 3. Kelime Oyunu (TDK Kontrollü)
    if (oyunVerisi.kelime[message.channel.id]) {
        const data = oyunVerisi.kelime[message.channel.id];
        const kelime = message.content.trim().toLowerCase();

        if (message.author.id === data.sonKullanici) {
            message.delete();
            return message.reply("Sıra başkasında!").then(m => setTimeout(() => m.delete(), 3000));
        }

        // Son harf kontrolü
        if (data.sonKelime !== "" && kelime[0] !== data.sonKelime.slice(-1)) {
            message.delete();
            return message.channel.send(`❌ Kelime, önceki kelimenin son harfi olan **"${data.sonKelime.slice(-1)}"** ile başlamalı!`).then(m => setTimeout(() => m.delete(), 3000));
        }

        // TDK / Sözlük API Kontrolü (Ücretsiz ve hızlı bir API)
        try {
            const res = await axios.get(`https://sozluk.gov.tr/gts?ara=${encodeURIComponent(kelime)}`);
            if (res.data.error || !res.data[0]) {
                message.delete();
                return message.channel.send(`❌ **"${kelime}"** TDK kayıtlarında bulunamadı!`).then(m => setTimeout(() => m.delete(), 3000));
            }
        } catch (e) {
            // API hatası olursa oyunu bozmamak için geçici izin verebiliriz veya hata döndürebiliriz
        }

        data.sonKelime = kelime;
        data.sonKullanici = message.author.id;
        message.react('📝');
        veriKaydet();
    }
});

client.login(process.env.TOKEN);
