/* global io */

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
