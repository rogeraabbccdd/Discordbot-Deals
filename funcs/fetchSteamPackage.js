const axios = require('axios')

module.exports = async (id) => {
  let result = {}

  try {
    const { data } = await axios.get('https://store.steampowered.com/api/packagedetails/', {
      params: {
        appid: id,
        currency: 'TWD'
      }
    })
    result = data
  } catch (error) {
    console.log('Fetch Steam Package Error')
    if (process.env.ERROR === 'true') console.log(error)
  }

  return result
}
