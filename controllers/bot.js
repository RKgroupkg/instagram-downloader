const TelegramBot = require('node-telegram-bot-api');
const instaScrapper = require('./insta');
require('dotenv').config();

const token = process.env.TELEGRAM_API;
const bot = new TelegramBot(token, { polling: true });

const username = 'Instdlp_rkbot';
const developer = 'RKGroup';

// Modified welcome message with HTML formatting
const message = `<b>Welcome to @${username}!</b> 📸

Send me any Instagram link, and I'll send it back as media!

<i>Developed by ${developer}</i>`;

const startMarkup = {
  inline_keyboard: [
    [
      { text: 'How to Use 📖', callback_data: 'help' },
      { text: 'Share Bot 📤', callback_data: 'share_bot' }
    ],
    [{ text: 'Use Inline Mode 🔍', switch_inline_query_current_chat: '' }]
  ]
};

// Handle /start with inline buttons
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendChatAction(chatId, 'typing');
  bot.sendMessage(chatId, message, {
    parse_mode: 'HTML',
    reply_markup: startMarkup
  });
});

// Handle button callbacks
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  
  switch(query.data) {
    case 'share_bot':
      bot.sendMessage(chatId, `Help others download Instagram content! Share me: https://t.me/${username}`);
      break;
    case 'help':
      bot.sendMessage(chatId, "Just send any Instagram post/reel link or use inline mode with @${username}");
      break;
  }
});

// Modified message handler with auto-delete processing message
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  if (!msg.text || msg.text === '/start' || !msg.text.includes('instagram.com/')) return;

  try {
    const processingMsg = await bot.sendMessage(chatId, '⏳ Processing your request...');
    const post = await instaScrapper(msg.text);

    // Delete processing message before sending results
    await bot.deleteMessage(chatId, processingMsg.message_id);

    if (!post?.length) {
      // Add this before processing messages
      bot.sendChatAction(chatId, 'typing');
      return bot.sendMessage(chatId, '❌ No media found for this link');
    }

    for (const media of post) {
      bot.sendChatAction(chatId, 'typing');
      media.type === 'image' 
        ? await bot.sendPhoto(chatId, media.link)
        : await bot.sendVideo(chatId, media.link);
    }
  } catch (error) {
    console.error('Error:', error);
    bot.sendChatAction(chatId, 'typing');
    bot.sendMessage(chatId, '❌ Something went wrong! Please try again.');
  }
});

// Handle inline queries
bot.on('inline_query', async (inlineQuery) => {
  const query = inlineQuery.query?.trim(); // Safely handle undefined or empty queries

  // Validate the query
  if (!query || !query.startsWith('https://www.instagram.com/')) {
    return bot.answerInlineQuery(inlineQuery.id, [
      {
        type: 'article',
        id: 'invalid_query',
        title: 'Enter a valid Instagram URL',
        input_message_content: {
          message_text: 'Please provide a valid Instagram link (e.g., https://www.instagram.com/p/...).',
        },
        description: 'Example: https://www.instagram.com/p/abc123/',
      },
    ]);
  }

  try {
    const post = await instaScrapper(query); // Fetch Instagram media

    if (!post || post.length === 0) {
      // No media found for the link
      return bot.answerInlineQuery(inlineQuery.id, [
        {
          type: 'article',
          id: 'no_media',
          title: 'No media found',
          input_message_content: {
            message_text: 'No media could be retrieved for this Instagram link. Please check the URL and try again.',
          },
          description: 'Ensure the link is public and points to a valid post.',
        },
      ]);
    }

    // Build results for media
    const results = post.map((media, index) => {
      if (media.type === 'image') {
        return {
          type: 'photo',
          id: `photo_${index}`,
          photo_url: media.link,
          thumb_url: media.link,
          caption: 'Instagram Image',
        };
      } else if (media.type === 'video') {
        return {
          type: 'video',
          id: `video_${index}`,
          video_url: media.link,
          mime_type: 'video/mp4',
          thumb_url: media.link,
          title: 'Instagram Video',
          description: 'Instagram Video Reel',
        };
      }
    });

    // Respond with results
    return bot.answerInlineQuery(inlineQuery.id, results);
  } catch (error) {
    console.error('Error handling inline query:', error);

    // Return a generic error message to the user
    return bot.answerInlineQuery(inlineQuery.id, [
      {
        type: 'article',
        id: 'processing_error',
        title: 'Error processing link',
        input_message_content: {
          message_text: 'An error occurred while processing the Instagram link. Please try again later.',
        },
        description: 'This might be due to an invalid link or temporary server issues.',
      },
    ]);
  }
});

module.exports = bot;
