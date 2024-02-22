const { SlashCommandBuilder } = require('discord.js')

const helpReply =
':desktop:  機器人指令\n' +
'• `/itad 遊戲名稱` - 查詢遊戲資訊\n' +
'\n:link:  相關連結\n' +
'• 巴哈文章: https://forum.gamer.com.tw/C.php?bsn=60599&snA=27046\n' +
'• 邀請連結: https://discordapp.com/oauth2/authorize?client_id=634902541687324702&scope=bot&permissions=28832\n' +
'• 機器人原始碼: https://github.com/rogeraabbccdd/Discordbot-Deals'

module.exports = {
  data: new SlashCommandBuilder()
    .setName('itadhelp')
    .setDescription('itad 機器人使用說明'),
  async execute (interaction) {
    await interaction.reply({ content: helpReply })
  }
}
