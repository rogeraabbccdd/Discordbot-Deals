const axios = require('axios')

module.exports = async (id) => {
  let result = {
    found: false
  }

  try {
    const { data } = await axios.get('https://api.isthereanydeal.com/games/lookup/v1', {
      params: {
        key: process.env.ITAD_KEY,
        appid: id
      }
    })
    result = data
  } catch (error) {
    console.log('Search Error')
    if (process.env.ERROR === 'true') console.log(error)
  }

  return result
}
