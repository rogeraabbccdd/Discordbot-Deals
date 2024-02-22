const axios = require('axios')

module.exports = async (id) => {
  let result = {}

  try {
    const { data } = await axios.get('https://steamdb.info/api/ExtensionGetPrice/', {
      params: {
        appid: id,
        currency: 'TWD'
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
        'X-Requested-With': 'SteamDB'
      }
    })
    result = data
  } catch (error) {
    console.log('Fetch SteamDB Error')
    if (process.env.ERROR === 'true') console.log(error)
  }

  return result
}
