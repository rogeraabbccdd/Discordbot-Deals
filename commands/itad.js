const { SlashCommandBuilder } = require('discord.js')
const getItadData = require('../funcs/getItadData')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('itad')
    .setDescription('使用遊戲名稱查詢')
    .addStringOption(
      option =>
        option.setName('game')
          .setDescription('遊戲名稱')
          .setRequired(true)
    ),
  async execute (interaction) {
    await interaction.deferReply()
    const name = interaction.options.getString('game')
    const data = await getItadData(name, 'name')
    await interaction.editReply({ embeds: [data.embed] })
  }
}
