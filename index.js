require('dotenv').config()
const { Client, GatewayIntentBits } = require('discord.js')
const schedule = require('node-schedule')
const dayjs = require('dayjs')
const relativeTime = require('dayjs/plugin/relativeTime')
require('dayjs/locale/zh-tw')
const exrate = require('./data/exrate')
const commands = require('./commands/index')

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

schedule.scheduleJob('0 0 0 * * *', async () => {
  await exrate.update()
})

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
  exrate.update()
  client.user.setPresence({ activities: [{ name: '使用 /itadhelp 查詢指令' }], status: 'LISTENING' })
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
