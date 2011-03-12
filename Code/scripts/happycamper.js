var happycamper = {};

happycamper.rooms = function() {
    var $roomsList = $("div.rooms div.list");
    var visibleRooms, activeRooms, inactiveRooms, lockedRooms;

    // do ajax
    function templateRooms() {

    }

    // utilities
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
    happycamper.rooms();
});


// mock data
var mockRoom1 = {
    "rooms": [{
        "name": "Room 2",
        "created_at": "2011/03/12 05:08:11 +0000",
        "updated_at": "2011/03/12 05:08:11 +0000",
        "topic": "",
        "id": 386538,
        "membership_limit": 4,
        "locked": false
    }]
};

var mockRooms = {
    "rooms": [{
        "name": "Room 1",
        "created_at": "2011/03/08 18:17:53 +0000",
        "updated_at": "2011/03/08 18:17:53 +0000",
        "topic": null,
        "id": 385256,
        "membership_limit": 4,
        "locked": false
    }, {
        "name": "Test Room",
        "created_at": "2011/03/08 18:18:10 +0000",
        "updated_at": "2011/03/10 14:09:28 +0000",
        "topic": "",
        "id": 385257,
        "membership_limit": 4,
        "locked": true
    }, {
        "name": "Room 2",
        "created_at": "2011/03/12 05:08:11 +0000",
        "updated_at": "2011/03/12 05:08:11 +0000",
        "topic": "",
        "id": 386538,
        "membership_limit": 4,
        "locked": false
    }, {
        "name": "Room 3",
        "created_at": "2011/03/12 05:08:15 +0000",
        "updated_at": "2011/03/12 05:08:15 +0000",
        "topic": "",
        "id": 386539,
        "membership_limit": 4,
        "locked": false
    }, {
        "name": "Room 4",
        "created_at": "2011/03/12 05:08:19 +0000",
        "updated_at": "2011/03/12 05:08:19 +0000",
        "topic": "",
        "id": 386540,
        "membership_limit": 4,
        "locked": false
    }, {
        "name": "Room 5",
        "created_at": "2011/03/12 05:08:23 +0000",
        "updated_at": "2011/03/12 05:08:23 +0000",
        "topic": "",
        "id": 386541,
        "membership_limit": 4,
        "locked": false
    }, {
        "name": "Room 6",
        "created_at": "2011/03/12 05:08:27 +0000",
        "updated_at": "2011/03/12 05:08:27 +0000",
        "topic": "",
        "id": 386542,
        "membership_limit": 4,
        "locked": false
    }, {
        "name": "Really long name for room 7",
        "created_at": "2011/03/12 05:08:35 +0000",
        "updated_at": "2011/03/12 05:08:35 +0000",
        "topic": "",
        "id": 386543,
        "membership_limit": 4,
        "locked": false
    }, {
        "name": "Room 8",
        "created_at": "2011/03/12 05:08:39 +0000",
        "updated_at": "2011/03/12 05:08:39 +0000",
        "topic": "",
        "id": 386544,
        "membership_limit": 4,
        "locked": false
    }]
};

var activeRoomIds = jLinq.from(mockRoom1.rooms)
    .select(function(room) {
        return room.id;
    });

console.log(activeRoomIds);

var inactiveRooms = jLinq.from(mockRooms.rooms)
    .where(function(room) {
        return ($.inArray(room.id, activeRoomIds) === -1 && !room.locked)
    }).select();

console.log(inactiveRooms)