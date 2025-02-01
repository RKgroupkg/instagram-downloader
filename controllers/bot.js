const TelegramBot = require('node-telegram-bot-api');
const instaScrapper = require('./insta');
require('dotenv').config();

const token = process.env.TELEGRAM_API;
const bot = new TelegramBot(token, { polling: true });
const username = 'Instdlp_rkbot';
const developer = '@Rkgroup5316';

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

bot.on('inline_query', async (inlineQuery) => {
  const query = inlineQuery.query?.trim();
  const userId = inlineQuery.from.id;

  try {
    // Show loading status immediately
    await bot.answerInlineQuery(inlineQuery.id, [], {
      cache_time: 1,
      button: {
        text: "How to use?",
        start_parameter: "inline_help"
      }
    });

    // Empty query handling
    if (!query) {
      return bot.answerInlineQuery(inlineQuery.id, [{
        type: 'article',
        id: 'help',
        title: '❓ How to Use',
        description: 'Paste any Instagram post/reel link',
        input_message_content: {
          message_text: `Send Instagram links directly to @${username} or paste them here!\n\nExample: https://www.instagram.com/p/Cexample/`,
          parse_mode: 'HTML'
        }
      }]);
    }

    // Validate URL format
    const instaRegex = /^https?:\/\/(www\.)?instagram\.com\/(p|reel|reels)\/[\w-]+/i;
    if (!instaRegex.test(query)) {
      return bot.answerInlineQuery(inlineQuery.id, [{
        type: 'article',
        id: 'invalid_url',
        title: '❌ Invalid URL',
        description: 'Use format: instagram.com/p/... or instagram.com/reel/...',
        input_message_content: {
          message_text: `Invalid Instagram URL format. Please use:\n\n• Post: https://www.instagram.com/p/...\n• Reel: https://www.instagram.com/reel/...\n\nTry with @${username}!`,
          parse_mode: 'HTML'
        }
      }]);
    }

    // Fetch media
    const mediaItems = await instaScrapper(query);
    
    if (!mediaItems?.length) {
      return bot.answerInlineQuery(inlineQuery.id, [{
        type: 'article',
        id: 'no_media',
        title: '⚠️ No Media Found',
        description: 'This post might be private or unavailable',
        input_message_content: {
          message_text: `Couldn't find any media in this post. Ensure:\n1. The account is public\n2. The link is correct\n3. Try again later`,
          parse_mode: 'HTML'
        }
      }]);
    }

    // Format results with visual feedback
    const results = mediaItems.map((media, index) => ({
      type: media.type === 'image' ? 'photo' : 'video',
      id: `media_${Date.now()}_${index}`,
      [media.type === 'image' ? 'photo_url' : 'video_url']: media.link,
      thumb_url: media.link, // Use media as thumbnail
      title: `${media.type === 'image' ? '📷 Photo' : '🎥 Video'} ${index + 1}/${mediaItems.length}`,
      description: `Click to send ${media.type}`,
      caption: `Downloaded via <a href="https://t.me/${username}">@${username}</a>`,
      parse_mode: 'HTML'
    }));

    // Add help button as first result
    results.unshift({
      type: 'article',
      id: 'help_top',
      title: 'ℹ️ How to Use',
      description: 'Send Instagram links directly to this bot!',
      input_message_content: {
        message_text: `Share Instagram links directly with @${username} for instant downloads!\n\nWorks with:\n• Posts\n• Reels\n• Carousels`,
        parse_mode: 'HTML'
      }
    });

    return bot.answerInlineQuery(inlineQuery.id, results, {
      cache_time: 300,
      is_personal: true
    });

  } catch (error) {
    console.error('Inline error:', error);
    return bot.answerInlineQuery(inlineQuery.id, [{
      type: 'article',
      id: 'error',
      title: '⚠️ Service Unavailable',
      description: 'Try again in a few moments',
      input_message_content: {
        message_text: `Temporary service interruption. Please try:\n1. Checking your link\n2. Waiting 1 minute\n3. Contacting @${developer}`,
        parse_mode: 'HTML'
      }
    }]);
  }
});

module.exports = bot;
