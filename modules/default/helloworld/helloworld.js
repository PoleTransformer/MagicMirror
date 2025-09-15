Module.register("helloworld", {
	// Default module config.
	defaults: {
		text: ""
	},

	getTemplate () {
		return "helloworld.njk";
	},

	getTemplateData () {
		return this.config;
	}
});
