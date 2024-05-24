import { readFile, writeFile, open } from 'node:fs/promises';
import * as commonmark from 'commonmark';

// Function to find an object based on multiple properties
export function findObjectByProperties(array, properties) {
  return array.find(obj => {
    // Check if all specified properties match
    return Object.keys(properties).every(key => compareStr(obj[key], properties[key]));
  });
}
export function filterObjectByProperties(array, properties) {
  return array.filter(obj => {
    // Check if all specified properties match
    return Object.keys(properties).every(key => compareStr(obj[key], properties[key]));
  });
}

export function idFrag(uri) {
	return uri.substring(uri.indexOf("#") + 1)
}

export function compareStr(str1, str2) {
	if (str1.trim().replace(/\s+/g, ' ').toLowerCase() == str2.trim().replace(/\s+/g, ' ').toLowerCase()) return true;
	else return false;
}

export function normalizeStr(str) {
	return str.trim().replace(/\s+/g, ' ');
}

// from https://www.freecodecamp.org/news/check-if-a-javascript-string-is-a-url/
export function isValidUrl(urlString) {
  	var urlPattern = new RegExp('^(https?:\\/\\/)?'+ // validate protocol
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // validate domain name
    '((\\d{1,3}\\.){3}\\d{1,3}))'+ // validate OR ip (v4) address
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // validate port and path
    '(\\?[;&a-z\\d%_.~+=-]*)?'+ // validate query string
    '(\\#[-a-z\\d_]*)?$','i'); // validate fragment locator
  return !!urlPattern.test(urlString);
}

export function getOneProp(arr, prop) {
	var val = new Array();
	arr.forEach((item) => val.push(item[prop]));
	return val;
}

export async function getFileData(path) {
	try {
	  const contents = await readFile(path, { encoding: 'utf8' });
	  return (contents);
	} catch (err) {
	  //console.error(err.message);
	  return null;
	}
}

export function escSparql(str) {
	let val = str.replaceAll(/[\n\r]/g, "\\n");
	val = val.replaceAll("\"", "\\\"");
	return val;
}

export function mdToHtml(str) {
	let reader = new commonmark.Parser();
	let writer = new commonmark.HtmlRenderer();
	let parsed = reader.parse(str);
	let result = writer.render(parsed);
	return result;
}