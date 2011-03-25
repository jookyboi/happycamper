var happycamper = {};

happycamper.settings = {
    refreshInterval: 10
};

happycamper.state = {
    visibleRooms: [],
    activeRooms: []
};

happycamper.background = function() {
    var executor = new Camper.Executor({
        url: "ruijiang.campfirenow.com",
        apikey: "1eb3d67b287357b919ccb88f83056a636a7a9e5e"
    });

    this.initialize = function() {
        initSettings();

        // call once manually
        refreshLoop();

        setInterval(function() {
            refreshLoop();
        }, (happycamper.settings.refreshInterval * 1000));
    };

    function setVisibleActiveRooms(newState) {
        executor.rooms.listAll(function(roomsData) {
            var visibleRooms = jLinq.from(roomsData.rooms)
                .select(getFormattedRoom);

            // execute in order since we need both visible and active
            executor.rooms.presentRooms(function(roomsData) {
                var activeRooms = jLinq.from(roomsData.rooms)
                    .select(function(room) {
                        return getFormattedRoom(room, { state: "active" });
                    });

                newState.visibleRooms = visibleRooms;
                newState.activeRooms = activeRooms;

                handleStateChange(newState);
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
    }

    function initSettings() {
        if (localStorage["settings"] === undefined) {
            saveJson("settings", happycamper.settings);
        } else {
            happycamper.settings = loadJson("settings");
        }
    }

    function refreshLoop() {
        // deep copy
        var newState = $.extend(true, {}, happycamper.state);
        setVisibleActiveRooms(newState);
    }

    function handleStateChange(newState) {
        // must check for string equality here
        if (JSON.stringify(newState) === JSON.stringify(happycamper.state))
            return;
        
        happycamper.state = newState;
        saveJson("state", happycamper.state);
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
};

$(function() {
    var background = new happycamper.background();
    background.initialize();
});