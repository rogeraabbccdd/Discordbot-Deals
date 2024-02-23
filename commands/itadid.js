const { SlashCommandBuilder } = require('discord.js')
const getItadData = require('../funcs/getItadData')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('itadid')
    .setDescription('使用 Steam App ID 查詢遊戲資訊')
    .addIntegerOption(
      option =>
        option.setName('id')
          .setDescription('Steam App ID')
          .setRequired(true)
    ),
  async execute (interaction) {
    await interaction.deferReply()
    const name = interaction.options.getInteger('id')
    const data = await getItadData(name, 'id')
    await interaction.editReply({ embeds: [data.embed] })
  }
}
