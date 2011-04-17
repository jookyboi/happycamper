// just defaults
happycamper.settings = {
    me: null,
    refreshInterval: 10,
    chat: {
        showTimestamps: true,
        showEnterLeave: true
    },
    notifications: {
        enabled: true,
        showFor: 10
    }
};

happycamper.options = function() {
    // public
    this.initialize = function() {
        initializeSettings();
        wireTabs();
        qtipWhatsThis();
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
        $("ul.menu li a").click(function() {
            $("ul.menu li").removeClass("selected");
            $(this).parent("li").addClass("selected");

            $("div.content").hide();
            $("div.content" + $(this).attr("href")).show();

            return false;
        });
    }

    function qtipWhatsThis() {
        createTooltip($("div.what a.account"), $("#what-account-name-template").tmpl());
        createTooltip($("div.what a.token"), $("#what-api-token-template").tmpl())
    }

    function createTooltip(element, content) {
        // disable click navigation as well
        element.click(function() { return false; }).qtip({
            content: {
                text: content
            },
            position: {
                my: "bottom right",
                at: "top right"
            },
            style: {
                classes: "ui-tooltip-light ui-tooltip-shadow",
                tip: {
                    corner: true,
                    width: 10,
                    height: 10
                }
            }
        });
    }
};

$(function() {
    happycamper.options = new happycamper.options();
    happycamper.options.initialize();
});