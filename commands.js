const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { exec } = require('child_process');
const path = require('path');

const pythonScript = path.join(__dirname, 'attendance_script.py');
let attendanceCode = 'secret';

const commands = [

  new SlashCommandBuilder()
  .setName('hello')
  .setDescription('Get a greeting and information about Hot Dawg'),

  new SlashCommandBuilder()
    .setName('log')
    .setDescription('Log attendance for a user')
    .addStringOption(option => option.setName('name')
      .setDescription('The name of the user')
      .setRequired(true))
    .addStringOption(option => option.setName('code')
      .setDescription('The attendance code')
      .setRequired(true)),

  new SlashCommandBuilder()
    .setName('logme')
    .setDescription('Log attendance using your nickname')
    .addStringOption(option => option.setName('code')
      .setDescription('The attendance code')
      .setRequired(true)),

  new SlashCommandBuilder()
      .setName('getcode')
      .setDescription('Get the current attendance code')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    new SlashCommandBuilder()
      .setName('setcode')
      .setDescription('Set a new attendance code')
      .addStringOption(option => option.setName('code')
        .setDescription('The new attendance code')
        .setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
      .setName('attendance')
      .setDescription('Get attendance for a user')
      .addStringOption(option =>
          option.setName('name')
              .setDescription('The name of the user')
              .setRequired(true)),

  new SlashCommandBuilder()
      .setName('stats')
      .setDescription('Get attendance statistics'),

  new SlashCommandBuilder()
      .setName('top')
      .setDescription('Display top attendance statistics'),

  new SlashCommandBuilder()
      .setName('getlink')
      .setDescription('Get the public access link for the Google Sheet')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
      .setName('clear')
      .setDescription('Clear all data from the spreadsheet')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
];

async function registerCommands(client) {
    try {
        await client.application.commands.set(commands);
        console.log('Commands registered successfully');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
}

function executePythonScript(args) {
    return new Promise((resolve, reject) => {
        exec(`python ${pythonScript} ${args}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing Python script: ${error}`);
                reject(error);
                return;
            }
            if (stderr) {
                console.error(`Python script stderr: ${stderr}`);
            }
            try {
                const result = JSON.parse(stdout);
                resolve(result);
            } catch (parseError) {
                console.error(`Error parsing Python script output: ${parseError}`);
                reject(parseError);
            }
        });
    });
}

async function handleCommands(interaction) {
    const { commandName } = interaction;

    switch (commandName) {
        case 'log':
            await handleLogCommand(interaction);
            break;
        case 'attendance':
            await handleAttendanceCommand(interaction);
            break;
        case 'stats':
            await handleStatsCommand(interaction);
            break;
        case 'getlink':
            await handleGetLinkCommand(interaction);
            break;
        case 'clear':
            await handleClearCommand(interaction);
            break;
        case 'logme':
            await handleLogMeCommand(interaction);
            break;
        case 'createzip':
            await handleCreateZipCommand(interaction);
            break;
        case 'top':
            await handleTopCommand(interaction);
            break;
        case 'getcode':
            await handleGetCodeCommand(interaction);
            break;
        case 'setcode':
            await handleSetCodeCommand(interaction);
            break;
        case 'hello':
            await handleHelloCommand(interaction);
            break;
    }
}

async function handleLogCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const logName = interaction.options.getString('name');
  const code = interaction.options.getString('code');

  try {
    const checkResult = await executePythonScript(`check ${logName}`);
    if (checkResult.exists) {
      if (code === attendanceCode) {
        const result = await executePythonScript(`log ${logName}`);
        const logEmbed = new EmbedBuilder()
          .setColor('#ff9900')
          .setTitle('✅ Attendance Logged')
          .setDescription(`Successfully logged attendance for **${logName}**`)
          .addFields(
            { name: 'Duration', value: result.duration, inline: true },
            { name: 'Date', value: result.date, inline: true }
          )
          .setTimestamp();
        await interaction.editReply({ embeds: [logEmbed] });
      } else {
        await interaction.editReply({ content: 'Invalid code. Attendance logging cancelled.', embeds: [] });
      }
    } else {
          const promptEmbed = new EmbedBuilder()
              .setColor('#ffff00')
              .setTitle('⚠️ Name Not Found')
              .setDescription(`The name **${logName}** was not found in the attendance sheet. React with ✅ to add it, or ❌ to cancel.`)
              .setTimestamp();
          
          const message = await interaction.reply({ embeds: [promptEmbed], fetchReply: true });
          await message.react('✅');
          await message.react('❌');

          const filter = (reaction, user) => {
              return ['✅', '❌'].includes(reaction.emoji.name) && user.id === interaction.user.id;
          };

          try {
              const collected = await message.awaitReactions({ filter, max: 1, time: 30000, errors: ['time'] });
              const reaction = collected.first();

              if (reaction.emoji.name === '✅') {
                  const result = await executePythonScript(`log ${logName}`);
                  const addEmbed = new EmbedBuilder()
                      .setColor('#00ff00')
                      .setTitle('✅ Name Added and Attendance Logged')
                      .setDescription(`Successfully added **${logName}** and logged attendance.`)
                      .addFields(
                          { name: 'Duration', value: result.duration, inline: true },
                          { name: 'Date', value: result.date, inline: true }
                      )
                      .setTimestamp();
                  await interaction.editReply({ embeds: [addEmbed] });
              } else {
                  await interaction.editReply({ content: 'Operation cancelled.', embeds: [] });
              }
          } catch (error) {
              await interaction.editReply({ content: 'Confirmation not received within 30 seconds, cancelling operation.', embeds: [] });
          }

          // Remove the reactions after the operation is complete
          await message.reactions.removeAll();
      }
    } catch (error) {
      // Handle errors
      const errorEmbed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('❌ Error Logging Attendance')
          .setDescription(error.message)
          .setTimestamp();
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

async function handleLogMeCommand(interaction) {
  const member = interaction.member;
  const nickname = member.nickname;
  const code = interaction.options.getString('code');

  if (!nickname) {
    const errorEmbed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('❌ Error Logging Attendance')
      .setDescription('You must have a nickname set in this server to use this command.')
      .setFooter({ text: 'Please set a nickname and try again.' })
      .setTimestamp();
    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    if (code === attendanceCode) {
      const result = await executePythonScript(`logMe ${nickname}`);
      const logEmbed = new EmbedBuilder()
        .setColor('#ff9900')
        .setTitle('✅ Attendance Logged')
        .setDescription(`Successfully logged attendance for **${nickname}**`)
        .addFields(
          { name: 'Duration', value: result.duration, inline: true },
          { name: 'Date', value: result.date, inline: true }
        )
        .setTimestamp();
      await interaction.editReply({ embeds: [logEmbed] });
    } else {
      await interaction.editReply({ content: 'Invalid code. Attendance logging cancelled.', embeds: [] });
    }
  } catch (error) {
    const errorEmbed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('❌ Error Logging Attendance')
      .setDescription(error.message)
      .setTimestamp();
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleAttendanceCommand(interaction) {
    const attendanceName = interaction.options.getString('name');
    try {
        const result = await executePythonScript(`attendance ${attendanceName}`);
        const attendanceEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle(`🕒 Attendance for ${attendanceName}`)
            .setDescription(result.attendance)
            .setTimestamp();

        await interaction.reply({ embeds: [attendanceEmbed] });
    } catch (error) {
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Error Retrieving Attendance')
            .setDescription(error.message)
            .setTimestamp();

        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}

async function handleStatsCommand(interaction) {
    try {
        const result = await executePythonScript('stats');
        const statsEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📊 Attendance Statistics')
            .setDescription('List of all attendance statistics:')
            .addFields(
                Object.entries(result.stats).map(([name, duration]) => ({
                    name: name,
                    value: duration,
                    inline: true
                }))
            )
            .setTimestamp();

        await interaction.reply({ embeds: [statsEmbed] });
    } catch (error) {
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Error Retrieving Stats')
            .setDescription(error.message)
            .setTimestamp();

        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}

async function handleGetLinkCommand(interaction) {
    try {
        const result = await executePythonScript('getlink');
        const linkEmbed = new EmbedBuilder()
            .setColor('#4285F4')
            .setTitle('📊 Google Sheet Public Link')
            .setDescription(`Public access link for the attendance Google Sheet:`)
            .addFields({ name: 'Link', value: result.link })
            .setTimestamp();

        await interaction.reply({ embeds: [linkEmbed] });
    } catch (error) {
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Error Retrieving Link')
            .setDescription(`An error occurred while retrieving the public link: ${error.message}`)
            .setTimestamp();

        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}

async function handleClearCommand(interaction) {
  if (!interaction.member.roles.cache.some(role => role.name === 'botadmin')) {
      await interaction.reply({ content: ':angry: :anger: You need the botadmin role to use this command.', ephemeral: true });
      return;
  }

  const confirmEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('⚠️ Confirm Clear Operation')
      .setDescription('Are you sure you want to clear all data from the spreadsheet? This action cannot be undone. React with ✅ to confirm or ❌ to cancel.')
      .setTimestamp();

  const message = await interaction.reply({ embeds: [confirmEmbed], fetchReply: true });
  await message.react('✅');
  await message.react('❌');

  const filter = (reaction, user) => {
      return ['✅', '❌'].includes(reaction.emoji.name) && user.id === interaction.user.id;
  };

  try {
      const collected = await message.awaitReactions({ filter, max: 1, time: 30000, errors: ['time'] });
      const reaction = collected.first();

      if (reaction.emoji.name === '✅') {
          await interaction.editReply({ content: 'Clearing data, please wait...', embeds: [] });
          const result = await executePythonScript('clear');
          const clearEmbed = new EmbedBuilder()
              .setColor('#4285F4')
              .setTitle('🧹 Spreadsheet Cleared')
              .setDescription(result.message)
              .setTimestamp();

          await interaction.editReply({ embeds: [clearEmbed] });
      } else {
          await interaction.editReply({ content: 'Clear operation cancelled.', embeds: [] });
      }
  } catch (error) {
      console.error('Error in clear command:', error);
      await interaction.editReply({ content: 'An error occurred or the operation timed out.', embeds: [] });
  }
}

async function handleTopCommand(interaction) {
  try {
      const result = await executePythonScript('top');
      const topEmbed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('🏆 Top Attendance Statistics')
          .addFields(
              { name: 'Most Hours', value: `${result.top_hours.name}: ${result.top_hours.hours}`, inline: true },
              { name: 'Most Visits', value: `${result.top_visits.name}: ${result.top_visits.visits} visits`, inline: true },
              { name: 'Longest Streak', value: `${result.top_consecutive.name}: ${result.top_consecutive.days} days`, inline: true }
          )
          .setTimestamp();

      await interaction.reply({ embeds: [topEmbed] });
  } catch (error) {
      const errorEmbed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('❌ Error Retrieving Top Stats')
          .setDescription(error.message)
          .setTimestamp();

      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

async function handleGetCodeCommand(interaction) {
  if (!interaction.member.roles.cache.some(role => role.name === 'botadmin')) {
    await interaction.reply({ content: '❌ You need the botadmin role to use this command.', ephemeral: true });
    return;
  }

  const codeEmbed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('🔐 Current Attendance Code')
    .setDescription(`The current attendance code is: **${attendanceCode}**`)
    .setFooter({ text: 'This code is confidential. Do not share it publicly.' })
    .setTimestamp();

  await interaction.reply({ embeds: [codeEmbed], ephemeral: true });
}

async function handleSetCodeCommand(interaction) {
  if (!interaction.member.roles.cache.some(role => role.name === 'botadmin')) {
    await interaction.reply({ content: '❌ You need the botadmin role to use this command.', ephemeral: true });
    return;
  }

  const newCode = interaction.options.getString('code');
  const oldCode = attendanceCode;
  attendanceCode = newCode;

  const confirmEmbed = new EmbedBuilder()
    .setColor('#00ff00')
    .setTitle('✅ Attendance Code Updated')
    .setDescription(`The attendance code has been updated to: **${newCode}**`)
    .setFooter({ text: 'This code is confidential. Do not share it publicly.' })
    .setTimestamp();

  await interaction.reply({ embeds: [confirmEmbed], ephemeral: true });

  const leadershipChannel = interaction.client.channels.cache.get('1059614213368188938');
  if (leadershipChannel) {
    const leadershipEmbed = new EmbedBuilder()
      .setColor('#0099ff')
      .setDescription(`Hi leadership team, the attendance code has been updated!`)
      .setTitle('🔄 Attendance Code Changed')
      .addFields(
        { name: 'Old Code', value: oldCode || 'N/A', inline: true },
        { name: 'New Code', value: newCode, inline: true }
      )
      .setFooter({ text: `Changed by ${interaction.user.tag}` })
      .setTimestamp();

    await leadershipChannel.send({ embeds: [leadershipEmbed] });
  }
}

async function handleHelloCommand(interaction) {
  const helloEmbed = new EmbedBuilder()
    .setColor('#FFA500')
    .setTitle('🌭 Welcome to Hot Dawg!')
    .setDescription("Greetings! I'm Hot Dawg, your friendly neighborhood Junkyard Dog and attendance bot.")
    .addFields(
      { name: '🤖 About Me', value: "I'm here to help you log our attendance for robotics meetings." },
      { name: '📝 Attendance Logging', value: "Use the `/log` or `/logme` command to log your attendance at the start of every meet." },
      { name: '🔐 Code System', value: "I use a code-based system that changes at the beginning of every meet. This stops misuse!" },
      { name: '📊 Data Management', value: "All attendance data is automatically uploaded to a Google Sheet for easy tracking." },
      { name: '📜 Available Commands', value: 
        "Here are the commands you can use:\n\n" +
        "`/logme [code]` - Log your own attendance\n" +
        "`/log [name] [code]` - Log attendance for a specific user\n" +
        "`/attendance [name]` - Get attendance for a specific user\n" +
        "`/stats` - View overall attendance statistics\n" +
        "`/top` - Display top attendance statistics\n" +
        "`/getlink` - Get the public access link for the Google Sheet (admin only)\n" +
        "`/clear` - Clear all data from the spreadsheet (admin only)" +
        "`/setcode [code]` - Set a new attendance code (admin only)" + 
        "`/getcode` - Get the current attendance code (admin only)"
      }
    )
    .setFooter({ text: 'Woof! Happy to be here with the robotics team!' })
    .setTimestamp();

  await interaction.reply({ embeds: [helloEmbed] });
}

module.exports = { registerCommands, handleCommands };