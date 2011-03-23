var happycamper = {};

happycamper.state = {
    selectedRoomId: -1
};

happycamper.rooms = function(visibleRooms, activeRooms) {
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
    var executor = new Camper.Executor({
        url: "ruijiang.campfirenow.com",
        apikey: "1eb3d67b287357b919ccb88f83056a636a7a9e5e"
    });

    executor.rooms.listAll(function(roomsData) {
        var visibleRooms = jLinq.from(roomsData.rooms)
            .select(getFormattedRoom);

        // execute in order since we need both visible and active
        executor.rooms.presentRooms(function(roomsData) {
            var activeRooms = jLinq.from(roomsData.rooms)
                .select(function(room) {
                    return getFormattedRoom(room, { state: "active" });
                });
            
            happycamper.rooms(visibleRooms, activeRooms);
        });
    });

    function getFormattedRoom(room, properties) {
        var roomJson = {
            createdAt: Date.parse(room.created_at),
            id: room.id,
            locked: room.locked,
            name: room.name,
            topic: room.topic,
            updatedAt: Date.parse(room.updated_at)
        };

        return $.extend(roomJson, properties);
    }
});
