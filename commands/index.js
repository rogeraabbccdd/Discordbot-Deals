const { REST, Routes } = require('discord.js')
const commandHelp = require('../commands/help')
const commandItad = require('../commands/itad')

const rest = new REST().setToken(process.env.DISCORD_TOKEN)

module.exports = {
  create: async () => {
    try {
      console.log('Registering application commands...')
      const data = await rest.put(
        Routes.applicationCommands(process.env.DISCORD_APP_ID),
        {
          body: [
            commandHelp.data.toJSON(),
            commandItad.data.toJSON()
          ]
        }
      )
      console.log(`Successfully registered ${data.length} application commands`)
    } catch (error) {
      console.log('createCommands Error')
      if (process.env.ERROR === 'true') console.log(error)
    }
  },
  handle: async (interaction) => {
    switch (interaction.commandName) {
      case 'itadhelp':
        await commandHelp.execute(interaction)
        break
      case 'itad':
        await commandItad.execute(interaction)
        break
    }
  }
}
