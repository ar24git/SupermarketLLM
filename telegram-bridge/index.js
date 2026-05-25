// Telegram bridge to connect Telegram bot -> OpenClaw gateway for SupermarketLLM

require('dotenv').config();
const { Telegraf } = require('telegraf');
const fetch = require('node-fetch');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENCLAW_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:8000';
const OPENCLAW_GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '';
const OPENCLAW_SESSION_KEY = process.env.OPENCLAW_SESSION_KEY || 'default-telegram-session';
const OPENCLAW_AGENT_ID = process.env.OPENCLAW_AGENT_ID || 'default-agent';
const BRIDGE_MODE = (process.env.BRIDGE_MODE || 'polling').toLowerCase();
const MEMORY_LOGGING = (process.env.MEMORY_LOGGING || 'on').toLowerCase() === 'on';

if (!TELEGRAM_BOT_TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN in .env');
  process.exit(1);
}

async function extractReply(data) {
  if (!data) return '';
  if (typeof data === 'string') return data;
  if (data.reply) return data.reply;
  if (data.message && data.message.content) return data.message.content;
  if (data.answer) return data.answer;
  if (typeof data === 'object') {
    const keys = ['text','content','answer','reply','message'];
    for (const k of keys) {
      if (data[k]) {
        if (typeof data[k] === 'string') return data[k];
        if (Array.isArray(data[k])) return data[k].join('\n');
      }
    }
  }
  return '';
}

async function callOpenClaw(text) {
  const payload = {
    sessionKey: OPENCLAW_SESSION_KEY,
    agentId: OPENCLAW_AGENT_ID,
    text
  };
  const headers = {
    'Content-Type': 'application/json',
  };
  if (OPENCLAW_GATEWAY_TOKEN) {
    headers['Authorization'] = `Bearer ${OPENCLAW_GATEWAY_TOKEN}`;
  }
  const endpoints = [ '/api/sessions_send', '/sessions_send', '/gateway/sessions_send' ];
  for (const path of endpoints) {
    try {
      const url = `${OPENCLAW_GATEWAY_URL.replace(/\/$/, '')}${path}`;
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        const reply = extractReply(data);
        if (reply) return reply;
      }
    } catch (e) {
      // try next endpoint
      continue;
    }
  }
  // fallback
  return 'Sorry, I cannot reach the OpenClaw gateway right now.';
}

// Initialize Telegram bot
const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

bot.start((ctx) => ctx.reply('Hello! I am the SupermarketLLM Telegram bridge. Send a grocery question and I will fetch prices from the local LLM.'));
bot.help((ctx) => ctx.reply('Ask me about prices in Greek supermarkets.'));

bot.on('text', async (ctx) => {
  const userText = ctx.message.text;
  const reply = await callOpenClaw(userText);
  if (reply && reply.length > 0) {
    await ctx.reply(reply);
  } else {
    await ctx.reply("I received your message, but I couldn't generate a response. Try again later.");
  }
  if (MEMORY_LOGGING) {
    const logLine = `Date: ${new Date().toISOString()} | Telegram-Bridge | User: ${userText} | Reply: ${reply}\n`;
    try {
      const fs = require('fs');
      const memPath = '/Users/arthur/SupermarketLLM/MEMORY.md';
      fs.appendFileSync(memPath, logLine);
    } catch {
      // ignore memory logging errors
    }
  }
});

if (BRIDGE_MODE === 'polling') {
  bot.launch().then(() => {
    console.log('Telegram bridge started in polling mode.');
  }).catch((err) => {
    console.error('Telegram bridge failed to start:', err);
  });
} else {
  console.log('BRIDGE_MODE is not polling in this skeleton. Starting polling as fallback.');
  bot.launch().then(() => {}).catch(() => {});
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
