function removequotes(str){
	return str.replace(/^['"]+|['"]+$/g, '');
}

const {PermissionsBitField, Permissions, Role, User, GuildMember} = require('discord.js');
const {cfgEdit, getMutables, getKeyType, mutableExists, correctMutableName, setDefault, resetAll, getDescription, getDecoratedValue} = require('../cfgedit');
module.exports = {
	data:{
		name: 'config',
		description: 'update bot configuration',
		aliases: ['cfg'],
		admin: true,
		usage: ']config <(get <key> | list | set <key> <value> | reset <key> | (flush | reset-all | resetall))>'
	},
	async execute(i,args){
		if(!args[0]) return await i.reply(`You need to specify whether to get, set, or reset a key. usage: \`${this.data.usage}\``);
		if(args[0].toLowerCase()==='get'){
			if(!args[1]) return await i.reply("You need to specify a key. Valid keys are:\n"+Object.keys(getMutables()).map(k=>`\`${k}\``).join(', '));
			if(!mutableExists(args[1])) return await i.reply("Invalid config key. Valid keys are:\n"+Object.keys(getMutables()).map(k=>`\`${k}\``).join(', '));
			return await i.reply(`Current value of \`${correctMutableName(args[1])}\`: \`${getDecoratedValue(args[1])}\`. Value type: \`${getKeyType(correctMutableName(args[1]))}\`\nDescription: \`\`\`ansi\n${getDescription(correctMutableName(args[1]))}\n\`\`\``);
		}
		else if(args[0].toLowerCase()==='list'){
			return await i.reply(`Current configuration:\n${Object.keys(getMutables()).map(k=>`\`${k}\`: \`${getDecoratedValue(k)}\``).join('\n')}`);
		}
		else if(args[0].toLowerCase()==='set'){
			if(!args[1]) return await i.reply("You need to specify a key. Valid keys are:\n"+Object.keys(getMutables()).map(k=>`\`${k}\``).join(', '));
			if(!mutableExists(args[1])) return await i.reply("Invalid config key. Valid keys are:\n"+Object.keys(getMutables()).map(k=>`\`${k}\``).join(', '));
			
			let key = correctMutableName(args[1]);

			let strError = false;

			function parseValue(val){
				val = removequotes(val);

				try {
					return JSON.parse(val);
				}
				catch (e) {
					strError = true;
				}
			}

			/////// handle custom types first ////////////

			// 0: YES
			// 1: NO
			// 2: INVALID CHANNEL PERMISSIONS
			// 3: INVALID CHANNEL TYPE
			// 4: CHANNEL SOMEHOW FOUND DESPITE NOT BEING IN GUILD
			async function isIdValid(id, type){
				id = removequotes(id);
				if(!/^\d+$/.test(id)) return 1;

				let subtype = null;

				if(type.includes("#")){
					subtype = type.split('#')[1];
					type = type.split('#')[0];
				}
				switch(type){
					case "CHANNEL":
						await i.client.channels.fetch();
						try{
							const channel = await i.client.channels.fetch(id);
							if(!channel) return 1;
							if(subtype==="TEXT"){
								if(!channel.isTextBased()) return 3;
							}
							if(channel.guild){
								const bot = channel.guild.members.me;
								const permissions = channel.permissionsFor(bot);
								if(permissions.has(PermissionsBitField.Flags.SendMessages) && permissions.has(PermissionsBitField.Flags.ViewChannel)) return 0;
								else return 2;
							}
							else return 4;
						}
						catch(e){
							return 1;
						}
					case "USER":
						// await i.client.users.fetch();
						try{
							const user = await i.client.users.fetch(id);
							if(!user) return 1;
							return user;
						}
						catch(e){
							return 1;
						}
					case "ROLE":
						await i.guild.roles.fetch();
						try{
							const role = await i.guild.roles.cache.get(id);
							if(!role) return 1;
							return role;
						}
						catch(e){
							return 1;
						}
				}
			}

			function isValidPermission(permission){
				for(const perm of Object.keys(PermissionsBitField.Flags)){
					if(perm.toLowerCase()===permission.toLowerCase()) return true;
				}
				return false;
			}

			function correctPermissionName(permission){
				for(const perm of Object.keys(PermissionsBitField.Flags)){
					if(perm.toLowerCase()===permission.toLowerCase()) return perm;
				}
				return null;
			}

			async function handleHex(k, val){
				if(val==="null"){
					cfgEdit(key, "");
					return await i.reply(`Set config value for \`${key}\` to \`${getDecoratedValue(key)}\`.`);
				}
				val = removequotes(val);
				if(!/^#[0-9a-fA-F]{6}$/.test(val)) return await i.reply("You must provide a valid hex color. Example: `#ff0000`");
				cfgEdit(key, val);
				return await i.reply(`Set config value for \`${key}\` to \`${getDecoratedValue(key)}\`.`);
			}

			async function handlePermission(k, val){
				if(val==="null"){
					cfgEdit(key, "");
					return await i.reply(`Set config value for \`${key}\` to \`${getDecoratedValue(key)}\`.`);
				}
				val = val.split('_').join('').trim();
				val = removequotes(val);
				if(!isValidPermission(val)) return await i.reply("You must provide a valid permission flag.\nYou can find a list of all permission values [here](https://discord.com/developers/docs/topics/permissions#permissions-bitwise-permission-flags). You can type it as `PermissionName`, `permissionname`, or `PERMISSION_NAME`.");
				cfgEdit(key, correctPermissionName(val));
				return await i.reply(`Set config value for \`${key}\` to \`${getDecoratedValue(key)}\`.`);
			}

			async function handlePermissionArray(k, val){
				if(val==="[]"){
					cfgEdit(key, []);
					return await i.reply(`Set config value for \`${key}\` to \`${getDecoratedValue(key)}\`.`);
				}
				if(val.startsWith('[')) val = val.slice(1, -1);
				let index = 0;
				let finalVal = [];
				for (let perm of val.split(',')){
					perm = perm.split('_').join('').trim();
					perm = removequotes(perm);
					let result = await isValidPermission(perm.toString());
					if (result){
						if(finalVal.includes(perm.trim())) return await i.reply(`Value at index ${index} is already in the array. Do not include duplicate values.`);
						finalVal.push(correctPermissionName(perm));
						index++;
						continue;
					}
					return await i.reply(`Value at index ${index} is not a valid permission flag.\nYou can find a list of all permission values [here](https://discord.com/developers/docs/topics/permissions#permissions-bitwise-permission-flags). You can type it as \`PermissionName\`, \`permissionname\`, or \`PERMISSION_NAME\`.`);
				}
				cfgEdit(key, finalVal);
				return await i.reply(`Set config value for \`${key}\` to \`${getDecoratedValue(key)}\`. To unset, pass \`[]\`.`);
			}

			async function handleID(k, val){
				if(val==="null"){
					cfgEdit(key, "");
					return await i.reply(`Set config value for \`${key}\` to \`${getDecoratedValue(key)}\`.`);
				}
				let type = k.split(":")[1];
				let result = await isIdValid(val.toString(), type);
				async function success(){
					cfgEdit(key, val);
					return await i.reply(`Set config value for \`${key}\` to \`${getDecoratedValue(key)}\`. To unset, pass \`null\`.`);
				}
				switch(result){
					case 0: return await success();
					case 1: return await i.reply(`You must provide a valid ${type.split('#')[0].toLowerCase()} ID. To unset, pass \`null\`.`);
					case 2: return await i.reply(`Channel ID was valid, but I either can't see the channel or can't send messages in it. Fix and try again.`);
					case 3: return await i.reply(`Incorrect channel type. Expected a ${type.split('#')[1].toLowerCase()} channel.`);
					case 4: return await i.reply(`I don't know what could possibly cause this but if this somehow triggers, the channel is somehow found but not a part of the guild.`)
					default:
						if(typeof result == 'object') return await success();
				}
			}

			async function handleIDArray(k, val){
				if(val==="[]"){
					cfgEdit(key, []);
					return await i.reply(`Set config value for \`${key}\` to \`${getDecoratedValue(key)}\`.`);
				}
				if(val.startsWith('[')) val = val.slice(1, -1);
				let type = k.split(":")[1];
				let index = 0;
				let finalVal = [];
				for (const id of val.split(',')){
					let result = await isIdValid(id.toString().trim(), type);
					if (result === 0 || typeof result == 'object'){
						if(finalVal.includes(id.trim())) return await i.reply(`Value at index ${index} is already in the array. Do not include duplicate values.`);
						finalVal.push(id.trim());
						index++;
						continue;
					}
					async function err1(){return await i.reply(`Value at index ${index} is not a valid ${type.split('#')[0].toLowerCase()} ID.`)}
					switch(result){
						case 1: return await err1();
						case 2: return await i.reply(`Value at index ${index} was a valid ${type.split('#')[0].toLowerCase()} ID, but I either can't see the channel or can't send messages in it. Fix and try again.`);
						case 3: return await i.reply(`Value at index ${index} was a valid ${type.split('#')[0].toLowerCase()} ID, but the channel is of the wrong type. Expected a ${type.split('#')[1].toLowerCase()} channel.`);
						case 4: return await i.reply(`somehow the value at ${index} was found but is not a part of the guild.`)
						default: return await err1();
					}
				}
				cfgEdit(key, finalVal);
				return await i.reply(`Set config value for \`${key}\` to \`${getDecoratedValue(key)}\`. To unset, pass \`[]\`.`);
			}

			// determine type and how to handle

			let value = args.slice(2).join(' ');

			const keyType = getKeyType(key);
			// non array types
			if(keyType.startsWith("ID")) return handleID(keyType, value);
			else if(keyType==="Hex") return handleHex(keyType, value);
			else if(keyType==="Permission") return handlePermission(keyType, value);
			// array types
			else if(keyType.startsWith("Array")){
				if(keyType.includes("[")){
					let arrType = keyType.split("[")[1].split("]")[0];
					if(arrType.startsWith("ID")) return handleIDArray(arrType, value);
					if(arrType.startsWith("Permission")) return handlePermissionArray(arrType, value);
					// if no matches, fall into normal type handling.
				}
			}

			// handle normal types

			value = parseValue(args.slice(2).join(' ')); // redefine to parse for normal types.
			if(strError) return await i.reply("You must provide valid JSON. If you are trying to set a string, you must wrap it in quotes.");

			if(value===null||value===undefined) return await i.reply("You cannot pass `null` or `undefined` as a value unless stated otherwise.");
			if(getKeyType(key)!==value.constructor.name) return await i.reply(`The value you provided is not of the correct type. The correct type is \`${getKeyType(key)}\`.`);
			cfgEdit(key, value);
			return await i.reply(`Set config value for \`${key}\` to \`${value}\`.`);
		}
		else if(args[0].toLowerCase()==='reset'){
			if(!args[1]) return await i.reply("You need to specify a key. Valid keys are:\n"+Object.keys(getMutables()).map(k=>`\`${k}\``).join(', '));
			if(!mutableExists(args[1])) return await i.reply("Invalid config key. Valid keys are:\n"+Object.keys(getMutables()).map(k=>`\`${k}\``).join(', '));
			setDefault(correctMutableName(args[1]));
			return await i.reply(`Reset config value for \`${correctMutableName(args[1])}\` to \`${getDecoratedValue(correctMutableName(args[1]))}\`.`);
		}
		else if(args[0].toLowerCase()==='flush'||args[0].toLowerCase()==='reset-all'||args[0].toLowerCase()==='resetall'){
			resetAll();
			return await i.reply("Set all config options to their default values.");
		}
		return await i.reply(`Invalid syntax. usage: \`${this.data.usage}\``);
	}
}