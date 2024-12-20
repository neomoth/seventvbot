// TODO: this needs to be finished later, basically just logs.js but for searching stuff that a mod did, with options to filter by user or type.

const {PermissionsBitField, EmbedBuilder} = require('discord.js');
const {Pagination} = require('pagination.djs');
const {getValue, correctMutableName} = require('../cfgedit');
module.exports = {
	data:{
		name:'modlogs',
		description:'Search a mod\'s moderation logs',
		usage:']modlogs (list-types | <moderator> - )',
		aliases:['ml'],
		mod:true,
		disabled:true
	}, async execute(i,args){
		if(!args[0]) return await i.reply({content:`You need to specify the user you want to search for. Usage: \`${this.data.usage}\``, ephemeral:true});
		if(args[0]==="list-types") return await i.reply({content:"Valid types are as follows: `mute, unmute, warn, kick, ban, unban, join, leave, updateroles, addreaction, removereaction, deletemessage, editmessage, updatenick, updatename, updatepfp, joinvc, movevc, leavevc`", ephemeral:true});
		await i.guild.members.fetch();

		let user;
		const mentionRegex = /^<@!?(\d+)>$/;
		if(args[0].match(mentionRegex)) user = await i.guild.members.cache.get(args[0].match(mentionRegex)[1]);
		else if(/^\d+$/.test(args[0])) user = await i.guild.members.cache.get(args[0]);
		else{
			let members = await i.guild.members.fetch();
			user = members.find(m=>m.user.username.toLowerCase()===args[0].toLowerCase());
		}
		if(!user) return await i.reply({content:"User was not found.", ephemeral:true});
		
		let logs = await i.client.sql.getAllLogsByUser(user.id);
		if(logs.length<1) return await i.reply({content:"There are no logs for this user.", ephemeral:true});

		let ids = [];
		let users = [];
		let mods = [];
		let timestamps = [];
		let types = [];
		let reasons = [];

		const pagination = new Pagination(i);
		logs.reverse();
		for(let log of logs){
			let u;
			let mod;
			try{
				let ufetch = await i.guild.members.fetch(log.user);
				u = await ufetch.user.username;
			}catch(e){
				try{
					ufetch = await i.client.users.fetch(log.user);
					u = await ufetch.username;
				}catch(e){
					u = log.user;
				}
			}
			if(log.moderator=='N/A') mod = 'N/A';
			else if(log.moderator!='Unknown'){
				let mfetch;
				try{
					mfetch = await i.guild.members.fetch(log.moderator);
					mod = await mfetch.user.username;
				}catch(e){
					try{
						mfetch = await i.client.users.fetch(log.moderator);
						mod = await mfetch.username;
					}catch(e){
						mod = log.moderator;
					}
				}
			}
			else mod = log.moderator;
			ids.push(log.id);
			users.push(u);
			mods.push(mod);
			timestamps.push(log.timestamp);
			types.push(log.type);
			reasons.push(log.reason);
		}
		pagination.setColor(getValue(correctMutableName('primaryColor')));
		pagination.setTitle(`${user.user.username}'s logs`);
		let fields = [];
		for(let i = 0;i<ids.length;i++){
			fields.push({
				name:`ID: ${ids[i]}`,
				value:`
					**Type**: ${types[i]}
					**Reason**: ${reasons[i]}
					**Moderator**: ${mods[i]}
					**Timestamp**: <t:${timestamps[i]}:f>
				`
			});
		}
		pagination.setFields(fields);
		pagination.paginateFields();
		await pagination.render();
		return;
	}
}