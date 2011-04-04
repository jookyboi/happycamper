var happycamper = {};

happycamper.settings = {
    refreshInterval: 10,
    notifications: {
        enabled: true,
        showFor: -1
    },
    chat: {
        showTimestamps: true,
        showEnterLeave: true
    }
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

    /*
    var executor = new Camper.Executor({
       url: "zssd.campfirenow.com",
       apikey: "ae0639b97a54548f298845b9a9075b87892259a4"
    });
    */

    // used for removing spinner once room has loaded
    var roomCallback = null;

    // public
    this.initialize = function() {
        initSettings();

        // call once manually
        refreshLoop();

        setInterval(function() {
            refreshLoop();
        }, (happycamper.settings.refreshInterval * 1000));
    };

    this.refreshRoom = function(roomId) {
        var room = getActiveRoom(roomId);
        getUsersAndMessagesForRoom(room);
    };

    this.refreshWithCallback = function(roomId, callback) {
        refreshLoop();
        roomCallback = callback;
    };

    this.getUserForMessage = getUserForMessage;

    this.executor = function() {
        return executor;  
    };

    // initialize
    function initSettings() {
        var settings = happycamper.util.loadJson("settings");
        var state = happycamper.util.loadJson("state");

        if (settings === null) {
            happycamper.util.saveJson("settings", happycamper.settings);
        } else {
            happycamper.settings = settings;
        }

        if (state === null) {
            saveState();
        } else {
            happycamper.state = state;
        }
    }

    function refreshLoop() {
        loadState();

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

        happycamper.state.visibleRooms = newState.visibleRooms;
        happycamper.state.activeRooms = newState.activeRooms;
        saveState();

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

            if (getActiveRoomState(room.id) === undefined) {
                happycamper.state.activeRoomStates.push({
                    id: room.id,
                    users: [],
                    messages: [],
                    recentUploads: []
                });

                saveState();
            }
            
            getUsersAndMessagesForRoom(room);
            getRecentUploadsForRoom(room);
        }
    }

    function saveStateOnLoadComplete(room, callRefresh) {
        var roomState = getActiveRoomState(room.id);
        var messages = roomState.messages;
        var uploads = roomState.recentUploads;

        if (missingInfo(messages, uploads)) {
            // not all users and files have been set
            var checkUnnamedInterval = setInterval(function() {
                if (!missingInfo(messages, uploads)) {
                    saveStateAndRefresh(room, callRefresh);
                    clearInterval(checkUnnamedInterval);
                }
            }, 1000);
        } else {
            saveStateAndRefresh(room, callRefresh);
        }
    }

    function missingInfo(messages, uploads) {
        return unnamedMessagesCount(messages) > 0 ||
               noUploadMessagesCount(messages) > 0 ||
               unnamedUploadsCount(uploads) > 0;
    }

    function unnamedMessagesCount(messages) {
        return unnamedMessages(messages).length;
    }

    function unnamedMessages(messages) {
        return jLinq.from(messages)
            .where(function(message) {
                return (message.user_id !== null && message.user === null)
            }).select();
    }

    function noUploadMessagesCount(messages) {
        return noUploadMessages(messages).length;
    }

    function noUploadMessages(messages) {
        return jLinq.from(messages)
            .where(function(message) {
                return (message.type === happycamper.util.MESSAGE_TYPES.UPLOAD &&
                        message.upload === undefined);
            }).select();
    }

    function unnamedUploadsCount(uploads) {
        return unnamedUploads(uploads).length;
    }

    function unnamedUploads(uploads) {
        return jLinq.from(uploads)
            .where(function(upload) {
                return (upload.user === undefined || upload.user === null);
            }).select();
    }

    function saveStateAndRefresh(room, callRefresh) {
        // don't call save/refresh on room that isn't active anymore
        if (!isActiveRoom(room.id))
            return;

        saveState();

        if (callRefresh) {
            callPopupFunction(function(popup) {
                popup.happycamper.refresh.roomChat(room.id);
            });
        }

        if (roomCallback !== null) {
            roomCallback();
            roomCallback = null;
        }
    }

    // messages and users
    function getUsersAndMessagesForRoom(room) {
        var roomState = getActiveRoomState(room.id);

        executor.rooms.show(room.id, function(usersData) {
            var usersChanged = JSON.stringify(roomState.users) === JSON.stringify(usersData.room.users);
            roomState.users = usersData.room.users;

            if (usersChanged) {
                callPopupFunction(function(popup) {
                    popup.happycamper.refresh.roomUsers(room.id);
                });
            }

            // must have users before messages
            getMessagesForRoom(room);
        });
    }

    function getMessagesForRoom(room) {
        var roomState = getActiveRoomState(room.id);
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

            // async call
            getFileForMessages(room.id, messages);

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
             .equals("id", userId).first();
    }

    function setCampfireUserForMessage(message) {
        executor.users.show(message.user_id, function(userData) {
            message.user = userData.user;
        });
    }

    function getMessagesWithTimestamp(messages) {
        return jLinq.from(messages)
            .select(function(message) {
                message.timestamp = dateFormat(message.created_at, "shortTime");
                return message;
            });
    }

    function getFileForMessages(roomId, messages) {
        var uploadMessages = jLinq.from(messages)
            .where(function(message) {
                return message.type === happycamper.util.MESSAGE_TYPES.UPLOAD;
            }).select();

        $.each(uploadMessages, function(index, message) {
            executor.rooms.getUploadObject(roomId, message.id, function(uploadData) {
                message.upload = uploadData.upload;

                // in kb
                message.upload.size = message.upload.byte_size / 1000;
            });
        });
    }

    // files
    function getRecentUploadsForRoom(room) {
        var roomState = getActiveRoomState(room.id);

        executor.rooms.recentUploads(room.id, function(uploadsData) {
            var formattedUploads = getFormattedUploads(uploadsData.uploads);
            var filesChanged = JSON.stringify(roomState.recentUploads) === JSON.stringify(formattedUploads);

            roomState.recentUploads = formattedUploads;

            if (filesChanged) {
                callPopupFunction(function(popup) {
                    popup.happycamper.refresh.roomFiles(room.id);
                });
            }

            saveState();
        });
    }

    function getFormattedUploads(uploads) {
        $.each(uploads, function(index, upload) {
            upload.timestamp = dateFormat(upload.created_at, "shortTime") + ", " + dateFormat(upload.created_at, "mmmm d");
            upload.size = upload.byte_size / 1000;
            upload.user = getUserForUpload(upload);
        });

        return uploads;
    }

    function getUserForUpload(upload) {
        var userId = upload.user_id;

        if (userId === null)
            return null;

        var user = getUserFromAllUsers(userId);

        if (user !== undefined)
            return user;

        // get from campfire
        setCampfireUserForUpload(upload);
        return null;
    }

    function setCampfireUserForUpload(upload) {
        executor.users.show(upload.user_id, function(userData) {
            upload.user = userData.user;
            saveState();
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

    function getActiveRoom(roomId) {
        return jLinq.from(happycamper.state.activeRooms)
               .equals("id", roomId)
               .first();
    }

    function isActiveRoom(roomId) {
        return jLinq.from(happycamper.state.activeRooms)
               .equals("id", roomId)
               .any();
    }

    function getActiveRoomState(roomId) {
        return jLinq.from(happycamper.state.activeRoomStates)
            .equals("id", roomId)
            .first();
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

    function loadState() {
        happycamper.state = happycamper.util.loadJson("state");
    }

    function saveState() {
        happycamper.util.saveJson("state", happycamper.state);
    }
};

$(function() {
    happycamper.background = new happycamper.background();
    happycamper.background.initialize();
});