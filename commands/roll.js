const {EmbedBuilder} = require("discord.js");
const {getValue, correctMutableName} = require('../cfgedit');
module.exports = {
	data:{
		name:'roll',
		description:'Roll a a die with the amount of sides being whatever the first argument is.',
		usage:`]roll d<number>`,
		aliases:['r'],
		restrict:true
	},async execute(i, args){
		if(!args[0]) return await i.reply({embeds:[new EmbedBuilder().setColor(getValue(correctMutableName('errorColor'))).setDescription('You need to specify the amount of sides for the die. Usage: `]roll <number>`')]});
		if(args[0].startsWith('d')) {
			args[0] = args[0].slice('1');
			if (isNaN(args[0])) return await i.reply({embeds: [new EmbedBuilder().setColor(getValue(correctMutableName('errorColor'))).setDescription('You need to specify a number!')]});;
			if(args[0]<1) return await i.reply({embeds: [new EmbedBuilder().setColor(getValue(correctMutableName('errorColor'))).setDescription('no.')]});
			let result = Math.floor(Math.random() * args[0])+1;
			return await i.reply({embeds: [new EmbedBuilder().setColor(getValue(correctMutableName('primaryColor'))).setDescription(`You rolled a ${result}!`)]});
		}
		if (isNaN(args[0])) return await i.reply({embeds: [new EmbedBuilder().setColor(getValue(correctMutableName('errorColor'))).setDescription('You need to specify a number!')]});
		if(args[0]<1) return await i.reply({embeds: [new EmbedBuilder().setColor(getValue(correctMutableName('errorColor'))).setDescription('no.')]});
		await i.reply({embeds: [new EmbedBuilder().setColor(getValue(correctMutableName('primaryColor'))).setDescription(`You rolled a ${args[0]}!`)]});
	}
}