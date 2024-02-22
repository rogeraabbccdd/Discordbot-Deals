require('dotenv').config()
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js')
const schedule = require('node-schedule')
const getColors = require('get-image-colors')
const dayjs = require('dayjs')
const relativeTime = require('dayjs/plugin/relativeTime')
require('dayjs/locale/zh-tw')
const searchITAD = require('./funcs/searchITAD')
const findNameInResults = require('./funcs/findNameInResults')
const exRateUpdate = require('./funcs/exRateUpdate')
const formatDate = require('./funcs/formatDate')
const fetchItad = require('./funcs/fetchItad')
const fetchSteamApp = require('./funcs/fetchSteamApp')
const fetchSteamDB = require('./funcs/fetchSteamDB')
const fetchSale = require('./funcs/fetchSale')
const createCommands = require('./funcs/createCommands')

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.DirectMessageTyping
  ]
})

dayjs.extend(relativeTime)

let exRateUSDTW = 30

let sale = {
  start: '',
  end: '',
  name: ''
}

schedule.scheduleJob('0 0 0 * * *', async () => {
  exRateUSDTW = await exRateUpdate()
  sale = await fetchSale()
})

const showSale = false
let changed = false
let loggedIn = false

const helpReply =
':desktop:  機器人指令\n' +
'• `/itad 遊戲名稱` - 查詢遊戲資訊\n' +
'\n:link:  相關連結\n' +
'• 巴哈文章: https://forum.gamer.com.tw/C.php?bsn=60599&snA=27046\n' +
'• 邀請連結: https://discordapp.com/oauth2/authorize?client_id=634902541687324702&scope=bot&permissions=28832\n' +
'• 機器人原始碼: https://github.com/rogeraabbccdd/Discordbot-Deals'

// activity
setInterval(() => {
  if (!loggedIn) return
  const now = new Date()
  if (showSale && sale.name.length > 0) {
    const time = now.getTime()
    let text = ''
    if (time < sale.start) {
      text = `${sale.name} 將於 ${dayjs(sale.start).locale('zh-tw').fromNow()}開始`
    } else if (time < sale.end) {
      text = `${sale.name} 將於 ${dayjs(sale.end).locale('zh-tw').fromNow()}結束`
    } else {
      text = `${sale.name} 已結束`
    }
    client.user.setPresence({ activities: [{ name: text }], status: 'LISTENING' })
  } else {
    client.user.setPresence({ activities: [{ name: '使用 /itadhelp 查詢指令' }], status: 'LISTENING' })
  }

  if ((now.getMinutes() === 0 || now.getMinutes() === 30) && !changed) {
    // showSale = !showSale
    changed = true
  } else {
    changed = false
  }
}, 1000)

const embedColor = '#66c0f4'
const embedColorError = '#ff2222'

const getItadData = async (name) => {
  let embed = new EmbedBuilder()
  let react = '❌'
  try {
    /* search game */
    const apps = await searchITAD(name)
    const app = findNameInResults(apps, name)
    if (!app) {
      embed.setColor(embedColorError)
      if (apps.length === 0) embed.setTitle(`找不到符合 ${name} 的遊戲`)
      else {
        apps.sort((a, b) => a.title.length - b.title.length || a.title.localeCompare(b.title))
        embed.setTitle(`找不到符合 ${name} 的遊戲，你是不是要找...\n\u200b`)

        const addedGames = []
        // j = array index
        let j = 0
        // i = max 5 suggestions
        for (let i = 0; i < 5; i++) {
          if (apps[j]) {
            if ((j === 0) || (j > 0 && !addedGames.includes(apps[j].title))) {
              addedGames.push(apps[j].title)
              embed.addFields([
                { name: apps[j].title, value: `https://isthereanydeal.com/game/${apps[j].plain}` }
              ])
            } else i--
          } else break
          j++
        }
      }
    } else {
      // const { plain } = find[0]
      // const appTitle = find[0].title
      // const appInfo = getSteamInfoByPlain(search, plain)
      // embed.setTitle(appTitle)
      // embed.setColor(embedColor)

      const appResults = await fetchItad(app.id)
      const appInfo = appResults[0]
      // This is an empty array in some games, e.g. "Muse Dash"
      const appPrice = appResults[1]?.[0]?.deals?.sort((a, b) => b.cut - a.cut)?.[0]
      const appLowest = appResults[2][0].lows.sort((a, b) => b.cut - a.cut)[0]
      const appHistory = appResults[3][0].low
      const appBundles = appResults[4]

      let rDeal =
        `原價: ${appLowest.regular.amount} USD / ${Math.round(appLowest.regular.amount * exRateUSDTW * 100) / 100} TWD\n` +
        `目前最低: ${appLowest.price.amount} USD / ${Math.round(appLowest.price.amount * exRateUSDTW * 100) / 100} TWD, -${appLowest.cut}%, 在 ${appLowest.shop.name}`

      rDeal += `\n歷史最低: ${appHistory.price.amount} USD / ${Math.round(appHistory.price.amount * exRateUSDTW * 100) / 100} TWD, -${appHistory.cut}%, ${formatDate(new Date(appHistory.timestamp))}在 ${appHistory.shop.name}`

      if (appPrice) {
        rDeal += '\n' + appPrice.url
      }
      let rInfo = `https://isthereanydeal.com/game/${app.slug}/info/\n`

      /* bundles */
      let rBundle = `總入包次數: ${appBundles.length}`
      const activeBundles = appBundles.filter(bundle => new Date(bundle.expiry) > Date.now())
      if (activeBundles.length > 0) {
        rBundle += '\n目前入包:\n'
        for (const bundle of appBundles) {
          rBundle += `${bundle.title}, ~${formatDate(new Date(bundle.expiry))}\n${bundle.url}`
        }
      }

      let rSteam = ''

      /* is steam */
      if (appInfo.appid) {
        rInfo += `https://store.steampowered.com/app/${appInfo.appid}/\n` +
          `https://steamdb.info/app/${appInfo.appid}/`

        const replyImage = `https://steamcdn-a.akamaihd.net/steam/apps/${appInfo.appid}/header.jpg`
        let embedColorApp = embedColor
        getColors(replyImage).then(colors => {
          colors = colors.map(color => color.hex())
          embedColorApp = colors[0]
          embed.setColor(embedColorApp)
        })

        embed.setImage(replyImage)

        const steamOV = await fetchSteamApp(appInfo.appid)

        if (steamOV[appInfo.appid].success && typeof steamOV[appInfo.appid].data === 'object') {
          const price = steamOV[appInfo.appid].data.price_overview
          rSteam += `原價: ${price.initial_formatted.length === 0 ? price.final_formatted : price.initial_formatted}, \n` +
              `目前價格: ${price.final_formatted}, -${price.discount_percent}%`

          const steamLow = await fetchSteamDB(appInfo.appid)
          if (Object.keys(steamLow).length > 0) {
            const lowestRegex = /(?<date1>\d+\s[A-Za-z]+\s+\d+)\s\((?<times>\d+)\stimes,\sfirst\son\s(?<date2>\d+\s[A-Za-z]+\s+\d+)\)/
            const lowestResults = steamLow.data.lowest.date.match(lowestRegex)
            let lowestStr = ''
            if (lowestResults) lowestStr += `最近一次為 ${formatDate(new Date(lowestResults.groups.date1))}, 從 ${formatDate(new Date(lowestResults.groups.date2))}開始共出現 ${lowestResults.groups.times} 次`
            else lowestStr += formatDate(new Date(steamLow.data.lowest.date))
            if (steamLow.success) rSteam += `\n歷史最低: ${steamLow.data.lowest.price}, -${steamLow.data.lowest.discount}%, ${lowestStr}`
          }
        }
      }
      embed
        .addFields([
          { name: 'isthereanydeal 目前最低', value: rDeal + '\n\u200b' }
        ])

      if (rSteam.length > 0) {
        embed.addFields([
          { name: 'Steam', value: rSteam + '\n\u200b' }
        ])
      }
      embed.addFields([
        { name: '入包資訊', value: rBundle + '\n\u200b' }
      ])
      embed.addFields([
        { name: '更多資訊', value: rInfo }
      ])

      react = '✅'
    }
  } catch (err) {
    console.log(err)
    react = '❌'
    embed = new EmbedBuilder().setColor(embedColorError).setTitle('遊戲資料查詢失敗，請再試一次')
  }
  return { embed, react }
}

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`)

  const clientGuilds = client.guilds.cache.map(guild => guild.id)
  for (const clientGuild of clientGuilds) {
    const guild = client.channels.cache.get(clientGuild)
    const commands = guild ? guild.commands : client.application.commands
    if (!commands) continue
    createCommands(commands)
  }
})

client.on('guildCreate', guild => {
  const commands = guild ? guild.commands : client.application.commands
  createCommands(commands)
})

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return

  const { commandName, options } = interaction

  try {
    if (commandName === 'itadhelp') {
      await interaction.reply({ content: helpReply })
    } else if (commandName === 'itad') {
      await interaction.deferReply()
      const name = options.getString('game')
      const data = await getItadData(name)
      await interaction.editReply({ embeds: [data.embed] })
    }
  } catch (error) {
    if (process.env.ERROR === 'true') console.log(error)
  }
})

client.login(process.env.DISCORD_TOKEN).then(async () => {
  loggedIn = true
  exRateUSDTW = await exRateUpdate()
  sale = await fetchSale()
})

if (process.env.WEB) {
  const express = require('express')
  const https = require('https')
  const app = express()
  app.listen(process.env.PORT || 3000, () => {
    console.log('Web service started')
  })
  app.get('/', (req, res) => {
    res.send('Hello World')
  })
  setInterval(() => {
    https.get(process.env.WEB)
  }, 1000 * 60 * 5)
}
