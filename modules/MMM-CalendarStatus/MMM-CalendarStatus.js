Module.register("MMM-CalendarStatus", {
    // Default module config.
    defaults: {
      text: '',
    },
  
    // Override dom generator.
    getDom: function () {
      const wrapper = document.createElement("div");
      wrapper.className = this.className;
      wrapper.innerHTML = this.content;
      return wrapper;
    },

    start () {
      this.content = this.config.text;
      this.className = 'g'
    },

    getStyles () {
      let css = ["MMM-CalendarStatus.css"]
      return css
    },

    notificationReceived: function(notification, payload, sender) {
      if (notification === 'CALENDAR_EVENTS') {
        const currentDate = new Date().getTime();
        payload.every(event => {
          this.content = "ROOM IS NOT BOOKED"
          this.className = 'g'
          if(currentDate >= event.startDate && currentDate <= event.endDate) {
            this.content = "ROOM IS BOOKED"
            this.className = 'r'
            return false;
          }
          return true;
        })
        this.updateDom()
      }
    },
  });
  