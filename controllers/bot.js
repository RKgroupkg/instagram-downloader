const TelegramBot = require('node-telegram-bot-api');
const instaScrapper = require('./insta');
require('dotenv').config();
const NodeCache = require('node-cache');
const { RateLimiter } = require('limiter');
const PQueue = require('p-queue').default;

// Configure environment
const token = process.env.TELEGRAM_API;
const CACHE_TTL = 3600; // 1 hour cache
const CONCURRENCY_LIMIT = 5; // Simultaneous processing
const RATE_LIMIT = 25; // Requests per minute per user

// Initialize utilities
const mediaCache = new NodeCache({ stdTTL: CACHE_TTL });
const processingQueue = new PQueue({ concurrency: CONCURRENCY_LIMIT });
const userLimiters = new Map();

// Bot initialization
const bot = new TelegramBot(token, {
  polling: true,
  filepath: false,
  baseApiUrl: process.env.TELEGRAM_API_PROXY // Optional proxy for bypassing restrictions
});

// Constants
const BOT_INFO = {
  username: 'Instdlp_rkbot',
  developer: 'Rkgroup5316',
  support: '@Rkgroup_helpbot'
};

// Validation patterns
const INSTA_REGEX = /^https:\/\/(www\.)?instagram\.com\/(p|reel|reels)\/[a-zA-Z0-9_-]+\/?/;
const URL_TYPES = {
  POST: 'p',
  REEL: 'reel',
  REELS: 'reels'
};

// Rate limiter factory
const getUserLimiter = (userId) => {
  if (!userLimiters.has(userId)) {
    userLimiters.set(userId, new RateLimiter({
      tokensPerInterval: RATE_LIMIT,
      interval: 'minute'
    }));
  }
  return userLimiters.get(userId);
};

// Enhanced error handler
const handleError = async (chatId, error) => {
  console.error(`Error [${new Date().toISOString()}]:`, error);
  
  const errorMessages = {
    'TIMEDOUT': 'Request timed out. Please try again.',
    'INVALID_URL': 'Invalid Instagram URL. Please send a valid link.',
    'PRIVATE_CONTENT': 'This content is private and cannot be downloaded.',
    'MEDIA_UNAVAILABLE': 'Media not available. The post may have been deleted.'
  };

  const message = errorMessages[error.code] || 'Something went wrong. Please try again later.';
  
  await bot.sendMessage(chatId, `${message} Contact support: ${BOT_INFO.support}`);
};

// Media processing handler
const processMedia = async (chatId, url) => {
  try {
    // Check cache first
    const cachedMedia = mediaCache.get(url);
    if (cachedMedia) return cachedMedia;

    // Show typing status
    await bot.sendChatAction(chatId, 'typing');

    // Process media
    const media = await instaScrapper(url);
    
    // Validate response
    if (!media?.length) throw new Error('MEDIA_UNAVAILABLE');
    
    // Cache results
    mediaCache.set(url, media);
    return media;
  } catch (error) {
    error.code = error.code || 'PROCESSING_ERROR';
    throw error;
  }
};

// Media sender with grouping
const sendMediaGroup = async (chatId, mediaItems) => {
  const mediaGroup = mediaItems.map((media, index) => ({
    type: media.type,
    media: media.link,
    caption: index === 0 ? 'Downloaded via @Instdlp_rkbot' : ''
  }));

  await bot.sendMediaGroup(chatId, mediaGroup);
  await bot.sendMessage(chatId, '✅ Download complete!');
};

// Start command handler
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, `🎉 Welcome to @${BOT_INFO.username}!\n\nSend any Instagram post/reel link to get started!\n\n📌 Tips:\n- Send direct links for best results\n- Works with posts, reels, and stories\n\nDeveloped by ${BOT_INFO.developer}`);
});

// Message handler
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const url = msg.text?.trim();

  try {
    // Validate message
    if (!url || url === '/start') return;
    if (!INSTA_REGEX.test(url)) throw { code: 'INVALID_URL' };

    // Rate limiting
    const limiter = getUserLimiter(userId);
    if (limiter.getTokensRemaining() < 1) {
      return bot.sendMessage(chatId, '⚠️ Too many requests. Please wait a minute.');
    }

    await limiter.removeTokens(1);

    // Queue processing
    await processingQueue.add(async () => {
      await bot.sendMessage(chatId, '⏳ Processing your request...');
      const media = await processMedia(chatId, url);
      
      // Show upload status
      const hasVideo = media.some(m => m.type === 'video');
      await bot.sendChatAction(chatId, hasVideo ? 'upload_video' : 'upload_photo');

      // Send media
      media.length > 1 
        ? await sendMediaGroup(chatId, media)
        : await bot.sendMedia(chatId, media[0].link, {
            caption: 'Downloaded via @Instdlp_rkbot'
          });
    });
  } catch (error) {
    handleError(chatId, error);
  }
});

// Inline query handler
bot.on('inline_query', async (inlineQuery) => {
  const query = inlineQuery.query?.trim();
  
  try {
    if (!INSTA_REGEX.test(query)) throw { code: 'INVALID_URL' };
    
    const media = await processMedia(inlineQuery.from.id, query);
    const results = media.map((item, index) => ({
      type: item.type === 'image' ? 'photo' : 'video',
      id: `${index}_${Date.now()}`,
      [item.type === 'image' ? 'photo_url' : 'video_url']: item.link,
      title: `Instagram ${item.type}`,
      description: `Click to send ${item.type}`,
      mime_type: item.type === 'video' ? 'video/mp4' : undefined,
      thumb_url: item.preview || item.link
    }));

    await bot.answerInlineQuery(inlineQuery.id, results, {
      cache_time: CACHE_TTL
    });
  } catch (error) {
    console.error('Inline query error:', error);
    await bot.answerInlineQuery(inlineQuery.id, [{
      type: 'article',
      id: 'error',
      title: 'Download Failed',
      input_message_content: {
        message_text: `Failed to download content: ${error.message}`
      }
    }]);
  }
});

// Global error handling
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

console.log(`🤖 Bot running as @${BOT_INFO.username}`);
