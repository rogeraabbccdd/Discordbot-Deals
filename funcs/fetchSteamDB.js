const axios = require('axios')

module.exports = async (id) => {
  let result = {}

  try {
    const { data } = await axios.get('https://extension.steamdb.info/api/ExtensionAppPrice/', {
      params: {
        appid: id,
        currency: 'TWD'
      },
      headers: {
        Accept: 'application/json',
        'Dnt': '1',
        Origin: 'chrome-extension://kdbmhfkmnlmbkgbabkdealhhbfhlmmon',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        'X-Requested-With': 'SteamDB',
      }
    })
    result = data
  } catch (error) {
    console.log('Fetch SteamDB Error')
    if (process.env.ERROR === 'true') console.log(error)
  }

  return result
}
