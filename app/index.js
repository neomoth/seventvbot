const{Client, Events, Collection, GatewayIntentBits, AuditLogEvent, PermissionsBitField, Partials, EmbedBuilder, Message, VoiceState, VoiceChannel, GuildMember, GuildBan, MessageType}=require('discord.js');
const readline = require('readline');
const{token, globalPrefix, ownerId}=require('./config/config.json');
const{getValue, correctMutableName} = require('./cfgedit');
const fs = require('node:fs');
const path = require('node:path');
const SQL = require('./sql');
// const deploySlashCommands = require('./deploySlashCommands');

const client = new Client({intents:[GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildModeration, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.Guilds,GatewayIntentBits.MessageContent,GatewayIntentBits.GuildMessages,GatewayIntentBits.GuildMessageReactions,GatewayIntentBits.GuildMembers],
	partials:[Partials.Message, Partials.Channel, Partials.Reaction]});
client.commands = new Collection();
//client.slashCommands = new Collection();
client.storedData=new Collection();

// client.deploySlashCommands=deploySlashCommands; // for use with eval to live reload interactions

// Allow commands to be reloaded without having to take bot offline.
client.reloadCommands=function(){
	client.commands.clear();
	const commandsPath = path.join(__dirname, 'commands');
	const commands = fs.readdirSync(commandsPath);
	for(const file of commands){
		const commandPath = path.join(commandsPath, file);
		const command = require(commandPath);
		if('data' in command && 'execute' in command){
			console.info(`[INFO]: Command [${command.data.name}] was loaded.`);
			client.commands.set(command.data.name, command);
		}else{
			console.warn(`[WARNING]: Command [${command}] lacks 'data' or 'execute' property.`);
		}
	}
}
// client.reloadSlashCommands=function(){
// 	const commandsPath = path.join(__dirname, 'slashcommands');
// 	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
// 	for (const file of commandFiles) {
// 		const filePath = path.join(commandsPath, file);
// 		const command = require(filePath);
// 		// Set a new item in the Collection with the key as the command name and the value as the exported module
// 		if ('data' in command && 'execute' in command) {
// 			console.info(`[INFO]: Slash Command [${command.data.name}] was loaded.`);
// 			client.slashCommands.set(command.data.name, command);
// 		} else {
// 			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
// 		}
// 	}
// }
client.globalPrefix = globalPrefix;
client.sql=SQL;
function parseISOString(s) {
	let b = s.split(/\D+/);
	return new Date(Date.UTC(b[0], --b[1], b[2], b[3], b[4], b[5], b[6]));
}
function findKeyByValue(value){
	for (const perm of Object.keys(PermissionsBitField.Flags)){
		if(PermissionsBitField.Flags[perm]===value){
			return perm;
		}
	}
	return "unknown";
}
function findKeysByValue(values){
	const result = [];

	for (const perm of Object.keys(PermissionsBitField.Flags)) {
		if (values.has(PermissionsBitField.Flags[perm])) {
			result.push(perm);
		}
	}
	return result;
}

// Interaction related events
client.on(Events.InteractionCreate, async interaction=>{
	if(!interaction.isChatInputCommand())return;

	const command = client.slashCommands.get(interaction.commandName);
	if(!command){
		console.error('cmd not found');
		return;
	}
	try{
		await command.execute(interaction);
	}catch(e){
		console.error(e);
		if(interaction.replied||interaction.deferred) await interaction.followUp({content:'There was an error while executing this command!',ephemeral:true});
		else await interaction.reply({content:'There was an error while executing this command!',ephemeral:true});
	}
});

// Message related events
client.on(Events.MessageCreate, async (e)=>{
	if(e.author.bot) return; // ignore bots/self

	// Command Handler
	if(!e.content.startsWith(globalPrefix)) return;
	let message = e.content.substring(1);
	let args = message.split(' ').slice(1);
	let command = message.split(' ')[0];
	let cmd = client.commands.get(command);
	if(!cmd) {
		let realCmd;
		client.commands.forEach(c=>{
			for(const alias of c.data.aliases){
				if(command===alias) {
					realCmd = c;
					break;
				}
			}
		});
		if(!realCmd) return await e.reply({content:`That's not a valid command. Use \`${globalPrefix}help\` for a list of commands.`}).then((m)=>{setTimeout(async()=>{
			await m.delete();
		},7000)});
		cmd = client.commands.get(realCmd.data.name);
	}
	try{
		if(cmd.data.permissions){
			let p = [];
			for(let i = 0; i<cmd.data.permissions.length;i++){
				if(!e.member.permissions.has(cmd.data.permissions[i], false)){
					p.push(findKeyByValue(cmd.data.permissions[i]).toString());
				}
			}
			if(p.length>0){
				let str='';
				for(let i=0;i<p.length;i++){
					str+=p[i]+', ';
				}
				str=str.substring(0, str.length-2);
				await e.reply({content:`You don't have the required permissions to execute this command. Missing permissions: \`${str}\``});
				return;
			}
		}
		let isMod = false;
		let isAdmin = false;
		for(const role of getValue(correctMutableName('modRoles'))){
			if(!e.member.roles.cache.has(role)) continue;
			isMod = true;
		}
		for(const role of getValue(correctMutableName('adminRoles'))){
			if(!e.member.roles.cache.has(role)) continue;
			isAdmin = true;
		}
		if(e.author.id==ownerId) {
			isMod = true;
			isAdmin = true;
		}
		if(cmd.data.mod&&!isMod) return;
		if(cmd.data.admin&&!isAdmin) return;
		if(getValue(correctMutableName('lockCommands'))){
			if(cmd.data.restrict && getValue(correctMutableName('commandChannels')).length>0)
				if(!getValue(correctMutableName('commandChannels')).includes(e.channelId)&&e.author.id!=ownerId&&!e.member.permissions.has(PermissionsBitField.Flags.ManageMessages,false))return;
		}
		if(cmd.data.disabled&&e.author.id!=ownerId) return await e.reply(`Sorry, the ${cmd.data.name} command is disabled.`);
		await cmd.execute(e,args);
	} catch(err){
		err.stack = err.stack.replaceAll(__dirname, '')
		console.error(err.toString());
		console.error(err.stack);
		let embed = new EmbedBuilder().setColor(getValue(correctMutableName('errorColor'))).setTitle(err.toString()).setDescription(err.stack.substring(0, 400)+'...');
		await e.reply({embeds:[embed]});
	}
});

async function safetyCheck(obj){
	let logChannel = getValue(correctMutableName('logChannel'))
	if(!getValue(correctMutableName('logging'))) return false;
	if(!logChannel) return false
	if(!obj) return false;
	if(obj.constructor==Message){
		if(obj.author===null||obj.author.bot) return false;
		await obj.guild.channels.fetch();
		await obj.channel.messages.fetch();
	}
	if(obj.constructor==VoiceState||obj.constructor==GuildMember||obj.constructor==GuildBan){
		await obj.guild.channels.fetch();
	}
	try{
		let channel = await client.channels.cache.get(logChannel);
		if(!channel) return false;
		if(!channel.guild) return false;
	}catch(e){
		return false;
	}
	return true;
}

client.on(Events.MessageDelete, async (message) => {
	if (!await safetyCheck(message)) return;
	if(!getValue(correctMutableName('logging.MessageDelete'))) return;

	let moderator = null;
	try{
		const auditLogs = await message.guild.fetchAuditLogs({
			type:AuditLogEvent.MessageDelete,
			limit: 1
		});
		const entry = auditLogs.entries.first();
		if(entry){
			if(entry.executor.id!=message.author.id) moderator = entry.executor.id;
		}
	}catch(e){
		console.error(e, "(likely lacks perms to fetch audit logs)");
	}

	SQL.addLog(message.author.id, moderator ? moderator : 'N/A', 'deletemessage', `Message deleted in #${message.channel.name}`, Date.now()/1000);

	let logChannel = await client.channels.cache.get(getValue(correctMutableName('logChannel')));
	let logEmbed = new EmbedBuilder();
	logEmbed.setColor(getValue(correctMutableName('errorColor')));
	logEmbed.setTitle(`Message deleted in #${message.channel.name}`);
	logEmbed.setAuthor({name:message.author.tag,iconURL:message.author.displayAvatarURL()});
	logEmbed.setDescription(`${message.content}\n\nMessage ID: ${message.id}`);
	if(message.attachments.size>0){
		logEmbed.setThumbnail(message.attachments.first().url);
	}
	logEmbed.setTimestamp(Date.now());
	logEmbed.setFooter({text:`User ID: ${message.author.id}`});
	await logChannel.send({embeds:[logEmbed]});
});
client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
	if (!await safetyCheck(newMessage)) return;
	if(!getValue(correctMutableName('logging.MessageUpdate'))) return;

	SQL.addLog(newMessage.author.id, 'N/A', 'editmessage', `Edited message: \`${oldMessage.content}\` -> \`${newMessage.content}\``, Date.now()/1000);

	let logChannel = await client.channels.cache.get(getValue(correctMutableName('logChannel')));
	let logEmbed = new EmbedBuilder();
	logEmbed.setColor(getValue(correctMutableName('altColor')));
	logEmbed.setTitle(`Message edted in #${oldMessage.channel.name}`);
	logEmbed.setAuthor({name:newMessage.author.tag,iconURL:newMessage.author.displayAvatarURL()});
	logEmbed.setDescription(`Old message: ${oldMessage.content}\nNew message: ${newMessage.content}\n\nMessage ID: ${newMessage.id}\n[Jump to message](${newMessage.url})`);
	if(newMessage.attachments.size>0){
		logEmbed.setThumbnail(newMessage.attachments.first().url);
	}
	logEmbed.setTimestamp(Date.now());
	logEmbed.setFooter({text:`User ID: ${newMessage.author.id}`});
	await logChannel.send({embeds:[logEmbed]});
});
client.on(Events.GuildMemberAdd, async (member) => {
	if (!await safetyCheck(member)) return;
	if(!getValue(correctMutableName('logging.GuildMemberAdd'))) return;

	SQL.addLog(member.user.id, 'N/A', 'join', `Joined on ${member.joinedAt}`, Date.now()/1000);

	let logChannel = await client.channels.cache.get(getValue(correctMutableName('logChannel')));
	let logEmbed = new EmbedBuilder();
	logEmbed.setColor(getValue(correctMutableName('confirmColor')));
	logEmbed.setTitle('Member joined');
	logEmbed.setAuthor({name:member.user.tag,iconURL:member.user.displayAvatarURL()});
	let count = member.guild.memberCount;
	let suffix = '';
	switch(count%10){
		case 1: suffix='st'; break;
		case 2: suffix='nd'; break;
		case 3: suffix='rd'; break;
		default: suffix='th';
	};
	logEmbed.setDescription(`<@${member.user.id}> - ${count}${suffix} member to join.\nJoined on ${member.joinedAt}\nMember created at ${member.user.createdAt}`);
	logEmbed.setTimestamp(Date.now());
	logEmbed.setFooter({text:`User ID: ${member.user.id}`});
	await logChannel.send({embeds:[logEmbed]});
});
client.on(Events.GuildMemberRemove, async (member) => {
	if (!await safetyCheck(member)) return;
	if(!getValue(correctMutableName('logging.GuildMemberRemove'))) return;

	let moderator = null;
	try{
		const auditLogs = await member.guild.fetchAuditLogs({
			type:AuditLogEvent.MemberKick,
			limit: 1
		});
		const kick = auditLogs.entries.first();
		if(kick) moderator = kick.executor.id;
	}catch(e){
		console.error(e, "(likely lacks perms to fetch audit logs)");
	}

	SQL.addLog(member.user.id, moderator ? moderator : 'N/A', moderator ? 'kick' : 'leave', `Originally joined on ${member.joinedAt}`, Date.now());

	let logChannel = await client.channels.cache.get(getValue(correctMutableName('logChannel')));
	let logEmbed = new EmbedBuilder();
	logEmbed.setColor(getValue(correctMutableName('errorColor')));
	logEmbed.setTitle(wasKick === 0 ? 'Member left' : 'Member kicked');
	logEmbed.setAuthor({name:member.user.tag,iconURL:member.user.displayAvatarURL()});
	logEmbed.setDescription(`<@${member.user.id}> - Originally Joined on ${member.joinedAt}\n**Roles:** ${member.roles.cache.map(r=>r.name).join(', ')}`);
	logEmbed.setTimestamp(Date.now());
	logEmbed.setFooter({text:`User ID: ${member.user.id}`});
	await logChannel.send({embeds:[logEmbed]});
});
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
	if (!await safetyCheck(newMember)) return;
	if(!getValue(correctMutableName('logging.GuildMemberUpdate'))) return;
	let logChannel = await client.channels.cache.get(getValue(correctMutableName('logChannel')));
	let logEmbed = new EmbedBuilder();
	logEmbed.setColor(getValue(correctMutableName('altColor')));
	if(!oldMember.communicationDisabledUntil&&newMember.communicationDisabledUntil){
		if(!getValue(correctMutableName('logging.GuildMemberUpdate.muted'))) return;

		try{
			const auditLogs = await oldMember.guild.fetchAuditLogs({
				type:AuditLogEvent.MemberUpdate,
				limit: 1
			});
			const entry = auditLogs.entries.first();
			if(entry){
				SQL.addLog(oldMember.user.id, entry.executor.id, 'mute', entry.reason || '(No reason provided)', entry.createdTimestamp);
			}
		}catch(e){
			console.error(e, "(likely lacks perms to fetch audit logs)");
		}

		logEmbed.setTitle('Member muted');
		logEmbed.setAuthor({name:oldMember.user.tag,iconURL:oldMember.user.displayAvatarURL()});
		logEmbed.setDescription(`Timed out until <t:${Math.floor(newMember.communicationDisabledUntilTimestamp/1000)}:f>`);
		logEmbed.setTimestamp(Date.now());
		logEmbed.setFooter({text:`User ID: ${oldMember.user.id}`});
		await logChannel.send({embeds:[logEmbed]});
	}
	if(oldMember.communicationDisabledUntil&&!newMember.communicationDisabledUntil){
		if(!getValue(correctMutableName('logging.GuildMemberUpdate.unmuted'))) return;

		try{
			const auditLogs = await oldMember.guild.fetchAuditLogs({
				type:AuditLogEvent.MemberUpdate,
				limit: 1
			});
			const entry = auditLogs.entries.first();
			if(entry){
				SQL.addLog(oldMember.user.id, entry.executor.id, 'unmute', entry.reason || '(No reason provided)', entry.createdTimestamp);
			}
		}catch(e){
			console.error(e, "(likely lacks perms to fetch audit logs)");
			SQL.addLog(oldMember.user.id, 'Unknown', 'unmute', '(Could not fetch audit log)', Date.now()/1000);
		}

		logEmbed.setTitle('Member unmuted');
		logEmbed.setAuthor({name:oldMember.user.tag,iconURL:oldMember.user.displayAvatarURL()});
		logEmbed.setTimestamp(Date.now());
		logEmbed.setFooter({text:`User ID: ${oldMember.user.id}`});
		await logChannel.send({embeds:[logEmbed]});
	}
	if(oldMember.nickname!=newMember.nickname){
		if(!getValue(correctMutableName('logging.GuildMemberUpdate.nick'))) return;

		let moderator = null;
		try{
			const auditLogs = await oldMember.guild.fetchAuditLogs({
				type:AuditLogEvent.MemberUpdate,
				limit: 1
			});
			const entry = auditLogs.entries.first();
			if(entry){
				if(entry.executor.id!=oldMember.user.id) moderator = entry.executor.id;
			}
		}catch(e){
			console.error(e, "(likely lacks perms to fetch audit logs)");
		}

		SQL.addLog(oldMember.user.id, wasForced ? moderator : 'N/A', 'updatenick', `Old nickname: ${oldMember.nickname} -> ${newMember.nickname}`, Date.now()/1000);
		
		if(oldMember.nickname==null) oldMember.nickname='(None)';
		if(newMember.nickname==null) newMember.nickname='(None)';
		logEmbed.setTitle('Nickname changed');
		logEmbed.setAuthor({name:oldMember.user.tag,iconURL:oldMember.user.displayAvatarURL()});
		logEmbed.setDescription(`Old nickname: ${oldMember.nickname}\nNew nickname: ${newMember.nickname}`);
		logEmbed.setTimestamp(Date.now());
		logEmbed.setFooter({text:`User ID: ${oldMember.user.id}`});
		await logChannel.send({embeds:[logEmbed]});
	}
	if(oldMember.user.username!=newMember.user.username){
		if(!getValue(correctMutableName('logging.GuildMemberUpdate.name'))) return;

		SQL.addLog(oldMember.user.id, 'N/A', 'updatename', `Old username: ${oldMember.nickname} -> ${newMember.nickname}`, Date.now()/1000);

		if(oldMember.user.username==null) oldMember.user.username='(None)';
		if(newMember.user.username==null) newMember.user.username='(None)';
		logEmbed.setTitle('Username changed');
		logEmbed.setAuthor({name:oldMember.user.tag,iconURL:oldMember.user.displayAvatarURL()});
		logEmbed.setDescription(`Old nickname: ${oldMember.user.username}\nNew nickname: ${newMember.user.username}`);
		logEmbed.setTimestamp(Date.now());
		logEmbed.setFooter({text:`User ID: ${oldMember.user.id}`});
		await logChannel.send({embeds:[logEmbed]});
	}
	if(oldMember.roles.cache.size!=newMember.roles.cache.size){
		if(!getValue(correctMutableName('logging.GuildMemberUpdate.roles'))) return;

		try{
			const auditLogs = await oldMember.guild.fetchAuditLogs({
				type:AuditLogEvent.MemberRoleUpdate,
				limit: 1
			});
			const entry = auditLogs.entries.first();
			if(entry){
				let or = oldMember.roles.cache.map(r=>r.name).join(', ');
				let nr = newMember.roles.cache.map(r=>r.name).join(', ');
				SQL.addLog(oldMember.user.id, entry.executor.id, 'updateroles', `Roles changed: ${or} -> ${nr}`, entry.createdTimestamp);
			}
		}catch(e){
			console.error(e, "(likely lacks perms to fetch audit logs)");
			SQL.addLog(oldMember.user.id, 'Unknown', 'updateroles', '(Could not fetch audit log)', Date.now()/1000);
			console.log("didn't work");
		}

		logEmbed.setTitle('Roles changed');
		logEmbed.setAuthor({name:oldMember.user.tag,iconURL:oldMember.user.displayAvatarURL()});
		let excludedRoles = ['1295625879535226922', '1296298827384360980', '1309313095797178389'];
		let newRoles = newMember.roles.cache.filter(r=>!oldMember.roles.cache.has(r.id) && !excludedRoles.includes(r.id));
		let oldRoles = oldMember.roles.cache.filter(r=>!newMember.roles.cache.has(r.id) && !excludedRoles.includes(r.id));
		if(newRoles.size>0) logEmbed.setDescription(`Roles added: ${newRoles.map(r=>`<@&${r.id}>`).join(', ')}`);
		else if (oldRoles.size>0) logEmbed.setDescription(`Roles removed: ${oldRoles.map(r=>`<@&${r.id}>`).join(', ')}`);
		logEmbed.setTimestamp(Date.now());
		logEmbed.setFooter({text:`User ID: ${oldMember.user.id}`});
		if(newRoles.size>0 || oldRoles.size>0) await logChannel.send({embeds:[logEmbed]});
	}
	if(oldMember.avatar!=newMember.avatar){
		if(!getValue(correctMutableName('logging.GuildMemberUpdate.avatar'))) return;

		try{
			const auditLogs = await oldMember.guild.fetchAuditLogs({
				type:AuditLogEvent.MemberUpdate,
				limit: 1
			});
			const entry = auditLogs.entries.first();
			if(entry){
				SQL.addLog(oldMember.user.id, 'N/A', 'updatepfp', `Avatar changed: ${oldMember.user.displayAvatarURL()} -> ${newMember.user.displayAvatarURL()}`, entry.createdTimestamp);
			}
		}catch(e){
			console.error(e, "(likely lacks perms to fetch audit logs)");
			SQL.addLog(oldMember.user.id, 'N/A', 'updatepfp', '(Could not fetch audit log)', Date.now());
		}

		logEmbed.setTitle('Avatar updated.');
		logEmbed.setAuthor({name:newMember.user.tag,iconURL:newMember.user.displayAvatarURL()});
		logEmbed.setThumbnail(newMember.user.displayAvatarURL());
		logEmbed.setTimestamp(Date.now());
		logEmbed.setFooter({text:`User ID: ${newMember.user.id}`});
		await logChannel.send({embeds:[logEmbed]});
	}
});

client.on(Events.VoiceStateUpdate, async (oldState, newState)=>{
	if (!await safetyCheck(newState)) return;
	if(!getValue(correctMutableName('logging.VoiceStateUpdate'))) return;
	let logChannel = await client.channels.cache.get(getValue(correctMutableName('logChannel')));
	let logEmbed = new EmbedBuilder();
	if(!oldState.channel && newState.channel){
		if(!getValue(correctMutableName('logging.VoiceStateUpdate.join'))) return;
		SQL.addLog(newState.member.user.id, 'N/A', 'joinvc', `Joined <#${newState.channel.id}>`, Date.now()/1000);
		logEmbed.setColor(getValue(correctMutableName('confirmColor')));
		logEmbed.setTitle('User connected to a voice channel');
		logEmbed.setAuthor({name:newState.member.user.tag,iconURL:newState.member.user.displayAvatarURL()});
		logEmbed.setDescription(`<@${newState.member.user.id}> connected to <#${newState.channel.id}>`);
		logEmbed.setTimestamp(Date.now());
		logEmbed.setFooter({text:`User ID: ${newState.member.user.id}`});
		await logChannel.send({embeds:[logEmbed]});
	}
	else if(oldState.channel && !newState.channel){
		if(!getValue(correctMutableName('logging.VoiceStateUpdate.leave'))) return;

		let moderator = null;
		try{
			const auditLogs = await oldState.member.guild.fetchAuditLogs({
				type:AuditLogEvent.MemberDisconnect,
				limit: 1
			});
			const entry = auditLogs.entries.first();
			if(entry){
				if(entry.executor.id!=oldState.member.user.id) moderator = entry.executor.id;
			}
		}catch(e){
			console.error(e, "(likely lacks perms to fetch audit logs)");
		}

		SQL.addLog(oldState.member.user.id, moderator ? moderator : 'N/A', 'leavevc', `Left <#${oldState.channel.id}>`, Date.now()/1000);
		logEmbed.setColor(getValue(correctMutableName('errorColor')));
		logEmbed.setTitle('User disconnected from a voice channel');
		logEmbed.setAuthor({name:oldState.member.user.tag,iconURL:oldState.member.user.displayAvatarURL()});
		logEmbed.setDescription(`<@${oldState.member.user.id}> disconnected from <#${oldState.channel.id}>`);
		logEmbed.setTimestamp(Date.now());
		logEmbed.setFooter({text:`User ID: ${oldState.member.user.id}`});
		await logChannel.send({embeds:[logEmbed]});
	}
	else if(oldState.channel !== newState.channel){
		if(!getValue(correctMutableName('logging.VoiceStateUpdate.move'))) return;
		let moderator = null;
		try{
			const auditLogs = await oldState.member.guild.fetchAuditLogs({
				type:AuditLogEvent.MemberMove,
				limit: 1
			});
			const entry = auditLogs.entries.first();
			if(entry){
				if(entry.executor.id!=oldState.member.user.id) moderator = entry.executor.id;
			}
		}catch(e){
			console.error(e, "(likely lacks perms to fetch audit logs)");
		}
		SQL.addLog(oldState.member.user.id, moderator ? moderator : 'N/A', 'movevc', `Moved from <#${oldState.channel.id}> to <#${newState.channel.id}>`, Date.now()/1000);
		logEmbed.setColor(getValue(correctMutableName('altColor')));
		logEmbed.setTitle('User moved between voice channels');
		logEmbed.setAuthor({name:newState.member.user.tag,iconURL:newState.member.user.displayAvatarURL()});
		logEmbed.setDescription(`<@${newState.member.user.id}> moved between <#${oldState.channel.id}> and <#${newState.channel.id}>`);
		logEmbed.setTimestamp(Date.now());
		logEmbed.setFooter({text:`User ID: ${newState.member.user.id}`});
		await logChannel.send({embeds:[logEmbed]});
	}
});
client.on(Events.GuildBanAdd, async (ban) => {
	if (!await safetyCheck(ban)) return;
	if(!getValue(correctMutableName('logging.GuildBanAdd'))) return;
	try{
		const auditLogs = await ban.guild.fetchAuditLogs({
			type:AuditLogEvent.MemberBanAdd,
			limit: 1
		});
		const entry = auditLogs.entries.first();
		if(entry){
			SQL.addLog(ban.user.id, entry.executor.id, 'ban', entry.reason || '(No reason provided)', entry.createdTimestamp);
		}
	}catch(e){
		console.error(e, "(likely lacks perms to fetch audit logs)");
		SQL.addLog(ban.user.id, 'Unknown', 'ban', '(Could not fetch audit log)', Date.now()/1000);
	}
	let logChannel = await client.channels.cache.get(getValue(correctMutableName('logChannel')));
	const {guild, user} = ban;
	let logEmbed = new EmbedBuilder();
	logEmbed.setColor(getValue(correctMutableName('errorColor')));
	logEmbed.setTitle('User banned');
	logEmbed.setAuthor({name:user.tag,iconURL:user.displayAvatarURL()});
	logEmbed.setDescription(`<@${user.id}> was banned from ${guild.name}`);
	logEmbed.setTimestamp(Date.now());
	logEmbed.setFooter({text:`User ID: ${user.id}`});
	await logChannel.send({embeds:[logEmbed]});
});
client.on(Events.GuildBanRemove, async (ban) => {
	if (!await safetyCheck(ban)) return;
	if(!getValue(correctMutableName('logging.GuildBanRemove'))) return;
	try{
		const auditLogs = await ban.guild.fetchAuditLogs({
			type:AuditLogEvent.MemberBanRemove,
			limit: 1
		});
		const entry = auditLogs.entries.first();
		if(entry){
			SQL.addLog(ban.user.id, entry.executor.id, 'unban', 'N/A', entry.createdTimestamp);
		}
	}catch(e){
		console.error(e, "(likely lacks perms to fetch audit logs)");
		SQL.addLog(ban.user.id, 'Unknown', 'unban', '(Could not fetch audit log)', Date.now()/1000);
	}
	let logChannel = await client.channels.cache.get(getValue(correctMutableName('logChannel')));
	const {guild, user} = ban;
	let logEmbed = new EmbedBuilder();
	logEmbed.setColor(getValue(correctMutableName('confirmColor')));
	logEmbed.setTitle('User unbanned');
	logEmbed.setAuthor({name:user.tag,iconURL:user.displayAvatarURL()});
	logEmbed.setDescription(`<@${user.id}> was unbanned from ${guild.name}`);
	logEmbed.setTimestamp(Date.now());
	logEmbed.setFooter({text:`User ID: ${user.id}`});
	await logChannel.send({embeds:[logEmbed]});
});
client.on(Events.MessageReactionAdd, async (reaction, user) => {
	if (!await safetyCheck(user)) return;
	if(!getValue(correctMutableName('logging.MessageReactionAdd'))) return;
	SQL.addLog(user.id, 'N/A', 'addreaction', `Added a reaction to ${reaction.message.url} with ${reaction.emoji}`, Date.now()/1000);
	let logChannel = await client.channels.cache.get(getValue(correctMutableName('logChannel')));
	let logEmbed = new EmbedBuilder();
	logEmbed.setColor(getValue(correctMutableName('confirmColor')));
	logEmbed.setTitle('Reaction added');
	logEmbed.setAuthor({name:user.tag,iconURL:user.displayAvatarURL()});
	logEmbed.setDescription(`<@${user.id}> added a reaction to ${reaction.message.url} with ${reaction.emoji}`);
	logEmbed.setTimestamp(Date.now());
	logEmbed.setThumbnail(reaction.emoji.imageURL());
	logEmbed.setFooter({text:`User ID: ${user.id}`});
	await logChannel.send({embeds:[logEmbed]});
});
client.on(Events.MessageReactionRemove, async (reaction, user) => {
	if (!await safetyCheck(user)) return;
	if(!getValue(correctMutableName('logging.MessageReactionRemove'))) return;
	SQL.addLog(user.id, 'N/A', 'removereaction', `Removed a reaction to ${reaction.message.url} with ${reaction.emoji}`, Date.now()/1000);
	let logChannel = await client.channels.cache.get(getValue(correctMutableName('logChannel')));
	let logEmbed = new EmbedBuilder();
	logEmbed.setColor(getValue(correctMutableName('errorColor')));
	logEmbed.setTitle('Reaction removed');
	logEmbed.setAuthor({name:user.tag,iconURL:user.displayAvatarURL()});
	logEmbed.setDescription(`<@${user.id}> removed a reaction to ${reaction.message.url} with ${reaction.emoji}`);
	logEmbed.setTimestamp(Date.now());
	logEmbed.setThumbnail(reaction.emoji.imageURL());
	logEmbed.setFooter({text:`User ID: ${user.id}`});
	await logChannel.send({embeds:[logEmbed]});
});

client.on(Events.ClientReady,async()=>{
	console.info('[INFO]: 7TV bot is online.');
});

client.reloadCommands();
//client.reloadSlashCommands();

const defaultConfPath = path.join(__dirname, 'config/default-config.json');
const confPath = path.join(__dirname, 'config/config.json');
const dbPath = path.join(__dirname, 'db.sqlite');
function areKeysDifferent(defaultConf, userConf) {
	return Object.keys(defaultConf).filter(key => userConf[key] !== defaultConf[key]);
}
// new default keys should be added to the config file, removed default keys should be removed from the config file, no changes in config file affect default config file.
const removedKeys = [];
const addedKeys = [];
function syncConfigKeys(defaultConf, userConf) {
	const syncedConf = {};
	for(const key in defaultConf){
		if(typeof defaultConf[key] === 'object' && !Array.isArray(defaultConf[key])){
			syncedConf[key] = syncConfigKeys(defaultConf[key], userConf[key]) || {};
			addedKeys.push(key);
		}
		else{
			syncedConf[key] = userConf[key] !== undefined ? userConf[key] : defaultConf[key];
			addedKeys.push(key);
		}
	}
	for(const key in userConf){
		if(!(key in defaultConf)){
			removedKeys.push(key);
		}
	}
	return syncedConf;
}
if(!fs.existsSync(confPath)){
	console.info('[INFO]: Config file not found. Creating default config file.');
	if(!fs.existsSync(defaultConfPath)){
		console.error('[FATAL]: You are missing the default config. Pull the file from the bot repository and place it in the config directory.');
		process.exit(1);
	}
	fs.copyFileSync(defaultConfPath, confPath);
	console.info('[INFO]: Config file created.');
}
else{
	console.info('[INFO]: Config found. Checking for new defaults...');
	const defaultConf = JSON.parse(fs.readFileSync(defaultConfPath));
	const conf = JSON.parse(fs.readFileSync(confPath));
	if(areKeysDifferent(defaultConf, conf).length>0) 
		fs.writeFileSync(confPath, JSON.stringify(syncConfigKeys(defaultConf, conf), null, 4));
	// console.info(`[INFO]: Default config was modified.${addedKeys.length>0 ? `\nThe following keys were added to the config file: ${addedKeys.join(', ')}` : ''}${removedKeys.length>0 ? `\nThe following keys were removed from the config file: ${removedKeys.join(', ')}` : ''}`);
}

process.on('SIGINT', async () => {
	console.log('Received SIGINT. Gracefully shutting down...');
	sql.closePool();
	process.exit(0);
});
process.on('SIGTERM', async () => {
	console.log('Received SIGTERM. Gracefully shutting down...');
	sql.closePool();
	process.exit(0);
});

SQL.migrateDatabase();
client.login(token);