const { ApplicationCommandOptionType } = require('discord.js')

module.exports = commands => {
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
        type: ApplicationCommandOptionType.String
      }
    ]
  })
}
