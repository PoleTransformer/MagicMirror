/* global io */

function replaceDocumentWithDisconnectedHtml() {
	document.documentElement.innerHTML = `
	  <head>
		<meta charset="utf-8"><title>Disconnected</title>
		<style>body{margin:0;display:flex;inset:0;align-items:center;justify-content:center;height:100vh;font-family:system-ui;background:#111;color:#fff}</style>
	  </head>
	  <body>
		<div>
		  <h1>Disconnected</h1>
		  <p>Lost connection to the server. Please contact IT.</p>
		</div>
	  </body>`;
}

const MMSocket = function (moduleName) {
	if (typeof moduleName !== "string") {
		throw new Error("Please set the module name for the MMSocket.");
	}

	this.moduleName = moduleName;

	// Private Methods
	let base = "/";
	let disconnected = false;
	if (typeof config !== "undefined" && typeof config.basePath !== "undefined") {
		base = config.basePath;
	}
	this.socket = io(`/${this.moduleName}`, {
		path: `${base}socket.io`
	});

	let notificationCallback = function () {};

	const onevent = this.socket.onevent;
	this.socket.onevent = (packet) => {
		const args = packet.data || [];
		onevent.call(this.socket, packet); // original call
		packet.data = ["*"].concat(args);
		onevent.call(this.socket, packet); // additional call to catch-all
	};

	this.socket.on("disconnect", (notification, payload) => {
		console.log("DISCONNECTED");
		replaceDocumentWithDisconnectedHtml();
		disconnected = true;
	});

	this.socket.on("connect", (notification, payload) => {
		if(disconnected) {
			disconnected = false;
			console.log("RECONNECTED");
			location.reload(true);
		}
	});

	this.socket.on("*", (notification, payload) => {
		console.log("NOTIFICATION: "+notification);
		if (notification !== "*") {
			notificationCallback(notification, payload);
		}
	});

	// Public Methods
	this.setNotificationCallback = (callback) => {
		notificationCallback = callback;
	};

	this.sendNotification = (notification, payload = {}) => {
		this.socket.emit(notification, payload);
	};
};
