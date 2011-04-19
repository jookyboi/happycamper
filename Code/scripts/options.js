// just defaults
happycamper.settings = {
    account: {
        name: "ruijiang",
        apiToken: "1eb3d67b287357b919ccb88f83056a636a7a9e5e"
    },
    me: null,
    refreshInterval: 10,
    chat: {
        showTimestamps: true,
        showEnterLeave: true
    },
    notifications: {
        enabled: true,
        showFor: 30
    }
};

happycamper.options = function() {
    // ui elements
    var $accountName, $apiToken;
    var $showTimestamps, $showEnterLeave;
    var $notificationsEnabled, $notificationsShowFor;

    // public
    this.initialize = function() {
        initializeUI();
        initializeSettings();
        wireTabs();
        qtipWhatsThis();
    };

    // initialize
    function initializeUI() {
        $accountName = $("input[name='account-name']");
        $apiToken = $("input[name='api-token']");
        $showTimestamps = $("input[name='show-timestamps']");
        $showEnterLeave = $("input[name='show-enter-leave']");
        $notificationsEnabled = $("input[name='notifications-enabled']");
        $notificationsShowFor = $("select[name='notifications-show-for']");
    }

    function initializeSettings() {
        var settings = happycamper.util.loadJson("settings");

        if (settings === null) {
            // just save default
            happycamper.util.saveJson("settings", happycamper.settings);
        } else {
            happycamper.settings = settings;
        }

        loadSettingsForUI();
    }

    function loadSettingsForUI() {
        var settings = happycamper.settings;

        $accountName.val(settings.account.name);
        $apiToken.val(settings.account.apiToken);

        if (settings.chat.showTimestamps) {
            $showTimestamps.attr("checked", "checked");
        } else {
            $showTimestamps.removeAttr("checked");
        }

        if (settings.chat.showEnterLeave) {
            $showEnterLeave.attr("checked", "checked");
        } else {
            $showEnterLeave.removeAttr("checked");
        }

        if (settings.notifications.enabled) {
            $notificationsEnabled.attr("checked", "checked");
        } else {
            $notificationsEnabled.removeAttr("checked");
        }

        $notificationsShowFor.val(settings.notifications.showFor);
    }


    // tabs
    function wireTabs() {
        $("ul.menu li a").click(function() {
            $("ul.menu li").removeClass("selected");
            $(this).parent("li").addClass("selected");

            $("div.content").hide();
            $("div.content" + $(this).attr("href")).show();

            return false;
        });
    }

    // utilities
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