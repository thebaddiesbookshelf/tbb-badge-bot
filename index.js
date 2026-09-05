const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
let config;

if (process.env.NODE_ENV === 'production') {
  config = {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID,
    mongoUri: process.env.MONGO_URI,
    adminRoleId: process.env.ADMIN_ROLE_ID,
    libraryCardChannelId: process.env.LIBRARY_CARD_CHANNEL_ID,
    badgeLogThreadId: process.env.BADGE_LOG_THREAD_ID,
    teamRoleId: process.env.TEAM_ROLE_ID
  };
} else {
  config = require('./config.json');
}

// Create client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    console.log(`✅ Loaded command: ${command.data.name}`);
  } else {
    console.log(`⚠️ Warning: ${file} is missing required "data" or "execute" property.`);
  }
}

// Connect to MongoDB
mongoose.connect(config.mongoUri)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Client ready event
client.once('ready', async () => {
  console.log(`✅ Bot is ready! Logged in as ${client.user.displayName}`);
  
  // Register slash commands
  const commands = [];
  for (const command of client.commands.values()) {
    commands.push(command.data.toJSON());
  }

  const rest = new REST().setToken(config.token);

try {
  console.log('🔄 Started refreshing application (/) commands.');

  await rest.put(
    Routes.applicationGuildCommands(config.clientId, config.guildId),
    { body: commands }
  );

  console.log('✅ Successfully reloaded application (/) commands.');
} catch (error) {
  console.error('❌ Error registering commands:', error);
}
});

// Interaction handler
client.on('interactionCreate', async interaction => {
  // Handle autocomplete
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);

    if (!command || !command.autocomplete) {
      return;
    }

    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error(`❌ Error handling autocomplete for ${interaction.commandName}:`, error);

      if (!interaction.responded && !interaction.replied) {
  try {
    await interaction.respond([]);
  } catch {
    // Ignore if the interaction has already been handled.
  }
}
    }

    return;
  }

  // Handle regular slash commands
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`❌ No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`❌ Error executing ${interaction.commandName}:`, error);

    const errorMessage = {
      content: '❌ There was an error while executing this command!',
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
});

// Error handling
process.on('unhandledRejection', error => {
  console.error('❌ Unhandled promise rejection:', error);
});

// Login
client.login(config.token);