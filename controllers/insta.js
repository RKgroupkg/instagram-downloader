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
    timeout: 10000 // 10-second timeout
  };

  try {
    const response = await axios.request(options);
    
    // Validate API response structure
    if (!response.data?.data?.medias) {
      throw new Error('Invalid API response structure');
    }

    // Process media URLs
    return response.data.data.medias.map(media => ({
      type: media.type === 'photo' ? 'image' : 'video',
      link: media.url,
      thumbnail: media.previewUrl
    }));

  } catch (error) {
    // Enhanced error handling
    let errorMessage = 'Failed to fetch content';
    
    if (error.response) {
      // Handle API-specific errors
      errorMessage = error.response.data?.message || 
        `API Error: ${error.response.status}`;
    } else if (error.request) {
      errorMessage = 'No response from API server';
    }
    
    throw new Error(errorMessage);
  }
};

module.exports = instaScrapper;
