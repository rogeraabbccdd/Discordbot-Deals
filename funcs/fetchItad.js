const axios = require('axios')

/**
 * Get ITAD game info by id
 * @param {*} itadId ITAD game id
 * @returns result
 */
module.exports = async (itadId) => {
  try {
    // Fetch game info
    const fetchInfo = axios.get('https://api.isthereanydeal.com/games/info/v2', {
      params: {
        key: process.env.ITAD_KEY,
        id: itadId
      }
    })
    // Fetch price overview for current low deal link
    const fetchPrice = axios.post('https://api.isthereanydeal.com/games/prices/v2', [itadId], {
      params: {
        key: process.env.ITAD_KEY,
        country: 'TW'
      }
    })
    // Fetch current lowest price
    const fetchLowest = axios.post('https://api.isthereanydeal.com/games/storelow/v2', [itadId], {
      params: {
        key: process.env.ITAD_KEY,
        country: 'TW'
      }
    })
    // Fetch history lowest price
    const fetchHistory = axios.post('https://api.isthereanydeal.com/games/historylow/v1', [itadId], {
      params: {
        key: process.env.ITAD_KEY,
        country: 'TW'
      }
    })
    // Fetch bundles
    const fetchBundles = axios.get('https://api.isthereanydeal.com/games/bundles/v2', {
      params: {
        key: process.env.ITAD_KEY,
        id: itadId,
        expired: true
      }
    })
    const results = await Promise.all([fetchInfo, fetchPrice, fetchLowest, fetchHistory, fetchBundles])
    return [results[0].data, results[1].data, results[2].data, results[3].data, results[4].data]
  } catch (error) {
    console.log('Fetch ITAD Error')
    if (process.env.ERROR === 'true') console.log(error)
  }
}
