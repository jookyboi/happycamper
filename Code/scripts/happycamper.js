var happycamper = {};

happycamper.state = {
    selectedRoomId: -1
};

happycamper.rooms = function(rooms) {
    var $rooms = $("div.rooms");
    var $roomsList = $("div.rooms div.list");
    var $scrollbox = $roomsList.find("div.scrollbox");
    var visibleRooms, activeRooms, inactiveRooms, lockedRooms;

    // on initialize
    templateRooms();
    joinDefaultRoom();
    wireUpDownButtons();

    function templateRooms() {

    }

    function joinDefaultRoom() {
        
    }

    function wireUpDownButtons() {
        if (buttonsNecessary()) {
            $rooms.find("div.scroll-up").css("opacity", 1.0);
            $rooms.find("div.scroll-down").css("opacity", 1.0);
        }
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
            }).select();
    }

    function getLockedRooms() {
        return jLinq.from(visibleRooms)
            .where(function(room) {
                return room.locked
            }).select();
    }
};

$(function() {
    var executor = new Camper.Executor({
        url: "ruijiang.campfirenow.com",
        apikey: "1eb3d67b287357b919ccb88f83056a636a7a9e5e"
    });

    executor.rooms.listAll(function(roomsData) {
        var allRooms = jLinq.from(roomsData.rooms)
            .select(function(room) {
                return {
                    createdAt: Date.parse(room.created_at),
                    id: room.id,
                    locked: room.locked,
                    name: room.name,
                    topic: room.topic,
                    updatedAt: Date.parse(room.updated_at)
                };
            });

            happycamper.rooms(allRooms);
        });
});
