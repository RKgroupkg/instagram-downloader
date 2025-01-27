const TelegramBot = require('node-telegram-bot-api');
const instaScrapper = require('./insta');
require('dotenv').config();

// Replace the value below with the Telegram token you receive from @BotFather
const token = process.env.TELEGRAM_API;

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });

// Handle the /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    "Send me any Instagram link (except for stories) below and I'll send it back to you as a media file. Or, use inline mode by typing @YourBotUsername followed by the Instagram link!"
  );
});

// Handle regular messages for direct Instagram link processing
bot.on('message', async (msg) => {
  if (msg.text !== '/start' && msg.text.includes('https://www.instagram.com/')) {
    try {
      bot.sendMessage(msg.chat.id, 'Processing your link, please wait...');
      const post = await instaScrapper(msg.text);
      const chatId = msg.chat.id;

      if (post.length > 0) {
        post.forEach((media) => {
          if (media.type === 'image') {
            bot.sendPhoto(chatId, media.link);
          } else if (media.type === 'video') {
            bot.sendVideo(chatId, media.link);
          } else {
            bot.sendMessage(chatId, 'There was an error sending your link, please try again later');
          }
        });
      } else {
        bot.sendMessage(chatId, 'Could not find the media for that link.');
      }
    } catch (err) {
      console.error(err);
      bot.sendMessage(chatId, 'An error occurred while processing the link. Try again!');
    }
  }
});

// Handle inline queries
bot.on('inline_query', async (inlineQuery) => {
  const query = inlineQuery.query;

  if (!query || !query.includes('https://www.instagram.com/')) {
    // If the query is empty or invalid, return a default response
    return bot.answerInlineQuery(inlineQuery.id, [
      {
        type: 'article',
        id: '1',
        title: 'Enter a valid Instagram Reel URL',
        input_message_content: {
          message_text: 'Please provide a valid Instagram link (e.g., https://www.instagram.com/p/...)',
        },
      },
    ]);
  }

  try {
    // Process the Instagram URL
    const post = await instaScrapper(query);

    if (post.length > 0) {
      const results = post.map((media, index) => {
        if (media.type === 'image') {
          return {
            type: 'photo',
            id: `photo_${index}`,
            photo_url: media.link,
            thumb_url: media.link, // Use the same URL for thumbnail
            caption: 'Instagram Media',
          };
        } else if (media.type === 'video') {
          return {
            type: 'video',
            id: `video_${index}`,
            video_url: media.link,
            mime_type: 'video/mp4',
            thumb_url: media.link, // Video preview as thumbnail
            title: 'Instagram Reel',
          };
        }
      });

      bot.answerInlineQuery(inlineQuery.id, results);
    } else {
      bot.answerInlineQuery(inlineQuery.id, [
        {
          type: 'article',
          id: '2',
          title: 'Media not found',
          input_message_content: {
            message_text: 'Could not retrieve media from the provided Instagram link.',
          },
        },
      ]);
    }
  } catch (err) {
    console.error(err);
    bot.answerInlineQuery(inlineQuery.id, [
      {
        type: 'article',
        id: '3',
        title: 'Error processing the link',
        input_message_content: {
          message_text: 'An error occurred while processing the link. Please try again later.',
        },
      },
    ]);
  }
});

module.exports = bot;
