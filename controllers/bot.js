const TelegramBot = require('node-telegram-bot-api');
const instaScrapper = require('./insta');
require('dotenv').config();

// Replace with your BotFather token
const token = process.env.TELEGRAM_API;

// Create a bot using polling
const bot = new TelegramBot(token, { polling: true });

// Centralized error handler
const handleError = (chatId, error) => {
  console.error('Error:', error);
  bot.sendMessage(chatId, 'Something went wrong! Please try again later.');
};

// Handle the /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    "Send me any Instagram link (except for stories) and I'll send it back to you as a media file. You can also use me in inline mode by typing @YourBotUsername followed by the Instagram link!"
  );
});

// Handle direct Instagram links in messages
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  try {
    // Ensure msg.text exists before processing
    if (msg.text && msg.text !== '/start' && msg.text.includes('https://www.instagram.com/')) {
      bot.sendMessage(chatId, 'Processing your link, please wait...');
      const post = await instaScrapper(msg.text);

      if (post && post.length > 0) {
        post.forEach((media) => {
          if (media.type === 'image') {
            bot.sendPhoto(chatId, media.link);
          } else if (media.type === 'video') {
            bot.sendVideo(chatId, media.link);
          } else {
            bot.sendMessage(chatId, 'Unsupported media type.');
          }
        });
      } else {
        bot.sendMessage(chatId, 'No media found for this link.');
      }
    } else if (!msg.text) {
      bot.sendMessage(chatId, 'Please send a valid Instagram link.');
    }
  } catch (error) {
    handleError(chatId, error);
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
