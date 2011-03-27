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
        var settings = loadJson("settings");
        var state = loadJson("state");

        if (settings === null) {
            saveJson("settings", happycamper.settings);
        } else {
            happycamper.settings = settings;
        }

        if (state === null) {
            saveJson("state", happycamper.state);
        } else {
            happycamper.state = state;
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

            if (getRoomState(room.id) === undefined) {
                state.activeRoomStates.push({
                    id: room.id,
                    users: [],
                    messages: []
                });
            }

            getUsersAndMessagesForRoom(room);
        }
    }

    function saveStateOnLoadComplete(room, callRefresh) {
        var messages = getRoomState(room.id).messages;

        if (unnamedMessagesCount(messages) > 0) {
            // not all users have been set yet
            var checkUnnamedInterval = setInterval(function() {
                if (unnamedMessagesCount(messages) === 0) {
                    saveStateAndRefresh(room, callRefresh);
                    clearInterval(checkUnnamedInterval);
                }
            }, 1000);
        } else {
            saveStateAndRefresh(room, callRefresh);
        }
    }

    function unnamedMessagesCount(messages) {
        return jLinq.from(messages)
            .where(function(message) {
                return (message.user_id !== null && message.user === null)
            }).count();
    }

    function saveStateAndRefresh(room, callRefresh) {
        saveJson("state", happycamper.state);

        if (callRefresh) {
            callPopupFunction(function(popup) {
                popup.happycamper.refresh.room(room.id);
            });
        }
    }

    // messages and users
    function getUsersAndMessagesForRoom(room) {
        var roomState = getRoomState(room.id);

        executor.rooms.show(room.id, function(usersData) {
            roomState.users = usersData.room.users;

            // must have users before messages
            getMessagesForRoom(room);
        });
    }

    function getMessagesForRoom(room) {
        var roomState = getRoomState(room.id);
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
            messages = getMessagesWithTimestamp(messages);

            if (fullRefresh) {
                roomState.messages = messages;
                saveStateOnLoadComplete(room, false);
            } else {
                roomState.messages = roomState.messages.concat(messages);

                if (messages.length > 0) {
                    showMessageNotifications(messages);
                    saveStateOnLoadComplete(room, true);
                }
            }
        });
    }

    function getMessagesWithUser(messages, roomState) {
        return jLinq.from(messages)
            .select(function(message) {
                message.user = getUserForMessage(message, roomState);
                return message;
            });
    }

    function getMessagesWithTimestamp(messages) {
        return jLinq.from(messages)
            .select(function(message) {
                message.timestamp = dateFormat(message.created_at, "shortTime");
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
        return null;
    }

    function getUserFromAllUsers(userId) {
        jLinq.from(happycamper.state.allUsers)
            .where(function(user) {
                return user.id === userId;
            }).first();
    }

    function setCampfireUserForMessage(message) {
        executor.users.show(message.user_id, function(userData) {
            message.user = userData.user;
        });
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
        localStorage.removeItem(key);
        console.log(JSON.stringify(json));
        localStorage[key] = JSON.stringify(json);
    }

    function loadJson(key) {
        var value = localStorage[key];
        if (value === undefined || value === null)
            return null;

        return JSON.parse(value);
    }

    function getRoomState(roomId) {
        return jLinq.from(happycamper.state.activeRoomStates)
            .where(function(roomState) {
                return roomState.id === roomId;
            }).first();
    }

    function getUser(userId) {
        return jLinq.from(happycamper.state.allUsers)
            .where(function(user) {
                return user.id === userId;
            }).first();
    }

    function setUser(user) {
        if (getUser(user.id) === undefined) {
            happycamper.state.allUsers.push(user);
        }
    }
};

$(function() {
    var background = new happycamper.background();
    background.initialize();
});