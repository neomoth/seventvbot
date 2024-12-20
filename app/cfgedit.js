const fs = require('node:fs');
const path = require('node:path');

const config = path.join(__dirname, 'config/config.json');
// const defaultConfig = path(__dirname, 'config/defaultConfig.json');

function getMutable(key){
	let cfg = JSON.parse(fs.readFileSync(config));
	for(const k of Object.keys(cfg.mutable)){
		if(k.toLowerCase()===key.toLowerCase()) return cfg.mutable[k];
	}
	return null;
}

function mutableExists(key){
	return getMutable(key)!==null;
}

function correctMutableName(key){
	let cfg = JSON.parse(fs.readFileSync(config));
	for(const k of Object.keys(cfg.mutable)){
		if(k.toLowerCase()===key.toLowerCase()) return k;
	}
	throw new Error("this should never happen.");
}
function cfgEdit(key, value){
	let cfg = JSON.parse(fs.readFileSync(config));
	if(!cfg.mutable.hasOwnProperty(key)) return false;
	cfg.mutable[key] = value;
	fs.writeFileSync(config, JSON.stringify(cfg, null, 4));
	return true;
}
function getMutables(){
	let cfg = JSON.parse(fs.readFileSync(config));
	return cfg.mutable;
}
function getKeyType(key){
	let cfg = JSON.parse(fs.readFileSync(config));
	return cfg.types[key];
}
function getValue(key){
	return getMutable(key);
}
function setDefault(key){
	let cfg = JSON.parse(fs.readFileSync(config));
	let type = getKeyType(key);
	let defaultValue = cfg.defaults[key];
	if (defaultValue===undefined){
		if (type.startsWith("ID")) cfgEdit(key, "");
		else if (type.startsWith("Array")) cfgEdit(key, []);
		else if (type==="Boolean") cfgEdit(key, false);
		else if (type==="String") cfgEdit(key, "");
		else if (type==="Number") cfgEdit(key, 0);
		else if (type==="Object") cfgEdit(key, {});
		return;
	}
	cfgEdit(key, defaultValue);
}
function resetAll(){
	let cfg = JSON.parse(fs.readFileSync(config));
	
	cfg.mutable = cfg.defaults;

	fs.writeFileSync(config, JSON.stringify(cfg, null, 4));
	// for(const key of Object.keys(cfg.mutable)){
	// 	cfgEdit(key, cfg.defaults[key]);
	// }
}

function getDescription(key){
	let cfg = JSON.parse(fs.readFileSync(config));
	return cfg.descriptions[key];
}

function getDecoratedValue(key){
	let value = getValue(key);
	if(value===undefined) return "undefined";
	else if(value===null) return "null";
	else if(value==="") return "[empty string]";
	else {
		if(Array.isArray(value)&&value.length===0) return "[empty array]";
		else if(Array.isArray(value)){
			return `[${value.map(v=>`${v}`).join(', ')}]`;
		}
		else if(!Array.isArray(value) && typeof value === 'object' && value !== null && Object.keys(value).length === 0) return "{empty object}";
	}
	return value.toString();
}

module.exports = {cfgEdit, getMutables, getKeyType, getValue, mutableExists, correctMutableName, setDefault, resetAll, getDescription, getDecoratedValue};