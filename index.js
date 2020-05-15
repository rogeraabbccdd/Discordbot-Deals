require('dotenv').config()

const Discord = require('discord.js')
const client = new Discord.Client()

const rp = require('request-promise')
const schedule = require('node-schedule')
const cloudscraper = require('cloudscraper')

const getColors = require('get-image-colors')

const formatDate = (date) => {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
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
  rp('https://tw.rter.info/capi.php').then((res) => {
    exRateUSDTW = Math.round(JSON.parse(res).USDTWD.Exrate * 100) / 100
  })
}

exRateUpdate()

schedule.scheduleJob('* * 0 * * *', function () {
  exRateUpdate()
})

const embedColor = '#66c0f4'
const embedColorError = '#ff2222'

const getItadData = async (name) => {
  let embed = new Discord.RichEmbed()
  let react = '❌'
  try {
    const query = encodeURIComponent(name.trim())
    let htmlString = ''

    /* search game */
    htmlString = await rp(`https://api.isthereanydeal.com/v01/search/search/?key=${process.env.ITAD_KEY}&q=${query}&offset=&limit=&region=us&country=US&shops=${itadShops}`)
    const searchJson = JSON.parse(htmlString)
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

      htmlString = await rp(`https://api.isthereanydeal.com/v01/game/lowest/?key=${process.env.ITAD_KEY}&plains=${plain}&shops=${itadShops}`)
      const lowest = JSON.parse(htmlString).data[plain]
      htmlString = await rp(`https://api.isthereanydeal.com/v01/game/prices/?key=${process.env.ITAD_KEY}&plains=${plain}&shops=${itadShops}`)
      const current = JSON.parse(htmlString).data[plain].list[0]

      const rDeal =
        `原價: ${current.price_old} USD / ${Math.round(current.price_old * exRateUSDTW * 100) / 100} TWD\n` +
        `目前最低: ${current.price_new} USD / ${Math.round(current.price_new * exRateUSDTW * 100) / 100} TWD, -${current.price_cut}%, 在 ${current.shop.name}\n` +
        `歷史最低: ${lowest.price} USD / ${Math.round(lowest.price * exRateUSDTW * 100) / 100} TWD, -${lowest.cut}%, ${formatDate(new Date(lowest.added * 1000))} 在 ${lowest.shop.name}\n` +
        `${current.url}`

      let rInfo = `https://isthereanydeal.com/game/${plain}/info/\n`

      htmlString = await rp(`https://api.isthereanydeal.com/v01/game/bundles/?key=${process.env.ITAD_KEY}&plains=${plain}&expired=0`)
      const bundle = JSON.parse(htmlString).data[plain]

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

          htmlString = await rp(`http://store.steampowered.com/api/appdetails/?appids=${appInfo.id}&cc=tw&filters=price_overview`)
          const steamOV = JSON.parse(htmlString)

          if (steamOV[appInfo.id].success && typeof steamOV[appInfo.id].data === 'object') {
            const price = steamOV[appInfo.id].data.price_overview
            rSteam += `原價: ${price.initial_formatted.length === 0 ? price.final_formatted : price.initial_formatted}, \n` +
              `目前價格: ${price.final_formatted}, -${price.discount_percent}%`

            // htmlString = await cloudscraper(`https://steamdb.info/api/ExtensionGetPrice/?appid=${appInfo.id}&currency=TWD`)
            // const steamLow = JSON.parse(htmlString)
            // if (steamLow.success) rSteam += `\n歷史最低: ${steamLow.data.lowest.price}, -${steamLow.data.lowest.discount}%, ${formatDate(new Date(steamLow.data.lowest.date))}\n`
          }
        } else if (appInfo.type === 'sub') {
          htmlString = await rp(`https://store.steampowered.com/api/packagedetails/?packageids=${appInfo.id}&cc=tw`)
          const steamOV = JSON.parse(htmlString)
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
      msg.clearReactions().then(() => {
        msg.react('✅').catch()
      }).catch()
    } else if (msg.content.substring(0, 6) === '!itad ') {
      msg.react(client.emojis.get(process.env.LOADING_EMOJI))
      const name = msg.content.split('!itad ')[1]
      getItadData(name).then((data) => {
        msg.channel.send(data.embed)
        msg.clearReactions().then(() => {
          msg.react(data.react).catch()
        }).catch()
      })
    }
  }
})

client.login(process.env.DISCORD_TOKEN).then(() => {
  client.user.setActivity('使用 !iteadhelp 查詢指令', { type: 'LISTENING' })
})
