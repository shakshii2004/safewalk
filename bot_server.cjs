require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// 1. Check for Service Account Key
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error('\n❌ ERROR: serviceAccountKey.json not found!');
  console.error('Please download your Service Account Key from the Firebase Console and save it as "serviceAccountKey.json" in this directory.\n');
  process.exit(1);
}

// 2. Initialize Firebase Admin
const serviceAccount = require(serviceAccountPath);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// 3. Initialize Telegram Bot
const token = process.env.VITE_TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('\n❌ ERROR: VITE_TELEGRAM_BOT_TOKEN not found in .env file!\n');
  process.exit(1);
}

const bot = new TelegramBot(token, {polling: true});

console.log('\n🛡️  SafeWalk Guardian Pulse Listener is ACTIVE...');
console.log('📡 Listening for automated connection links via Telegram...\n');

// 4. Listen for /start USER_ID
bot.onText(/\/start (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = match[1].trim(); // This is the user's UID from the deep link
  const username = msg.from.first_name || msg.from.username || 'Guardian';

  try {
    console.log(`🔗 Pairing Request: Attempting to connect ${username} to User ID [${userId}]...`);

    // Write to the guardian_sync collection
    // The SafeWalk app is listening to this document!
    await db.collection('guardian_sync').doc(userId).set({
      chatId: chatId.toString(),
      username: username,
      status: 'connected',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Success: Connected Guardian ${username} to User ${userId}`);

    bot.sendMessage(chatId, `✅ **SafeWalk Connection Successful!**\n\nYou are now the official Guardian for your contact.\n\n🛡️ **What this means:**\nYou will receive automatic live location alerts and emergency data if they are in danger. No further setup is required.`);
  } catch (error) {
    console.error('❌ Sync Error:', error);
    bot.sendMessage(chatId, '❌ **Connection failed.**\nPlease ensure the link you used is correct or try clicking the "Connect" button in the SafeWalk app again.');
  }
});

// Handle general start without ID
bot.onText(/\/start$/, (msg) => {
    if (msg.text === '/start') {
        bot.sendMessage(msg.chat.id, "👋 **Welcome to SafeWalk Guardian Bot**\n\nTo connect as a guardian, please use the unique link provided by your contact in the SafeWalk app.");
    }
});
