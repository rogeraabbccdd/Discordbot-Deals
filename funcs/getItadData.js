const { EmbedBuilder } = require('discord.js')
const getColors = require('get-image-colors')
const searchITAD = require('./searchITAD')
const searchITADid = require('./searchITADid')
const findNameInResults = require('./findNameInResults')
const formatDate = require('./formatDate')
const fetchItad = require('./fetchItad')
const fetchSteamApp = require('./fetchSteamApp')
const fetchSteamDB = require('./fetchSteamDB')
const colors = require('../data/colors')
const exrate = require('../data/exrate')

module.exports = async (value, type) => {
  let embed = new EmbedBuilder()
  let react = '❌'
  try {
    /* search game */
    const app = {
      id: '',
      slug: '',
      title: '',
      type: '',
      mature: false
    }
    let appid = type === 'id' ? value : 0
    let rDealPrice = '查無資料'
    let rDealHistory = '查無資料'
    let rInfo = '查無資料'
    let rBundle = ''
    let rSteamPrice = '查無資料'
    let rSteamHistory = '查無資料'

    let found = false

    if (type === 'name') {
      const apps = await searchITAD(value)
      const result = findNameInResults(apps, value)
      if (!result) {
        embed.setColor(colors.error)
        if (apps.length === 0) {
          embed.setTitle('查詢失敗')
          embed.setDescription(`找不到符合 ${value} 的遊戲`)
        } else {
          apps.sort((a, b) => a.title.length - b.title.length || a.title.localeCompare(b.title))
          embed.setTitle('查詢失敗')
          embed.setDescription(`找不到符合 ${value} 的遊戲，你是不是要找...\n\u200b`)

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
        app.id = result.id
        app.slug = result.slug
        app.title = result.title
        app.type = result.type
        app.mature = result.mature
        found = true
      }
    } else {
      const result = await searchITADid(value)
      if (result.found) {
        app.id = result.game.id
        app.slug = result.game.slug
        app.title = result.game.title
        app.type = result.game.type
        app.mature = result.game.mature
        found = true
      } else {
        embed.setColor(colors.error)
        embed.setTitle('查詢失敗')
        embed.setDescription(`找不到 ID 為 ${value} 的遊戲，請確認 ID 是否為遊戲 ID 而不是組合包 ID`)
      }
    }
    if (found && app.id.length > 0) {
      // const { plain } = find[0]
      // const appTitle = find[0].title
      // const appInfo = getSteamInfoByPlain(search, plain)
      // embed.setTitle(appTitle)
      // embed.setColor(embedColor)

      const appResults = await fetchItad(app.id)
      const appInfo = appResults[0]
      // This is an empty array in some games, e.g. "Muse Dash"
      const appPrice = appResults[1]?.[0]?.deals?.sort((a, b) => b.cut - a.cut)?.[0]
      // This is an empty array in some games, e.g. SteamAppID 999
      const appLowest = appResults[2]?.[0]?.lows?.sort((a, b) => b.cut - a.cut)?.[0]
      const appHistory = appResults[3]?.[0]?.low
      const appBundles = appResults[4]

      if (type === 'name' && appInfo.appid) {
        appid = appInfo.appid
      }

      if (appLowest) {
        rDealPrice =
          `在 ${appLowest.shop.name}\n` +
          `原始價格: ${appLowest.regular.amount} USD / ${Math.round(appLowest.regular.amount * exrate.value * 100) / 100} TWD\n` +
          `折扣價格: ${appLowest.price.amount} USD / ${Math.round(appLowest.price.amount * exrate.value * 100) / 100} TWD, -${appLowest.cut}%`

        if (appPrice) {
          rDealPrice += '\n' + appPrice.url
        }
      }

      if (appHistory) {
        rDealHistory = `${formatDate(new Date(appHistory.timestamp))}在 ${appHistory.shop.name}\n` +
        `原始價格: ${appHistory.regular.amount} USD / ${Math.round(appHistory.regular.amount * exrate.value * 100) / 100} TWD\n` +
        `折扣價格: ${appHistory.price.amount} USD / ${Math.round(appHistory.price.amount * exrate.value * 100) / 100} TWD, -${appHistory.cut}%\n` +
        `https://isthereanydeal.com/game/${app.slug}/history/`
      }

      rInfo = `https://isthereanydeal.com/game/${app.slug}/info/\n`

      /* bundles */
      rBundle = `總入包次數: ${appBundles.length}`
      const activeBundles = appBundles.filter(bundle => new Date(bundle.expiry) > Date.now())
      if (activeBundles.length > 0) {
        rBundle += '\n目前入包:\n'
        for (const bundle of appBundles) {
          rBundle += `${bundle.title}, ~${formatDate(new Date(bundle.expiry))}\n${bundle.url}`
        }
      }
    }
    /* is steam */
    if (found && appid > 0) {
      rInfo += `https://store.steampowered.com/app/${appid}/\n` +
          `https://steamdb.info/app/${appid}/`

      const replyImage = `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/header.jpg`
      let embedColorApp = colors.success
      getColors(replyImage).then(colors => {
        colors = colors.map(color => color.hex())
        embedColorApp = colors[0]
        embed.setColor(embedColorApp)
      })

      embed.setImage(replyImage)

      const steamOV = await fetchSteamApp(appid)

      if (steamOV[appid].success && typeof steamOV[appid].data === 'object' && !Array.isArray(steamOV[appid].data)) {
        const price = steamOV[appid].data.price_overview
        rSteamPrice =
              `原始價格: ${price.initial_formatted.length === 0 ? price.final_formatted : price.initial_formatted}, \n` +
              `目前價格: ${price.final_formatted}, -${price.discount_percent}%`

        const steamLow = await fetchSteamDB(appid)
        if (Object.keys(steamLow).length > 0 && steamLow.success) {
          rSteamHistory = `${steamLow.data.p}, -${steamLow.data.d}%\n`
          rSteamHistory += `最近一次為 ${formatDate(new Date(steamLow.data.t * 1000))}, 共出現 ${steamLow.data.c} 次`
        }
      }
    }
    if (found) {
      embed
        .addFields([
          { name: 'isthereanydeal 目前最低', value: rDealPrice + '\n\u200b' }
        ])
        .addFields([
          { name: 'isthereanydeal 歷史最低', value: rDealHistory + '\n\u200b' }
        ])
        .addFields([
          { name: 'Steam 台灣區目前價格', value: rSteamPrice + '\n\u200b' }
        ])
        .addFields([
          { name: 'Steam 台灣區歷史最低', value: rSteamHistory + '\n\u200b' }
        ])
      embed.addFields([
        { name: '入包資訊', value: rBundle + '\n\u200b' }
      ])
      embed.addFields([
        { name: '更多資訊', value: rInfo }
      ])
    }

    react = '✅'
  } catch (err) {
    console.log(err)
    react = '❌'
    embed = new EmbedBuilder().setColor(colors.error).setTitle('遊戲資料查詢失敗，請再試一次')
  }
  return { embed, react }
}
