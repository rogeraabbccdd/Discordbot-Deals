require('dotenv').config()
const Discord = require('discord.js')
const schedule = require('node-schedule')
const getColors = require('get-image-colors')
const dayjs = require('dayjs')
const relativeTime = require('dayjs/plugin/relativeTime')
require('dayjs/locale/zh-tw')

const searchITAD = require('./funcs/searchITAD')
const getItadPlainByName = require('./funcs/getItadPlainByName')
const exRateUpdate = require('./funcs/exRateUpdate')
const getSteamInfoByPlain = require('./funcs/getSteamInfoByPlain')
const formatDate = require('./funcs/formatDate')
const fetchItad = require('./funcs/fetchItad')
const fetchSteamApp = require('./funcs/fetchSteamApp')
const fetchSteamDB = require('./funcs/fetchSteamDB')
const fetchSteamPackage = require('./funcs/fetchSteamPackage')
const fetchSale = require('./funcs/fetchSale')

const client = new Discord.Client({
  partials: ['CHANNEL'],
  intents: [
    Discord.Intents.FLAGS.GUILDS,
    Discord.Intents.FLAGS.GUILD_MESSAGES,
    Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Discord.Intents.FLAGS.DIRECT_MESSAGES,
    Discord.Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
    Discord.Intents.FLAGS.DIRECT_MESSAGE_TYPING
  ]
})

dayjs.extend(relativeTime)

const itadShops = 'amazonus,bundlestars,chrono,direct2drive,dlgamer,dreamgame,fireflower,gamebillet,gamejolt,gamersgate,gamesplanet,gog,humblestore,humblewidgets,impulse,indiegalastore,indiegamestand,itchio,macgamestore,newegg,origin,paradox,savemi,silagames,squenix,steam,uplay,wingamestore'

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

const showSale = true
let changed = false
let loggedIn = false

const helpReply =
':desktop:  機器人指令\n' +
'• `!itad 遊戲名稱` - 查詢遊戲資訊\n' +
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
    client.user.setActivity(text, { type: 'LISTENING' })
  } else {
    client.user.setActivity('使用 !itadhelp 查詢指令', { type: 'LISTENING' })
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
  let embed = new Discord.MessageEmbed()
  let react = '❌'
  try {
    /* search game */
    /* search game */
    const search = await searchITAD(name, itadShops)
    const find = getItadPlainByName(search, name)
    if (find.length === 0) {
      embed.setColor(embedColorError)
      if (search.length === 0) embed.setTitle(`找不到符合 ${name} 的遊戲`)
      else {
        search.sort((a, b) => a.title.length - b.title.length || a.title.localeCompare(b.title))
        embed.setTitle(`找不到符合 ${name} 的遊戲，你是不是要找...\n\u200b`)

        const addedGames = []
        // j = array index
        let j = 0
        // i = max 5 suggestions
        for (let i = 0; i < 5; i++) {
          if (search[j]) {
            if ((j === 0) || (j > 0 && !addedGames.includes(search[j].title))) {
              addedGames.push(search[j].title)
              embed.addField(search[j].title, `https://isthereanydeal.com/game/${search[j].plain}`)
            } else i--
          } else break
          j++
        }
      }
    } else {
      const { plain } = find[0]
      const appTitle = find[0].title
      const appInfo = getSteamInfoByPlain(search, plain)
      embed.setTitle(appTitle)
      embed.setColor(embedColor)

      const itad = await fetchItad(plain, itadShops)
      const lowest = itad[0].data[plain]
      const current = itad[1].data[plain].list[0]
      const bundle = itad[2].data[plain]

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

          const steamOV = await fetchSteamApp(appInfo.id)

          if (steamOV[appInfo.id].success && typeof steamOV[appInfo.id].data === 'object') {
            const price = steamOV[appInfo.id].data.price_overview
            rSteam += `原價: ${price.initial_formatted.length === 0 ? price.final_formatted : price.initial_formatted}, \n` +
              `目前價格: ${price.final_formatted}, -${price.discount_percent}%`

            const steamLow = await fetchSteamDB(appInfo.id)
            if (Object.keys(steamLow).length > 0) {
              const lowestRegex = /(?<date1>\d+\s[A-Za-z]+\s+\d+)\s\((?<times>\d+)\stimes,\sfirst\son\s(?<date2>\d+\s[A-Za-z]+\s+\d+)\)/
              const lowestResults = steamLow.data.lowest.date.match(lowestRegex)
              let lowestStr = ''
              if (lowestResults) lowestStr += `最近一次為 ${formatDate(new Date(lowestResults.groups.date1))}, 從 ${formatDate(new Date(lowestResults.groups.date2))}開始共出現 ${lowestResults.groups.times} 次`
              else lowestStr += formatDate(new Date(steamLow.data.lowest.date))
              if (steamLow.success) rSteam += `\n歷史最低: ${steamLow.data.lowest.price}, -${steamLow.data.lowest.discount}%, ${lowestStr}\n`
            }
          }
        } else if (appInfo.type === 'sub') {
          const steamOV = await fetchSteamPackage(appInfo.id)
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

  const clientGuilds = client.guilds.cache.map(guild => guild.id)
  for (const clientGuild of clientGuilds) {
    const guild = client.channels.cache.get(clientGuild)
    const commands = guild ? guild.commands : client.application.commands
    if (!commands) continue
    commands.create({
      name: 'itadhelp',
      description: 'itad 機器人使用說明'
    })
    commands.create({
      name: 'itad',
      description: 'itad 查詢遊戲資料',
      options: [
        {
          name: 'game',
          description: '遊戲名稱',
          required: true,
          type: Discord.Constants.ApplicationCommandOptionTypes.STRING
        }
      ]
    })
  }
})

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return

  const { commandName, options } = interaction
  if (commandName === 'itadhelp') {
    interaction.reply({ content: helpReply })
  } else if (commandName === 'itad') {
    await interaction.deferReply()
    const name = options.getString('game')
    const data = await getItadData(name)
    await interaction.editReply({ embeds: [data.embed] })
  }
})

client.on('message', msg => {
  if (msg.content && !msg.author.bot) {
    if (msg.content === '!itadhelp') {
      if (msg.channel.type !== 'DM') msg.react(process.env.LOADING_EMOJI.toString())
      msg.channel.send(helpReply)
      if (msg.channel.type !== 'DM') {
        msg.reactions.removeAll().then(() => {
          msg.react('✅').catch()
        }).catch()
      }
    } else if (msg.content.substring(0, 6) === '!itad ') {
      if (msg.channel.type !== 'DM') msg.react(process.env.LOADING_EMOJI.toString())
      const name = msg.content.split('!itad ')[1]
      getItadData(name).then((data) => {
        msg.channel.send({ embeds: [data.embed] })
        if (msg.channel.type !== 'DM') {
          msg.reactions.removeAll().then(() => {
            msg.react(data.react).catch()
          }).catch()
        }
      })
    }
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
