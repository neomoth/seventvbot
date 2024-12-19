let startTime, endTime;
function start(){
	startTime = new Date();
}
function end(){
	endTime = new Date();
	let timeDiff = endTime - startTime; // ms
	timeDiff/=1000;
	return timeDiff;
}

module.exports ={
	data:{
		name:'ping',
		description:'Test bot response time',
		usage:`]ping`,
		aliases:['p'],
		restrict:true
	},
	async execute(i,args){
		start();
		await i.reply('Pong!').then(s=>{
			s.edit(`Pong! \`Took ${end()}ms\``);
		});
	}
}