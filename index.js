const { Client, Events, GatewayIntentBits, ActivityType, EmbedBuilder } = require('discord.js');
const { token } = require('./config.json');
const { registerCommands, handleCommands } = require('./commands');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions
  ]
});

const activePhrases = [
  "Programming swerve",
  "Crying over autos magically not working",
  "Catching up on the latest Cheif Deplhi",
  "Looking for a lost bolt",
  "Zip-tieing the arm back together",
  "Cleaning floor marks",
  "Sweeping carpet dust",
  "Eating sawdust",
  "Machning complex parts on the complex machine",
  "Fixing the laythe",
  "Training new members",
  "Scouting 1086",
  "Talking to Matt Wilson",
  "Eating blue cheese",
  "Trying to create a triple helix",
  "Sending 118 people to space",
  "Rushing to the number 27",
  "Watching 254 slam into the field",
  "Building tomorrow's tech with yesterday's parts",
  "Chatting with the AP grader",
  "Just add a zip tie...",
  "If we try hard enough, a screw is just another nail",
  "This will only take a day to do",
  "Conner (probably): Sleep is for the weak"
];

const idlePhrases = [
  "Dreaming about dean kamen",
  "Sleeping on 2x1 tubing",
  "Taking a nap during playoffs",
  "Dozing off thinking about Dozer",
  "Remembering Woodie Flowers",
  "Contemplating the meaning of GP",
  "Snoozing through strategy sessions",
  "Hibernating until the next build season",
  "Powering down for system updates (Windows)",
  "Conserving energy for the next match",
  "Visualizing the perfect autonomous routine",
  "Dreaming about dean kamen's segway collection",
  "It worked last night…"
];

function getRandomPhrase(phrases) {
  return phrases[Math.floor(Math.random() * phrases.length)];
}

let lastPosts = [];
let isInitialRun = true;

function loadLastPosts() {
  const filePath = path.join(__dirname, 'last_posts.json');
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf8');
    lastPosts = JSON.parse(data);
  }
}

function saveLastPosts(posts) {
  const filePath = path.join(__dirname, 'last_posts.json');
  fs.writeFileSync(filePath, JSON.stringify(posts, null, 2), 'utf8');
}

function checkChiefDelphiPosts() {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, 'scrape.py');
    const pythonProcess = spawn('python', [pythonScript]);
    let data = '';

    pythonProcess.stdout.on('data', (chunk) => {
      data += chunk.toString();
    });

    pythonProcess.stderr.on('data', (chunk) => {
      console.error('Scraper:', chunk.toString());
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(`Python script exited with code ${code}`);
        return;
      }

      try {
        const posts = JSON.parse(data);
        resolve(posts);
      } catch (error) {
        reject(`Error parsing JSON: ${error}`);
      }
    });
  });
}

const CHANNEL_ID = '1281420364039327745';

async function sendNewPostsToChannel(client, newPosts) {
  const channel = client.channels.cache.get(CHANNEL_ID);
  if (!channel) {
    console.error(`Channel with ID ${CHANNEL_ID} not found`);
    return;
  }

  for (const post of newPosts) {
    const embed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle(post.title)
      .setURL(post.url)
      .addFields(
        { name: 'Replies', value: post.replies, inline: true },
        { name: 'Views', value: post.views, inline: true },
        { name: 'Last Activity', value: post.last_activity, inline: true }
      )
      .setFooter({ text: 'New post on Chief Delphi' })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  }
}

async function updateBotStatus() {
  const now = new Date();
  const hour = now.getHours();

  if (hour >= 16 && hour < 19) {
    client.user.setStatus('online');
    client.user.setActivity(getRandomPhrase(activePhrases), { type: ActivityType.Playing });
  } else if (hour >= 19 || hour < 4) {
    client.user.setStatus('idle');
    client.user.setActivity(getRandomPhrase(idlePhrases), { type: ActivityType.Playing });
  } else {
    client.user.setStatus('online');
    client.user.setActivity('Waiting for action', { type: ActivityType.Watching });
  }

  try {
    const newPosts = await checkChiefDelphiPosts();

    if (newPosts.length > 0) {
      // Filter out posts that are already in lastPosts
      const filteredNewPosts = newPosts.filter(post =>
        !lastPosts.some(lastPost => lastPost.url === post.url)
      );

      // Send only the new posts to the channel
      if (filteredNewPosts.length > 0 && !isInitialRun) {
        console.log(`Sending posts to channel: ${CHANNEL_ID}`);
        //wait sendNewPostsToChannel(client, filteredNewPosts); Disabled for now
      }

      // Update lastPosts to contain the most recent set of posts
      lastPosts = newPosts;
      saveLastPosts(lastPosts);
      console.log("List of posts:");
      for (const post of newPosts) {
        console.log(post.title);
      }

      if (isInitialRun) {
        isInitialRun = false;
        console.log("Initial run completed. Future updates will send new post notifications.");
      }
    }
  } catch (error) {
    console.error('Error checking Chief Delphi posts:', error);
  }
}

client.once(Events.ClientReady, async readyClient => {
  try {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
    await registerCommands(client);
    loadLastPosts();
    updateBotStatus();
    setInterval(updateBotStatus, (60000) ); // Update status every 5 minutes
  } catch (error) {
    console.error('Error during initialization:', error);
  }
});

client.login(token).catch(error => {
  console.error('Error logging in:', error);
});

// Add this to handle unhandled promise rejections
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});
