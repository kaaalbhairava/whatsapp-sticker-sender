import { makeWASocket, useMultiFileAuthState, delay } from "@whiskeysockets/baileys";
import pino from "pino";

// Shared sending flag so that /stopSending can set this to false
global.sending = false;
let sock = null;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { targets, stickerUrls, delay: msgDelay } = req.body;
  if (!targets || !stickerUrls || !msgDelay) {
    return res.status(400).json({ error: "Missing parameters" });
  }
  try {
    if (!sock) {
      const { state, saveCreds } = await useMultiFileAuthState("./auth_info");
      sock = makeWASocket({ auth: state, logger: pino({ level: "silent" }) });
      sock.ev.on("creds.update", saveCreds);
      sock.ev.on("connection.update", update => {
        if (update.connection === "open") console.log("WhatsApp connection opened");
        if (update.connection === "close") console.log("WhatsApp connection closed");
      });
    }
    if (global.sending) {
      return res.status(429).json({ error: "Sending already in progress" });
    }
    global.sending = true;
    (async () => {
      for (const stickerUrl of stickerUrls) {
        for (const target of targets) {
          if (!global.sending) break;
          try {
            await sock.sendMessage(
              target.endsWith('@g.us') || target.endsWith('@c.us') ? target : (target.match(/^\d+$/) ? target + "@c.us" : target),
              { sticker: { url: stickerUrl } }
            );
            console.log(`Sticker sent to ${target}`);
          } catch (e) {
            console.error(`Error sending sticker to ${target}:`, e);
          }
          await delay(msgDelay * 1000);
        }
        if (!global.sending) break;
      }
      global.sending = false;
    })();
    return res.json({ status: "started" });
  } catch (error) {
    console.error(error);
    global.sending = false;
    return res.status(500).json({ error: error.message });
  }
}
