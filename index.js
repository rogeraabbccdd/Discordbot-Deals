require('dotenv').config()
const { Client, GatewayIntentBits } = require('discord.js')
const schedule = require('node-schedule')
const dayjs = require('dayjs')
const relativeTime = require('dayjs/plugin/relativeTime')
require('dayjs/locale/zh-tw')
const exrate = require('./data/exrate')
const commands = require('./commands/index')
const fetchSale = require('./funcs/fetchSale')

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

let sale = {
  start: '',
  end: '',
  name: ''
}

schedule.scheduleJob('0 0 0 * * *', async () => {
  await exrate.update()
  sale = await fetchSale()
})

const showSale = false
let changed = false
let loggedIn = false

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

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`)
  commands.create()
})

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return
  try {
    await commands.handle(interaction)
  } catch (error) {
    if (process.env.ERROR === 'true') console.log(error)
  }
})

client.login(process.env.DISCORD_TOKEN).then(async () => {
  loggedIn = true
  exrate.update()
  sale = await fetchSale()
})

// Web service and keep sending request to prevent sleep
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
