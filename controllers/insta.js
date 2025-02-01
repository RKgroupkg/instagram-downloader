const axios = require('axios');
require('dotenv').config();

const APIKey = process.env.RAPID_API_KEY;
const APIHost = process.env.RAPID_API_HOST;

const instaScrapper = async (url) => {
  const options = {
    method: 'GET',
    url: 'https://instagram-looter2.p.rapidapi.com/post-dl',
    params: { link: url },
    headers: {
      'X-RapidAPI-Key': APIKey,
      'X-RapidAPI-Host': APIHost
    },
    timeout: 10000
  };

  try {
    const response = await axios.request(options);
    
    // Validate response structure
    if (!response.data?.data?.medias) {
      throw new Error('Invalid API response structure');
    }

    // Process media for your specific API format
    return response.data.data.medias.map(media => ({
      type: media.type === 'image' ? 'image' : 'video', // Match your API's "image" type
      link: media.link // Your API uses "link" not "url"
    }));

  } catch (error) {
    let errorMessage = 'Failed to fetch content';
    
    if (error.response) {
      errorMessage = error.response.data?.message || 
        `API Error: ${error.response.status}`;
    } else if (error.request) {
      errorMessage = 'No response from API server';
    } else {
      errorMessage = error.message;
    }
    
    throw new Error(errorMessage);
  }
};

module.exports = instaScrapper;
