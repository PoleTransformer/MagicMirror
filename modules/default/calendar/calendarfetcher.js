//Server
const https = require("node:https");
const ical = require("node-ical");
const Log = require("logger");
const NodeHelper = require("node_helper");
const msal = require('@azure/msal-node');
const CalendarFetcherUtils = require("./calendarfetcherutils");
const { log } = require("node:console");
const { kStringMaxLength } = require("node:buffer");
const { serialize } = require("node:v8");
require('dotenv').config();

var token = '';

async function getToken(clientid,authoriti,secret) {
	return new Promise(async (resolve,reject) => {
		const msalConfig = {
			auth: {
			clientId: clientid,
			authority: authoriti,
			clientSecret: secret,
			}
		};
		
		const tokenRequest = {
			scopes: ["https://graph.microsoft.com/.default"],
		};
		
		const cca = new msal.ConfidentialClientApplication(msalConfig);
		const authResponse = await cca.acquireTokenByClientCredential(tokenRequest);
		Log.debug("Access token: "+authResponse.accessToken);
		resolve(authResponse.accessToken);
	});
}

async function makeRequest(requestOptions,clientid,authority,secret) {
	return new Promise((resolve,reject) => {
		const attemptRequest = async () => {
			https
			.get(requestOptions, async resp => {
				Log.debug(resp.statusCode);
				if(resp.statusCode == 401) {
					token = await getToken(clientid,authority,secret);
					requestOptions.headers['Authorization'] = 'Bearer ' + token;
					attemptRequest();
					return;
				}
				let tmp = '';
				resp.on('data',chunk => {
					tmp += chunk;
				});
				resp.on('end', () => {
					resolve(tmp);
				});
			})
			.on('error', async err => {
				reject(err);
			})
		}
		attemptRequest();

	});
}

/**
 *
 * @param {string} url The url of the calendar to fetch
 * @param {number} reloadInterval Time in ms the calendar is fetched again
 * @param {string[]} excludedEvents An array of words / phrases from event titles that will be excluded from being shown.
 * @param {number} maximumEntries The maximum number of events fetched.
 * @param {number} maximumNumberOfDays The maximum number of days an event should be in the future.
 * @param {object} auth The object containing options for authentication against the calendar.
 * @param {boolean} includePastEvents If true events from the past maximumNumberOfDays will be fetched too
 * @param {boolean} selfSignedCert If true, the server certificate is not verified against the list of supplied CAs.
 * @class
 */
const CalendarFetcher = function (url, reloadInterval, excludedEvents, maximumEntries, maximumNumberOfDays, auth, includePastEvents, selfSignedCert, pathname) {
	let reloadTimer = null;
	let events = [];

	// Log.debug(auth.user);
	// Log.debug(auth.pass);
	// Log.debug(auth.authority);

	let fetchFailedCallback = function () {};
	let eventsReceivedCallback = function () {};

	/**
	 * Initiates calendar fetch.
	 */
	const fetchCalendar = async () => {
		clearTimeout(reloadTimer);
		reloadTimer = null;
		const nodeVersion = Number(process.version.match(/^v(\d+\.\d+)/)[1]);
		let httpsAgent = null;
		let headers = {
			"User-Agent": `Mozilla/5.0 (Node.js ${nodeVersion}) MagicMirror/${global.version}`,
			"Cache-Control": "max-age=0, no-cache, no-store, must-revalidate",
            "Pragma": "no-cache"
		};

		if (selfSignedCert) {
			httpsAgent = new https.Agent({
				rejectUnauthorized: false
			});
		}
		if (auth) {
			if (auth.method === "bearer") {
				headers.Authorization = `Bearer ${auth.pass}`;
			} else {
				headers.Authorization = `Basic ${Buffer.from(`${auth.user}:${auth.pass}`).toString("base64")}`;
			}
		}

		// if(token == '' || token == null)
		// 	token = await getToken(auth.user,auth.authority,auth.pass);

		const fromDate = new Date();
		const toDate = new Date();
		//fromDate.setDate(fromDate.getDate()-(fromDate.getDay()+5)%7);
		fromDate.setDate(fromDate.getDate()-7);
		toDate.setDate(toDate.getDate()+14);
		// Log.debug(fromDate.toISOString().split('T')[0]);
		// Log.debug(toDate.toISOString().split('T')[0]);
		//Log.debug(process.env.user);

		let room
		if(process.env.rooms) {
			const check = /^\?(\d{1,2})?$/ //whitelist input filter
			if(!check.test(pathname)) return

			const rooms = process.env.rooms.split(', ')
			if(rooms.length===0) return
			let index = Number(pathname.replace( /\D+/g, ""))
	
			if(isNaN(index)||index<0||index>=rooms.length) {
				index=0
			}
			room=rooms[index]
		}
		else {
			return
		}

		let requestOptions = {
			hostname: 'graph.microsoft.com',
			port: 443,
			path: '/v1.0/users/'+room+'/calendarView?startDateTime='+fromDate.toISOString().split('T')[0]+'T00:00:00-08:00&endDateTime='+toDate.toISOString().split('T')[0]+'T23:59:59-08:00&top=200&count=true',
			method: 'GET',
			headers: {
				'Authorization': 'Bearer ' + token,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Prefer': 'outlook.timezone="Pacific Standard Time"'
			},
			rejectUnauthorized: true,
			timeout: 5000,
		}

		const data = await makeRequest(requestOptions,process.env.user,process.env.authority,process.env.pass);

		fetch(url, { headers: headers, agent: httpsAgent })
			//.then(NodeHelper.checkFetchStatus)
			.then((response) => response.text())
			.then((responseData) => {
				try {
					//data = ical.parseICS(responseData);

					// Log.debug(`parsed data=${JSON.stringify(data, null, 2)}`);
					// JSON.parse(data, (key, value, context) => {
					// 	if(key==="name") {
					// 		Log.debug(value)
					// 	}
					// });
					events = CalendarFetcherUtils.filterEvents(data, {
						excludedEvents,
						includePastEvents,
						maximumEntries,
						maximumNumberOfDays
					});
				} catch (error) {
					fetchFailedCallback(this, error);
					scheduleTimer();
					return;
				}
				this.broadcastEvents();
				scheduleTimer();
			})
			.catch((error) => {
				fetchFailedCallback(this, error);
				scheduleTimer();
			});
	};

	/**
	 * Schedule the timer for the next update.
	 */
	const scheduleTimer = function () {
		if (process.env.JEST_WORKER_ID === undefined) {
			// only set timer when not running in jest
			clearTimeout(reloadTimer);
			reloadTimer = setTimeout(function () {
				fetchCalendar();
			}, reloadInterval);
		}
	};

	/* public methods */

	/**
	 * Initiate fetchCalendar();
	 */
	this.startFetch = function () {
		fetchCalendar();
	};

	/**
	 * Broadcast the existing events.
	 */
	this.broadcastEvents = function () {
		Log.info(`Calendar-Fetcher: Broadcasting ${events.length} events from ${url}.`);
		eventsReceivedCallback(this);
	};

	/**
	 * Sets the on success callback
	 * @param {Function} callback The on success callback.
	 */
	this.onReceive = function (callback) {
		eventsReceivedCallback = callback;
	};

	/**
	 * Sets the on error callback
	 * @param {Function} callback The on error callback.
	 */
	this.onError = function (callback) {
		fetchFailedCallback = callback;
	};

	/**
	 * Returns the url of this fetcher.
	 * @returns {string} The url of this fetcher.
	 */
	this.url = function () {
		return url;
	};

	this.clientid = function () {
		return clientid;
	}

	/**
	 * Returns current available events for this fetcher.
	 * @returns {object[]} The current available events for this fetcher.
	 */
	this.events = function () {
		//Log.debug(events);
		return events;
	};
};

module.exports = CalendarFetcher;
