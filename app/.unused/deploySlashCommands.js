// Boilerplate provided by https://discordjs.guide
const { REST, Routes } = require('discord.js');
// const { clientId, artiGuildId, token } = require('./config.json');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async (deploymentType) => {
	const commands = [];
	// Grab all the command folders from the commands directory you created earlier
	const commandsPath = path.join(__dirname, 'slashcommands');
	const commandFiles = fs.readdirSync(commandsPath);

	for (const cmd of commandFiles) {
		const filePath = path.join(commandsPath, cmd);
		const command = require(filePath);
		if ('data' in command) {
			commands.push(command.data.toJSON());
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}

	// Construct and prepare an instance of the REST module
	const rest = new REST().setToken(token);

	// and deploy your commands!
	(async () => {
		try {
			console.log(`Started refreshing ${commands.length} application (/) commands.`);

			let data;
			// custom modified here
			switch (deploymentType) {
				case 'guild':
					// The put method is used to fully refresh all commands in the guild with the current set
					data = await rest.put(
						Routes.applicationGuildCommands(clientId, artiGuildId),
						{ body: commands },
					);
					break;
				case 'global':
					// The put method is used to fully refresh all commands in the guild with the current set
					data = await rest.put(
						Routes.applicationCommands(clientId),
						{ body: commands },
					);
					break;
				default:
					console.error('[ERROR]: Invalid deployment type. Valid types are "guild" and "global".');
					break;
			}

			console.log(`Successfully reloaded ${data.length} application (/) commands.`);
		} catch (error) {
			// And of course, make sure you catch and log any errors!
			console.error(error);
		}
	})();
}
