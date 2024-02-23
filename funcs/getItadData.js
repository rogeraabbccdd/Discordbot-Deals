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
    if (type === 'name') {
      const apps = await searchITAD(value)
      const result = findNameInResults(apps, value)
      if (!result) {
        embed.setColor(colors.error)
        if (apps.length === 0) embed.setTitle(`找不到符合 ${value} 的遊戲`)
        else {
          apps.sort((a, b) => a.title.length - b.title.length || a.title.localeCompare(b.title))
          embed.setTitle(`找不到符合 ${value} 的遊戲，你是不是要找...\n\u200b`)

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
      }
    } else {
      const result = await searchITADid(value)
      if (result.found) {
        app.id = result.game.id
        app.slug = result.game.slug
        app.title = result.game.title
        app.type = result.game.type
        app.mature = result.game.mature
      } else {
        embed.setColor(colors.error)
        embed.setTitle(`找不到 ID 為 ${value} 的遊戲`)
      }
    }
    if (app.id.length > 0) {
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
        `原始價格: ${appLowest.regular.amount} USD / ${Math.round(appLowest.regular.amount * exrate.value * 100) / 100} TWD\n` +
        `目前最低: ${appLowest.price.amount} USD / ${Math.round(appLowest.price.amount * exrate.value * 100) / 100} TWD, -${appLowest.cut}%, 在 ${appLowest.shop.name}`

      rDeal += `\n歷史最低: ${appHistory.price.amount} USD / ${Math.round(appHistory.price.amount * exrate.value * 100) / 100} TWD, -${appHistory.cut}%, ${formatDate(new Date(appHistory.timestamp))}在 ${appHistory.shop.name}`

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
        let embedColorApp = colors.success
        getColors(replyImage).then(colors => {
          colors = colors.map(color => color.hex())
          embedColorApp = colors[0]
          embed.setColor(embedColorApp)
        })

        embed.setImage(replyImage)

        const steamOV = await fetchSteamApp(appInfo.appid)

        if (steamOV[appInfo.appid].success && typeof steamOV[appInfo.appid].data === 'object') {
          const price = steamOV[appInfo.appid].data.price_overview
          rSteam += `原始價格: ${price.initial_formatted.length === 0 ? price.final_formatted : price.initial_formatted}, \n` +
              `目前價格: ${price.final_formatted}, -${price.discount_percent}%`

          const steamLow = await fetchSteamDB(appInfo.appid)
          if (Object.keys(steamLow).length > 0) {
            const lowestRegex = /(?<date1>\d+\s[A-Za-z]+\s+\d+)\s\((?<times>\d+)\stimes,\sfirst\son\s(?<date2>\d+\s[A-Za-z]+\s+\d+)\)/
            const lowestResults = steamLow.data.lowest.date.match(lowestRegex)
            let lowestStr = ''
            if (lowestResults) lowestStr += `\n最近一次為 ${formatDate(new Date(lowestResults.groups.date1))}\n從 ${formatDate(new Date(lowestResults.groups.date2))}開始共出現 ${lowestResults.groups.times} 次`
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
    embed = new EmbedBuilder().setColor(colors.error).setTitle('遊戲資料查詢失敗，請再試一次')
  }
  return { embed, react }
}
