const mysql = require('mysql2/promise');

const pool = mysql.createPool({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASS,
	database: process.env.DB_NAME,
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0,
});

// initial database setup, run on startup to ensure tables columns exist
const schema = {
	tables: {
		logs: {
			columns: {
				id: {
					parameters: ['INT AUTO_INCREMENT']
				},
				user: {
					parameters: ['VARCHAR(255) NOT NULL']
				},
				moderator: {
					parameters: ['VARCHAR(255) NOT NULL']
				},
				type: {
					parameters: ['VARCHAR(255) NOT NULL']
				},
				reason: {
					parameters: ['TEXT NOT NULL']
				},
				timestamp: {
					parameters: ['BIGINT']
				},
			},
			primaryKey: 'id'
		}
	}
}

async function fetchCurrentSchema(connection) {
	const [tables] = await connection.query(`SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = DATABASE()`);
	const schema = {};
	for (const table of tables) {
		const [columns] = await connection.query(`SELECT COLUMN_NAME, COLUMN_TYPE from information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?`, [table.TABLE_NAME]);
		schema[table.TABLE_NAME] = columns.reduce((acc, col)=>{
			acc[col.COLUMN_NAME] = {
				parameters: [col.COLUMN_TYPE]
			};
			return acc;
		}, {});
	}
	return schema;
}

async function updateSchema(connection, schema) {

	for(const tableName in schema.tables){
		//fine to not check if it exists in current schema because we create it if it doesnt exist anyway
		const tableDef = schema.tables[tableName];
		const columnsDef = Object.keys(tableDef.columns).map(col=>{
			return `${col} ${tableDef.columns[col].parameters.join(' ')}`;
		}).join(', ');

		let primaryKeyDef = tableDef.primaryKey ? `, PRIMARY KEY (${tableDef.primaryKey})` : '';

		await connection.query(`CREATE TABLE IF NOT EXISTS ${tableName} (${columnsDef}${primaryKeyDef})`);
	}

	const currentSchema = await fetchCurrentSchema(connection);

	for (const tableName in schema.tables) {
		const tableSchema = schema.tables[tableName];
		const currentTable = currentSchema[tableName] || {};

		for (const columnName in tableSchema.columns) {
			const columnSchema = tableSchema.columns[columnName];
			if(!currentTable[columnName])
				await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnSchema.parameters.join(' ')}`);
			if(currentTable[columnName].parameters.join() !== columnSchema.parameters.join())
				await connection.query(`ALTER TABLE ${tableName} MODIFY COLUMN ${columnName} ${columnSchema.parameters.join(' ')}`);
		}
		
		if(false){
			for(const columnName in currentTable){
				if(!tableSchema.columns[columnName]){
					await connection.query(`ALTER TABLE ${tableName} DROP COLUMN ${columnName}`);
				}
			}
		}
	}

	if(false){
		for(const tableName in currentSchema){
			if(!schema.tables[tableName]){
				await connection.query(`DROP TABLE ${tableName}`);
			}
		}
	}
}

async function migrateDatabase(){
	const connection = await pool.getConnection();
	await updateSchema(connection, schema);
	await connection.release()
}

async function closePool(){
	try{
		await pool.end();
		console.log('[INFO]: Database connection closed.');
	} catch(e){
		console.error('[ERROR]: Failed to close connection:', e);
	}
}


async function addLog(user, moderator, type, reason, timestamp){
	const connection = await pool.getConnection();
	await connection.query('INSERT INTO logs(user, moderator, type, reason, timestamp) VALUES(?, ?, ?, ?, ?)', [user, moderator, type, reason, timestamp]);
	await connection.release();
}

async function getLogById(id){
	const connection = await pool.getConnection();
	const [log] = await connection.query('SELECT * FROM logs WHERE id = ?', [id]);
	await connection.release();
	return log;
}

async function getAllLogs(){
	const connection = await pool.getConnection();
	const [logs] = await connection.query('SELECT * FROM logs');
	await connection.release();
	return logs;
}

async function getAllLogsByUser(user){
	const connection = await pool.getConnection();
	const [logs] = await connection.query('SELECT * FROM logs WHERE user = ?', [user]);
	await connection.release();
	return logs;
}

async function getAllLogsByUserAndType(user, type){
	const connection = await pool.getConnection();
	const [logs] = await connection.query('SELECT * FROM logs WHERE user = ? AND type = ?', [user, type]);
	await connection.release();
	return logs;
}

async function getLogCountByUser(user){
	const connection = await pool.getConnection();
	const [count] = await connection.query('SELECT COUNT(*) FROM logs WHERE user = ?', [user]);
	await connection.release();
	return count;
}

async function wipeAllLogs(){
	const connection = await pool.getConnection();
	await connection.query('DELETE FROM logs');
	await connection.release();
}

module.exports = {migrateDatabase, closePool, addLog, getLogById, getAllLogs, getAllLogsByUser, getLogCountByUser, wipeAllLogs, getAllLogsByUserAndType};