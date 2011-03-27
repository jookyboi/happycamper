var happycamper = {};

happycamper.settings = {
    refreshInterval: 10
};

happycamper.state = {
    visibleRooms: [],
    activeRooms: [],
    openRoomId: -1,
    activeRoomStates: [],
    allUsers: []
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
        setActiveRoomStates();
    }

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

                handleRoomsListChange(newState);
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

    function handleRoomsListChange(newState) {
        // must check for string equality here
        if (JSON.stringify(newState.visibleRooms) === JSON.stringify(happycamper.state.visibleRooms) &&
            JSON.stringify(newState.activeRooms) === JSON.stringify(happycamper.state.activeRooms)) {
            return;
        }

        happycamper.state = newState;
        saveJson("state", happycamper.state);

        callPopupFunction(function(popup) {
            popup.happycamper.refresh.roomsList();
        });
    }

    function setActiveRoomStates() {
        var state = happycamper.state;

        if (state.activeRooms === undefined) {
            // hasn't been populated yet
            return;
        }

        for (var index = 0, length = state.activeRooms.length; index < length; index++) {
            var room = state.activeRooms[index];
            var roomId = getRoomId(room); // otherwise, we will have a really long array

            if (state.activeRoomStates[roomId] === undefined) {
                state.activeRoomStates[roomId] = {
                    users: [],
                    messages: []
                };
            }

            getUsersForRoom(room);
            getMessagesForRoom(room);
        }

        console.log(happycamper.state);
        saveJson("state", happycamper.state);
    }

    // messages and users
    function getUsersForRoom(room) {
        var roomState = happycamper.state.activeRoomStates[getRoomId(room)];

        executor.rooms.show(room.id, function(usersData) {
            roomState.users = usersData.room.users;
        });
    }

    function getMessagesForRoom(room) {
        var roomState = happycamper.state.activeRoomStates[getRoomId(room)];
        var arguments = {};
        var fullRefresh = true;

        if (roomState.messages.length > 0) {
            // don't need full refresh
            fullRefresh = false;

            var lastMessage = jLinq.from(roomState.messages)
                .sort("id")
                .last();

            arguments.since_message_id = lastMessage.id;
        }

        executor.rooms.recentMessages(room.id, arguments, function(messagesData) {
            var messages = getMessagesWithUser(messagesData.messages, roomState);

            if (fullRefresh) {
                roomState.messages = messages;
            } else {
                roomState.messages = roomState.messages.concat(messages);
                showMessageNotifications(messages);

                callPopupFunction(function(popup) {
                    popup.refresh.room(room.id);
                });
            }

            //console.log(roomState.messages);
        });
    }

    function getMessagesWithUser(messages, roomState) {
        return jLinq.from(messages)
            .select(function(message) {
                message.user = getUserForMessage(message, roomState);
                return message;
            });
    }

    function getUserForMessage(message, roomState) {
        var userId = message.user_id;

        if (userId === null)
            return null;

        var user = jLinq.from(roomState.users)
            .where(function(user) {
                return user.id === userId;
            }).first();

        if (user !== undefined) {
            setUser(user);
            return user;
        }
        
        // user not present, find within allUsers
        user = getUserFromAllUsers(userId);

        if (user !== undefined)
            return user;

        // get from campfire
        setCampfireUserForMessage(message);
    }

    function getUserFromAllUsers(userId) {
        jLinq.from(happycamper.state.allUsers)
            .where(function(user) {
                return user.id === userId;
            }).first();
    }

    function setUser(user) {
        var allUsers = happycamper.state.allUsers;
        var userIdStr = getUserId(user);

        if (allUsers[userIdStr] === undefined) {
            allUsers[userIdStr] = user;
        }
    }

    function setCampfireUserForMessage(message) {
        
    }

    // notifications
    function showMessageNotifications(newMessages) {
        
    }

    // utilities
    function callPopupFunction(callback) {
        var popup = chrome.extension.getViews({type: "popup"});

        if (popup.length > 0) {
            callback(popup[0]);
        }
    }

    function saveJson(key, json) {
        localStorage[key] = JSON.stringify(json);
    }

    function loadJson(key) {
        var value = localStorage[key];
        if (value === undefined || value === null)
            return null;

        return JSON.parse(value);
    }

    function getRoomId(room) {
        return "room_" + room.id;
    }

    function getUserId(user) {
        return "user_" + user.id;
    }
};

$(function() {
    var background = new happycamper.background();
    background.initialize();
});