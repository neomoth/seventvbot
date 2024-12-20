const {getValue, correctMutableName} = require('../cfgedit');
const {EmbedBuilder} = require("discord.js");
module.exports = {
	data:{
		name:'coinflip',
		description:'Flip a coin',
		usage:`]roll <number>`,
		aliases:['flip','cf','coin'],
		restrict:true
	},async execute(i, args){
		await i.reply({embeds: [new EmbedBuilder().setColor(getValue(correctMutableName('primaryColor'))).setDescription(`Landed on ${Math.floor(Math.random()*2) ? 'Heads' : 'Tails'}!`)]})
	}
}