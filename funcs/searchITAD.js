const axios = require('axios')

module.exports = async (name) => {
  let result = []

  try {
    const { data } = await axios.get('https://api.isthereanydeal.com/games/search/v1', {
      params: {
        key: process.env.ITAD_KEY,
        title: name
      }
    })
    result = data
  } catch (error) {
    console.log('Search Error')
    if (process.env.ERROR === 'true') console.log(error)
  }

  return result
}
