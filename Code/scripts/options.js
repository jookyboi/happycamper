var happycamper = {};

// just defaults
happycamper.settings = {
    me: null,
    refreshInterval: 10,
    notifications: {
        enabled: true,
        showFor: 10
    },
    chat: {
        showTimestamps: true,
        showEnterLeave: true
    }
};

happycamper.options = function() {
    // public
    this.initialize = function() {
        initializeSettings();
        wireTabs();
    };

    // private
    function initializeSettings() {
        var settings = happycamper.util.loadJson("settings");

        if (settings === null) {
            // just save default
            happycamper.util.saveJson("settings", happycamper.settings);
        } else {
            happycamper.settings = settings;
        }    
    }

    function wireTabs() {
        
    }
};

$(function() {
    happycamper.options.initialize();
});