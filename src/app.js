const config = require('../config/config.json');
const Discord = require('discord.js');
const mysql = require('mysql');
const client = new Discord.Client();

//--- Mysql connection.
var pool = mysql.createPool({
  connectionLimit : 100,
  host            : config.database.host,
  user            : config.database.username,
  password        : config.database.password,
  database        : config.database.database
});

function checkIfCodeValid(clientId, code) {
  return new Promise(function(resolve, reject) {
    pool.query('SELECT * FROM discord_pending WHERE code = ? LIMIT 1', [code], function (error, result, fields) {
      if (error) reject();

      if (result[0] != null && result[0].uuid != null) {
        result[0].clientId = clientId;
        resolve(result[0]);
      }

      reject();
    });
  });
}

function checkIfAuthValid(clientId, code) {
  return new Promise(function(resolve, reject) {
    pool.query('SELECT * FROM staff_pending WHERE code = ? LIMIT 1', [code], function (error, result, fields) {
      if (error) reject();

      if (result[0] != null && result[0].uuid != null) {
        result[0].clientId = clientId;
        resolve(result[0]);
      }

      reject();
    });
  });
}

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

//--- When a new member joins our discord.
client.on('guildMemberAdd', member => {
  member.guild.channels.get(config.channel.welcome).send(
    new Discord.RichEmbed()
      .setAuthor("Welcome " + member.user.tag + " to the MineSkies discord!", "https://i.imgur.com/WZ0j8fN.png")
      .setColor("BLUE")
  );
});

//--- Main message listener.
client.on('message', message => {
  var channelId = message.channel.id;
  var member = message.member;
  var content = message.content;

  var args = content.split(' ');
  args.shift();
  
  //--- Commands.
  if (content.startsWith('!')) {

    //--- Discord linking.
    if (channelId == config.channel.link) {
      
      if (content.startsWith('!link')) {
        if (args.length == 1) {
          var code = args[0];
          
          checkIfCodeValid(member.id, code).then(function(data) {

            //--- Delete & insert.
            pool.query('DELETE FROM discord_pending WHERE uuid = ?', [data.uuid]);

            new Promise(function(resolve, reject) {
              pool.query('DELETE FROM discord_link WHERE discord_id = ?', [data.clientId], function() {
                resolve(data.clientId);
              });
            }).then(function(memberId) {

              //--- Insert new link.
              pool.query('INSERT INTO discord_link (uuid, name, discord_id) VALUES (?, ?, ?)', [data.uuid, data.name, memberId]);

              //--- Reply.
              message.reply('Your discord account is now linked to \'' + data.name + '\', rejoin in-game to update the status.');

              //--- Give role.
              var guild = client.guilds.get(config.guild);
              var role = guild.roles.find(role => role.name === "Linked");
              client.guilds.get(config.guild).members.get(memberId).addRole(role, 'Linking account.');

            }, function() {
              message.reply('An error has occured while linking your account, please message an admin.');
            });

          }, function() {
            message.reply('Invalid code, try typing **/discord** again in-game.');
          });
        } else {
          message.reply('Invalid format: !link <code>');
        }
      }

    }

    //--- Staff punishment channel.
    if (channelId == config.channel.staffPunishment) {

      if (content.startsWith('!lookup')) {
        if (args.length == 1) {
          var arg0 = args[0];

          pool.query('SELECT * FROM litebans_bans WHERE uuid = ? OR ip = ? OR reason = ? OR banned_by_uuid = ? OR banned_by_name = ?', [arg0], function(fields, data, error) {
            if (error) console.log(error);
            var sendChl = client.guilds.get(config.guild).channels.get(config.channel.staffPunishment);

            if (data != null && data.length > 0) {
              var embed = new Discord.RichEmbed()
                            .setTitle("Lookup")
                            .setColor("GREEN")
                            .setTimestamp();

              for (var i = 0; i < data.length; i++) {
                var cur = data[i];
                var length = ((cur.until - cur.time) / 1000) / 60;

                embed.addField(cur.time, "Reason: " + cur.reason + " - Length: " + (cur.until == -1 ? 'Perm' : length) + " - State: " + (cur.active == 1 ? 'Banned' : 'Expired'));
              }

              sendChl.send(embed);
            } else {
              sendChl.send(
                new Discord.RichEmbed()
                  .setTitle("Error")
                  .setDescription("Could not find any punishments for '" + arg0 + "'")
                  .setColor("RED")
              );
            }
          });
        } else {
          message.reply('Invalid format: !lookup <name|UUID|IP>');
        }
      }

      if (content.startsWith('!ban')) {
        if (args.length == 2) {

        } else {
          message.reply('Invalid format: !ban <name|UUID|IP> <reason>');
        }
      }

      if (content.startsWith('!unban')) {
        if (args.length == 1) {

        } else {
          message.reply('Invalid format: !unban <name|UUID|IP>');
        }
      }

      message.delete();

    }

    //--- Server IP.
    if (content.startsWith('!ip') || content.startsWith('!server')) {
      message.channel.send(
        new Discord.RichEmbed()
          .setTitle("Server Information")
          .setDescription("**MC Version:** 1.13.\*\n**IP:** play.mineskies.com")
          .setColor("BLUE")
      );
    }

    //-- Site.
    if (content.startsWith('!website') || content.startsWith('!site') || content.startsWith('!shop') 
      || content.startsWith('!store') || content.startsWith('!donate')) {

      message.channel.send(
        new Discord.RichEmbed()
          .setTitle("Website Information")
          .setDescription("**Store:** https://store.mineskies.com")
          .setColor("GREEN")
      );

    }

    //--- Vote.
    if (content.startsWith('!vote')) {

      message.channel.send(
        new Discord.RichEmbed()
          .setTitle("Vote Information")
          .setDescription("Vote daily to receive **1500 coins** and **3 vote keys**.\n**Top 3 voters** at the end of the month will receive **$20 store coupons** (/votetop in-game)\n \n:one: http://bit.ly/ms-vote-1\n:two: http://bit.ly/ms-vote-2\n:three: http://bit.ly/ms-vote-3")
          .setColor("PURPLE")
      );

    }

    //--- Staff auth.
    if (channelId == config.channel.staffAuth) {
      if (content.startsWith('!auth')) {
        if (args.length == 1) {
          var code = args[0];

          checkIfAuthValid(member.id, code).then(function(data) {

            pool.query('DELETE FROM staff_pending WHERE uuid = ?', [data.uuid]);
            pool.query('INSERT INTO staff_ip (uuid, ip) VALUES (?, ?)', [data.uuid, data.ip]);

            message.reply('Authenticated, you may now connect.');

          }, function() {
            message.reply('Invalid code.');
          });
        } else {
          message.reply('Invalid format: !auth <code>');
        }
      }
    }

    //--- Update log.
    if (channelId == config.channel.test) {
      if (content.startsWith('!update')) {
        if (args.length >= 3) {
          var updateMessage = "";

          for (var i = 2; i < args.length; i++) {
            if (i == (updateMessage.length - 1)) {
              updateMessage += args[i];
            } else {
              updateMessage += args[i] + " ";
            }
          }

          message.guild.channels.get(config.channel.updateLog).send(
            new Discord.RichEmbed()
              .setTitle("Changelog - " + args[0])
              .setDescription(updateMessage)
              .setColor(args[1])
              .setTimestamp()
          );

        } else {
          message.reply('Invalid format: !update <title> <colour> <message>');
        }
      }
    }

  }

  //--- Reports / Unbans.
  if (member.id != config.id && (channelId == config.channel.unban || channelId == config.channel.report)) {

    var destId = config.channel.staffUnban;
    if (channelId == config.channel.report) {
      destId = config.channel.staffReport;
    }

    message.reply('Form sent.');
    client.guilds.get(config.guild).channels.get(destId).send(
      new Discord.RichEmbed()
        .setAuthor(member.user.tag)
        .setTitle("Form")
        .setDescription(content)
        .setColor("BLUE")
        .setTimestamp()
    );
    message.delete();

  }

  //--- Delete all messages in link.
  if ((channelId == config.channel.link || channelId == config.channel.staffAuth) && member.id != config.id && !message.pinned) {
    message.delete();
  }

});

//--- Announce new IPs connecting to staff accounts.
var securityData = [];
setInterval(function() {
  pool.query('SELECT * FROM staff_pending', function (error, result, fields) {
    if (result.length > 0) {
      for (var i = 0; i < result.length; i++) {
        var data = result[i];

        if (data.announced == 0) {

          //--- Set announced to true.
          pool.query('UPDATE staff_pending SET announced = 1 WHERE uuid = ?', [data.uuid]);

          client.guilds.get(config.guild).channels.get(config.channel.staffAuth).send(
            new Discord.RichEmbed()
              .setTitle("Security Notice")
              .setDescription("<@" + data.discord_id + "> A new IP has tried to connect to the server using your account, was this you? React with :thumbsup: or :thumbsdown:.")
              .setColor("RED")
          ).then(msg => {

            //--- Add to cache for later use.
            securityData[msg.id] = data; 

            //--- Add reactions.
            msg.react('👍').then(() => msg.react('👎'));

          });

        }
      }
    }
  });
}, 60 * 1000);

client.on('messageReactionAdd', (reaction, user) => {
  var channel = reaction.message.channel;
  var data = securityData[reaction.message.id];
  
  if (channel.id == config.channel.staffAuth
    && ['👍', '👎'].includes(reaction.emoji.name)
    && data != null
    && data.discord_id == user.id) {

      if (reaction.emoji.name === '👍') {
        pool.query('DELETE FROM staff_pending WHERE uuid = ?', [data.uuid]);
        pool.query('INSERT INTO staff_ip (uuid, ip) VALUES (?, ?)', [data.uuid, data.ip]);

        channel.send('<@' + user.id + '> Authenticated, you may now connect.');
      } else {
        channel.send('<@' + user.id + '> Locked IP from connecting, this has been reported to admins.');
  
        //--- Alert admins.
        channel.guild.channels.get(config.channel.admin).send(
          new Discord.RichEmbed()
            .setTitle("Security Notice")
            .setDescription("IP '" + data.ip + "' tried to connect to <@" + user.id + ">'s account, <@" + user.id + "> has reported this IP as not them. Look into the IP.")
            .setColor("RED")
        );
      }

      reaction.message.delete();
  }

});

//--- Login to our bot.
client.login(config.token);