var happycamper = {};

happycamper.settings = {};
happycamper.state = {};

happycamper.rooms = function() {
    var visibleRooms = happycamper.state.visibleRooms;
    var activeRooms = happycamper.state.activeRooms;

    var $rooms = $("div.rooms");
    var $roomsList = $("div.rooms div.list");
    var $scrollbox = $roomsList.find("div.scrollbox");
    var ROOM_HEIGHT = 29;

    // on initialize
    templateRooms();
    joinDefaultRoom();
    wireUpDownButtons();

    // templating
    function templateRooms() {
        $scrollbox.html("");

        templateActiveRooms();
        templateLockedRooms();
        templateInactiveRooms();
    }

    function templateActiveRooms() {
        $("#room-template").tmpl(activeRooms).appendTo($scrollbox);
    }

    function templateLockedRooms() {
        $("#room-template").tmpl(getLockedRooms()).appendTo($scrollbox);
    }

    function templateInactiveRooms() {
        $("#room-template").tmpl(getInactiveRooms()).appendTo($scrollbox);
    }

    function joinDefaultRoom() {
        
    }

    // up down buttons
    function wireUpDownButtons() {
        if (!buttonsNecessary()) {
            return;
        }

        var scrollUp = $rooms.find("div.scroll-up");
        var scrollDown = $rooms.find("div.scroll-down");

        activateUpDownButtons();

        // prevent double binding
        scrollUp.unbind("click");
        scrollDown.unbind("click");

        scrollUp.click(function() {
            if (!$(this).hasClass("active"))
                return;

            $scrollbox.animate({
                marginTop: '+=' + (2* ROOM_HEIGHT)
            }, 300);
        });

        scrollDown.click(function() {
            if (!$(this).hasClass("active"))
                return;

            $scrollbox.animate({
                marginTop: '-=' + (2 * ROOM_HEIGHT)
            }, 300);
        });
    }

    function activateUpDownButtons() {
        var scrollUp = $rooms.find("div.scroll-up");
        var scrollDown = $rooms.find("div.scroll-down");

        if (topScrollable()) {
            scrollUp.addClass("active");
        }

        if (bottomScrollable()) {
            scrollDown.addClass("active");
        }
    }

    function topScrollable() {
        return $scrollbox.css("marginTop").replace("px") === 0;
    }

    function bottomScrollable() {
        return true;
    }

    // utilities
    function buttonsNecessary() {
        return $scrollbox.height() > $roomsList.height();
    }

    function getInactiveRooms() {
       var activeRoomIds = jLinq.from(activeRooms)
            .select(function(room) {
                return room.id;
            });

        return jLinq.from(visibleRooms)
            .where(function(room) {
                return ($.inArray(room.id, activeRoomIds) === -1 && !room.locked)
            }).select(function(room) {
                room.state = "inactive";
                return room;
            });
    }

    function getLockedRooms() {
        return jLinq.from(visibleRooms)
            .where(function(room) {
                return room.locked
            }).select(function(room) {
                room.state = "locked";
                return room;
            });
    }
};

$(function() {
    // use whatever is in the latest localStorage
    refreshLoop();
    happycamper.rooms();

    setInterval(function() {
        refreshLoop();
    }, (happycamper.settings.refreshInterval * 1000));

    function refreshLoop() {
        var oldState = $.extend(true, {}, happycamper.state);

        happycamper.state = loadJson("state");
        happycamper.settings = loadJson("settings");

        if (JSON.stringify(oldState) !== JSON.stringify(happycamper.state))
            handleChange(oldState);
    }

    function handleChange(oldState) {
        var state = happycamper.state;

        if (JSON.stringify(state.visibleRooms) !== JSON.stringify(oldState.visibility) ||
            JSON.stringify(state.activeRooms) !== JSON.stringify(oldState.activeRooms)) {
            happycamper.rooms();
        }
    }

    // utilities
    function saveJson(key, json) {
        localStorage[key] = JSON.stringify(json);
    }

    function loadJson(key) {
        var value = localStorage[key];
        if (value === undefined || value === null)
            return null;

        return JSON.parse(value);
    }
});
