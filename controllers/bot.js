const TelegramBot = require('node-telegram-bot-api');
const instaScrapper = require('./insta');
require('dotenv').config();

const token = process.env.TELEGRAM_API;
const bot = new TelegramBot(token, { polling: true });
const username = 'Instdlp_rkbot';
const developer = 'Rkgroup5316';

const welcomeMessage = `🎉 *Welcome to @${username}!* 🎉

📤 Send any _Instagram Post/Reel link_ to download its media

✅ Features:
- Multiple Media Support
- Instant Downloads
- Carousel Posts

📌 Example: \`https://www.instagram.com/p/Cexample/\`

_Developed by ${developer}_`;

// Enhanced error handler with media type detection
const handleError = async (chatId, error, processingMsgId) => {
  console.error('Error:', error);
  
  const errorMessages = {
    'Invalid API response': '⚠️ Received invalid data from Instagram',
    'No media found': '❌ No downloadable media found in this post',
    'Invalid URL': '🔗 Invalid Instagram URL format',
    default: '⚠️ Oops! Something went wrong. Please try again.'
  };

  const message = errorMessages[error.message] || errorMessages.default;
  
  try {
    await bot.sendMessage(chatId, message);
    if (processingMsgId) {
      await bot.deleteMessage(chatId, processingMsgId);
    }
  } catch (e) {
    console.error('Error cleanup failed:', e);
  }
};

// Start command with improved formatting
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, welcomeMessage, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🧩 Try Inline Mode', switch_inline_query: '' }],
        [{ text: '📢 Share Bot', url: `https://t.me/${username}` }]
      ]
    }
  });
});

// Processing function with URL validation
const processMedia = async (chatId, url) => {
  const processingMsg = await bot.sendMessage(chatId, '⏳ Processing your link...');
  
  try {
    // Validate URL format first
    const instaRegex = /^https?:\/\/(www\.)?instagram\.com\/(p|reel|reels)\/[a-zA-Z0-9_-]+\/?/;
    if (!instaRegex.test(url)) {
      throw new Error('Invalid URL');
    }

    const result = await instaScrapper(url);
    
    // Validate API response
    if (!result?.length) {
      throw new Error('No media found');
    }

    // Delete processing message before sending media
    await bot.deleteMessage(chatId, processingMsg.message_id);

    // Send media with parallel processing
    await Promise.all(result.map(async (media, index) => {
      try {
        // In your media sending code (both photo and video)
           const options = {
  caption: `📸 Media ${index + 1} via [@${username}](https://t.me/${username})`,
  parse_mode: 'MarkdownV2',
  disable_web_page_preview: true
};

        if (media.type === 'image') {
          await bot.sendPhoto(chatId, media.link, options);
        } else {
          await bot.sendVideo(chatId, media.link, { 
            ...options,
            supports_streaming: true
          });
        }
      } catch (mediaError) {
        console.error(`Failed to send media ${index + 1}:`, mediaError);
      }
    }));

  } catch (error) {
    await handleError(chatId, error, processingMsg.message_id);
  }
};

// Message handler
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const url = msg.text?.trim();
  
  if (url && !url.startsWith('/')) {
    await processMedia(chatId, url);
  }
});

// Enhanced inline query handler
bot.on('inline_query', async (inlineQuery) => {
  const query = inlineQuery.query?.trim();
  
  if (!query) return;

  try {
    const results = await instaScrapper(query);
    
    if (!results?.length) {
      return bot.answerInlineQuery(inlineQuery.id, [{
        type: 'article',
        id: 'no_media',
        title: '❌ No Media Found',
        input_message_content: {
          message_text: 'Could not find any media in this post'
        }
      }]);
    }

    const formattedResults = results.map((media, index) => ({
      type: media.type === 'image' ? 'photo' : 'video',
      id: `media_${index}_${Date.now()}`,
      [media.type === 'image' ? 'photo_url' : 'video_url']: media.link,
      thumb_url: media.link, // Use media URL as thumbnail
      title: `Instagram ${media.type}`,
      description: `High quality ${media.type}`,
      caption: `📸 Via @${username}`,
      parse_mode: 'Markdown'
    }));

    await bot.answerInlineQuery(inlineQuery.id, formattedResults);
  } catch (error) {
    await bot.answerInlineQuery(inlineQuery.id, [{
      type: 'article',
      id: 'error',
      title: '❌ Download Failed',
      input_message_content: {
        message_text: `Error: ${error.message}`
      }
    }]);
  }
});

module.exports = bot;
