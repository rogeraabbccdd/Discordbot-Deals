const axios = require('axios')
const cheerio = require('cheerio')

module.exports = async () => {
  const sale = {
    start: '',
    end: '',
    name: ''
  }

  try {
    const { data } = await axios.get('https://steamdb.info/sales/history/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.106 Safari/537.36'
      }
    })

    const $ = cheerio.load(data)
    sale.name = $('.wrapper-info.text-center.next-sale .sale-name').text()
    // sale is live
    if (!sale.name || sale.name.length === 0) {
      sale.name = $('.wrapper-info.text-center.next-sale h2').text()
    }
    $('.span4.panel.panel-sale').each(function () {
      if ($(this).find('.panel-body h4 a').text().trim() === sale.name) {
        const dates = $(this).find('.panel-body div:not(.i.muted)').text().split(' — ')
        sale.start = dates[0]
        sale.end = dates[1]
        let tmp = sale.start.split(' ')
        sale.start += (tmp.length === 3) ? '' : ' ' + new Date().getFullYear()
        sale.start += ' 10:00 am GMT-0800'
        tmp = sale.end.split(' ')
        sale.end += (tmp.length === 3) ? '' : ' ' + new Date().getFullYear()
        sale.end += ' 10:00 am GMT-0800'
        return false
      }
    })
    sale.start = new Date(new Date(sale.start).toLocaleString('en-US', { timeZone: 'Asia/Taipei' })).getTime()
    sale.end = new Date(new Date(sale.end).toLocaleString('en-US', { timeZone: 'Asia/Taipei' })).getTime()
  } catch (error) {
    console.log('Fetch Sale Error')
    if (process.env.ERROR === 'true') console.log(error)
  }

  return sale
}
