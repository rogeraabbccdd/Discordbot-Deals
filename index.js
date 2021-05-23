require('dotenv').config()
const Discord = require('discord.js')
const axios = require('axios')
const schedule = require('node-schedule')
const getColors = require('get-image-colors')
const cheerio = require('cheerio')
const dayjs = require('dayjs')
const relativeTime = require('dayjs/plugin/relativeTime')
require('dayjs/locale/zh-tw')

const client = new Discord.Client()

dayjs.extend(relativeTime)

const formatDate = (date) => {
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`
}

const getItadPlainByName = (json, name) => json.data.list.filter((list) => list.title.trim().toUpperCase() === name.trim().toUpperCase())

const getSteamInfoByPlain = (json, plain) => {
  const steam = json.data.list.filter((list) => {
    return list.plain === plain && list.shop.id === 'steam'
  })
  if (steam.length > 0) {
    const steamUrl = steam[0].urls.buy
    const info = steamUrl.match(/\/(app|sub|bundle|friendsthatplay|gamecards|recommended)\/([0-9]{1,7})/)
    return info ? { id: parseInt(info[2], 10), type: info[1] } : { id: -1, type: 'null' }
  } else return { id: -1, type: 'null' }
}

const itadShops = 'amazonus,bundlestars,chrono,direct2drive,dlgamer,dreamgame,fireflower,gamebillet,gamejolt,gamersgate,gamesplanet,gog,humblestore,humblewidgets,impulse,indiegalastore,indiegamestand,itchio,macgamestore,newegg,origin,paradox,savemi,silagames,squenix,steam,uplay,wingamestore'

let exRateUSDTW = 30

const exRateUpdate = () => {
  axios.get('https://tw.rter.info/capi.php').then((res) => {
    exRateUSDTW = Math.round(res.data.USDTWD.Exrate * 100) / 100
  })
}

const sale = {
  start: '',
  end: '',
  name: ''
}

const fetchSale = () => {
  axios.get('https://steamdb.info/sales/history/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36'
    }
  }).then(response => {
    const $ = cheerio.load(response.data)
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
  }).catch(() => {
    sale.start = ''
    sale.end = ''
    sale.name = ''
  })
}

exRateUpdate()
fetchSale()

schedule.scheduleJob('* * 0 * * *', function () {
  exRateUpdate()
  fetchSale()
})

let showSale = true
let changed = false
let loggedIn = false
setInterval(() => {
  if (!loggedIn) return
  const now = new Date()
  if (showSale && sale.name.length > 0) {
    const time = now.getTime()
    let text = ''
    if (time < sale.start) {
      text = `${sale.name} 將於 ${dayjs(sale.start).locale('zh-tw').fromNow()}開始`
    } else if (time < sale.end) {
      text = `${sale.name} 將於 ${dayjs(sale.start).locale('zh-tw').fromNow()}結束`
    } else {
      text = `${sale.name} 已結束`
    }
    client.user.setActivity(text, { type: 'LISTENING' })
  } else {
    client.user.setActivity('使用 !itadhelp 查詢指令', { type: 'LISTENING' })
  }

  if ((now.getMinutes() === 0 || now.getMinutes() === 30) && !changed) {
    showSale = !showSale
    changed = true
  } else {
    changed = false
  }
}, 1000)

const embedColor = '#66c0f4'
const embedColorError = '#ff2222'

const getItadData = async (name) => {
  let embed = new Discord.MessageEmbed()
  let react = '❌'
  try {
    const query = encodeURIComponent(name.trim())
    let json = {}
    let json2 = {}
    let json3 = {}

    /* search game */
    json = await axios.get(`https://api.isthereanydeal.com/v01/search/search/?key=${process.env.ITAD_KEY}&q=${query}&offset=&limit=200&region=us&country=US&shops=${itadShops}`)
    const searchJson = json.data
    const find = getItadPlainByName(searchJson, name)
    if (find.length === 0) {
      embed.setColor(embedColorError)
      if (searchJson.data.list.length === 0) embed.setTitle(`找不到符合 ${query} 的遊戲`)
      else {
        searchJson.data.list.sort((a, b) => a.title.length - b.title.length || a.title.localeCompare(b.title))
        embed.setTitle(`找不到符合 ${query} 的遊戲，你是不是要找...\n\u200b`)

        const addedGames = []
        // j = array index
        let j = 0
        // i = max 5 suggestions
        for (let i = 0; i < 5; i++) {
          if (searchJson.data.list[j]) {
            if ((j === 0) || (j > 0 && !addedGames.includes(searchJson.data.list[j].title))) {
              addedGames.push(searchJson.data.list[j].title)
              embed.addField(searchJson.data.list[j].title, `https://isthereanydeal.com/game/${searchJson.data.list[j].plain}`)
            } else i--
          } else break
          j++
        }
      }
    } else {
      const { plain } = find[0]
      const appTitle = find[0].title
      const appInfo = getSteamInfoByPlain(searchJson, plain)
      embed.setTitle(appTitle)
      embed.setColor(embedColor)

      json = axios.get(`https://api.isthereanydeal.com/v01/game/lowest/?key=${process.env.ITAD_KEY}&plains=${plain}&shops=${itadShops}`)
      json2 = axios.get(`https://api.isthereanydeal.com/v01/game/prices/?key=${process.env.ITAD_KEY}&plains=${plain}&shops=${itadShops}`)
      json3 = axios.get(`https://api.isthereanydeal.com/v01/game/bundles/?key=${process.env.ITAD_KEY}&plains=${plain}&expired=0`)
      json = await json
      json2 = await json2
      json3 = await json3
      const lowest = json.data.data[plain]
      const current = json2.data.data[plain].list[0]
      const bundle = json3.data.data[plain]

      const rDeal =
        `原價: ${current.price_old} USD / ${Math.round(current.price_old * exRateUSDTW * 100) / 100} TWD\n` +
        `目前最低: ${current.price_new} USD / ${Math.round(current.price_new * exRateUSDTW * 100) / 100} TWD, -${current.price_cut}%, 在 ${current.shop.name}\n` +
        `歷史最低: ${lowest.price} USD / ${Math.round(lowest.price * exRateUSDTW * 100) / 100} TWD, -${lowest.cut}%, ${formatDate(new Date(lowest.added * 1000))}在 ${lowest.shop.name}\n` +
        `${current.url}`

      let rInfo = `https://isthereanydeal.com/game/${plain}/info/\n`

      let rBundle = `總入包次數: ${bundle.total}`

      if (bundle.list.length > 0) {
        rBundle += '\n目前入包:\n'
        for (const b of bundle.list) {
          rBundle += `${b.title}, ~${formatDate(new Date(b.expiry * 1000))}\n${b.url}`
        }
      }

      let rSteam = ''

      /* is steam */
      if (appInfo.id !== -1) {
        rInfo += `https://store.steampowered.com/${appInfo.type}/${appInfo.id}/\n` +
          `https://steamdb.info/${appInfo.type}/${appInfo.id}/`

        if (appInfo.type === 'app') {
          const replyImage = `https://steamcdn-a.akamaihd.net/steam/apps/${appInfo.id}/header.jpg`
          let embedColorApp = embedColor
          getColors(replyImage).then(colors => {
            colors = colors.map(color => color.hex())
            embedColorApp = colors[0]
            embed.setColor(embedColorApp)
          })

          embed.setImage(replyImage)

          json = await axios.get(`http://store.steampowered.com/api/appdetails/?appids=${appInfo.id}&cc=tw&filters=price_overview`)
          const steamOV = json.data

          if (steamOV[appInfo.id].success && typeof steamOV[appInfo.id].data === 'object') {
            const price = steamOV[appInfo.id].data.price_overview
            rSteam += `原價: ${price.initial_formatted.length === 0 ? price.final_formatted : price.initial_formatted}, \n` +
              `目前價格: ${price.final_formatted}, -${price.discount_percent}%`

            json = await axios.get(`https://steamdb.info/api/ExtensionGetPrice/?appid=${appInfo.id}&currency=TWD`, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36'
              }
            })
            const steamLow = json.data
            const lowestRegex = /(?<date1>\d+\s[A-Za-z]+\s+\d+)\s\((?<times>\d+)\stimes,\sfirst\son\s(?<date2>\d+\s[A-Za-z]+\s+\d+)\)/
            const lowestResults = steamLow.data.lowest.date.match(lowestRegex)
            let lowestStr = ''
            if (lowestResults) lowestStr += `最近一次為 ${formatDate(new Date(lowestResults.groups.date1))}, 從 ${formatDate(new Date(lowestResults.groups.date2))}開始共出現 ${lowestResults.groups.times} 次`
            else lowestStr += formatDate(new Date(steamLow.data.lowest.date))
            if (steamLow.success) rSteam += `\n歷史最低: ${steamLow.data.lowest.price}, -${steamLow.data.lowest.discount}%, ${lowestStr}\n`
          }
        } else if (appInfo.type === 'sub') {
          json = await axios.get(`https://store.steampowered.com/api/packagedetails/?packageids=${appInfo.id}&cc=tw`)
          const steamOV = json.data
          if (steamOV[appInfo.id].success) {
            const { price } = steamOV[appInfo.id].data
            rSteam += `原價:  NT$ ${price.initial / 100}\n` +
              `單買原價:  NT$ ${price.individual / 100}\n` +
              `目前價格:  NT$ ${price.final / 100}, -${price.discount_percent}%`
          }
        }
      }
      embed
        .addField('isthereanydeal', rDeal + '\n\u200b')
        .addField('入包資訊', rBundle + '\n\u200b')

      if (rSteam.length > 0) embed.addField('Steam', rSteam + '\n\u200b')

      embed.addField('更多資訊', rInfo)

      react = '✅'
    }
  } catch (err) {
    console.log(err)
    react = '❌'
    embed = new Discord.RichEmbed().setColor(embedColorError).setTitle('遊戲資料查詢失敗，請再試一次')
  }
  return { embed, react }
}

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`)
})

client.on('message', msg => {
  if (msg.content && !msg.author.bot) {
    if (msg.content === '!itadhelp') {
      msg.react(process.env.LOADING_EMOJI.toString())
      const reply =
        ':desktop:  機器人指令\n' +
        '• `!itad 遊戲名稱` - 查詢遊戲資訊\n' +
        '\n:link:  相關連結\n' +
        '• 巴哈文章: https://forum.gamer.com.tw/C.php?bsn=60599&snA=27046\n' +
        '• 邀請連結: https://discordapp.com/oauth2/authorize?client_id=634902541687324702&scope=bot&permissions=28832\n' +
        '• 機器人原始碼: https://github.com/rogeraabbccdd/Discordbot-Deals'
      msg.channel.send(reply)
      msg.reactions.removeAll().then(() => {
        msg.react('✅').catch()
      }).catch()
    } else if (msg.content.substring(0, 6) === '!itad ') {
      msg.react(process.env.LOADING_EMOJI.toString())
      const name = msg.content.split('!itad ')[1]
      getItadData(name).then((data) => {
        msg.channel.send(data.embed)
        msg.reactions.removeAll().then(() => {
          msg.react(data.react).catch()
        }).catch()
      })
    }
  }
})

client.login(process.env.DISCORD_TOKEN).then(() => {
  loggedIn = true
})
