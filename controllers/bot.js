const TelegramBot = require('node-telegram-bot-api');
const instaScrapper = require('./insta');
require('dotenv').config();

const token = process.env.TELEGRAM_API;
const bot = new TelegramBot(token, { polling: true });
const username = 'Instdlp_rkbot';
const developer = 'RKGroup';

const welcomeMessage = `🎉 *Welcome to @${username}!* 🎉

📤 Send me any _Instagram Reel/Post link_ and I'll instantly download it for you!

✅ Features:
- 𝗛𝗶𝗴𝗵-𝗤𝘂𝗮𝗹𝗶𝘁𝘆 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝘀
- 𝗜𝗻𝗹𝗶𝗻𝗲 𝗠𝗼𝗱𝗲 𝗦𝘂𝗽𝗽𝗼𝗿𝘁
- 𝗙𝗮𝘀𝘁 𝗣𝗿𝗼𝗰𝗲𝘀𝘀𝗶𝗻𝗴

📌 Example: \`https://www.instagram.com/p/Cexample/\`

_Developed by ${developer}_`;

const handleError = async (chatId, error, processingMsgId) => {
  console.error('Error:', error);
  const errorMessages = {
    ETIMEDOUT: '⌛ Request timed out. Please try again.',
    'Invalid URL': '❌ Invalid Instagram URL. Please check the link format.',
    'Private content': '🔒 This content is private and cannot be downloaded.',
    default: '⚠️ Oops! Something went wrong. Please try again later.'
  };
  
  const message = errorMessages[error.message] || errorMessages.default;
  await bot.sendMessage(chatId, message);
  if (processingMsgId) {
    await bot.deleteMessage(chatId, processingMsgId);
  }
};

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, welcomeMessage, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '📢 Share Bot', url: `https://t.me/${username}` }],
        [{ text: '🧩 Try Inline Mode', switch_inline_query: '' }]
      ]
    }
  });
});

const processMessage = async (msg) => {
  const chatId = msg.chat.id;
  let processingMsg = null;

  try {
    // Send processing message and get its message ID
    processingMsg = await bot.sendMessage(chatId, '⏳ Processing your link...');
    
    const post = await instaScrapper(msg.text);
    if (!post?.length) throw new Error('No media found');

    // Delete processing message before sending media
    await bot.deleteMessage(chatId, processingMsg.message_id);

    for (const media of post) {
      const messageOptions = {
        caption: `📸 Downloaded via @${username}`,
        parse_mode: 'Markdown'
      };

      if (media.type === 'image') {
        await bot.sendPhoto(chatId, media.link, messageOptions);
      } else {
        await bot.sendVideo(chatId, media.link, { 
          ...messageOptions,
          supports_streaming: true
        });
      }
    }
  } catch (error) {
    await handleError(chatId, error, processingMsg?.message_id);
  }
};

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  if (!msg.text || msg.text === '/start') return;

  const instaRegex = /^https?:\/\/(www\.)?instagram\.com\/(p|reel|reels)\/[a-zA-Z0-9_-]+\/?/;
  if (!instaRegex.test(msg.text)) {
    return bot.sendMessage(chatId, '❌ Invalid Instagram URL format. Please use:\n\n• Post: https://www.instagram.com/p/...\n• Reel: https://www.instagram.com/reel/...');
  }

  await processMessage(msg);
});

bot.on('inline_query', async (inlineQuery) => {
  const query = inlineQuery.query?.trim();
  if (!query) return;

  try {
    const post = await instaScrapper(query);
    if (!post?.length) throw new Error('No media found');

    const results = post.map((media, index) => ({
      type: media.type === 'image' ? 'photo' : 'video',
      id: `${media.type}_${index}_${Date.now()}`,
      [media.type === 'image' ? 'photo_url' : 'video_url']: media.link,
      thumb_url: media.thumbnail || media.link,
      title: `Instagram ${media.type === 'image' ? 'Photo' : 'Video'}`,
      description: `High-quality ${media.type}`,
      caption: `📸 Downloaded via @${username}`,
      parse_mode: 'Markdown',
      mime_type: media.type === 'video' ? 'video/mp4' : undefined
    }));

    return bot.answerInlineQuery(inlineQuery.id, results);
  } catch (error) {
    console.error('Inline error:', error);
    return bot.answerInlineQuery(inlineQuery.id, [{
      type: 'article',
      id: 'error',
      title: '❌ Download Failed',
      input_message_content: {
        message_text: `Failed to download content: ${error.message}`
      }
    }]);
  }
});

module.exports = bot;
