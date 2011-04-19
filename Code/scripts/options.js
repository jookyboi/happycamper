// just defaults
happycamper.settings = {
    account: {
        name: "",
        apiToken: ""
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
    var $error;

    // public
    this.initialize = function() {
        initializeUI();
        initializeSettings();
        wireTabs();
        qtipWhatsThis();

        wireSave();
    };

    // initialize
    function initializeUI() {
        $accountName = $("input[name='account-name']");
        $apiToken = $("input[name='api-token']");
        $showTimestamps = $("input[name='show-timestamps']");
        $showEnterLeave = $("input[name='show-enter-leave']");
        $notificationsEnabled = $("input[name='notifications-enabled']");
        $notificationsShowFor = $("select[name='notifications-show-for']");

        $error = $("div.error");
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

    // save settings
    function wireSave() {
        $("button.save-options").click(function() {
            $(this).html('<img src="images/save.gif" />');
            saveSettings();
            $error.hide();

            return false;
        });
    }

    function saveSettings() {
        var settings = happycamper.settings;

        // check whether account info updated
        var accountName = $.trim($accountName.val());
        var apiToken = $.trim($apiToken.val());
        var verifyingAccount = false;

        if (settings.account.name !== accountName ||
            settings.account.apiToken !== apiToken) {
            updateAccount(accountName, apiToken);
            verifyingAccount = true;
        }

        // chat
        settings.chat.showTimestamps = $showTimestamps.is(":checked");
        settings.chat.showEnterLeave = $showEnterLeave.is(":checked");

        // notifications
        settings.notifications.enabled = $notificationsEnabled.is(":checked");
        settings.notifications.showFor = $notificationsShowFor.val();

        happycamper.util.saveJson("settings", settings);

        if (!verifyingAccount) {
            resetSaveOptionsButton();
        }
    }

    function updateAccount(accountName, apiToken) {
        var executor = new Camper.Executor({
            url: accountName + ".campfirenow.com",
            apikey: apiToken
        });

        executor.users.showAuthenticatedUser(function(userData, status) {
            if (status === "error") {
                // user is not authorized by campfire
                $("button.save-options").html("Save");
                $error.show();

                return;
            }

            var settings = happycamper.settings;

            settings.me = userData.user;
            settings.account.name = accountName;
            settings.account.apiToken = apiToken;

            happycamper.util.saveJson("settings", happycamper.settings);

            // force state refresh
            happycamper.util.saveJson("state", null);
            refreshBackground();

            resetSaveOptionsButton();
        });
    }

    // utilities
    function resetSaveOptionsButton() {
        // make user think something more substantial is happening
        setTimeout(function() {
            $("button.save-options").html("Save");
        }, 2000);
    }

    function refreshBackground() {
        chrome.extension.getBackgroundPage().happycamper.background.refreshPage();
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