happycamper.settings = {};

happycamper.state = {
    visibleRooms: [],
    activeRooms: [],
    openRoomId: -1,
    activeRoomStates: [],
    allUsers: []
};

happycamper.notifiedRooms = {
    roomIds: []
};

happycamper.background = function() {
    var executor;

    // used for removing spinner once room has loaded
    var roomCallback = null;

    // used to deal with periodic full refreshes
    var refreshCount = 0;

    // public
    this.initialize = function() {
        openOptionsOnFirstLoad();
        
        initializeStateAndSettings();
        initializeExecutor();

        // call once manually
        refreshLoop();
        setInterval(function() {
            refreshLoop();
        }, (happycamper.settings.refreshInterval * 1000));
    };

    this.refresh = function() {
        refreshLoop();  
    };

    this.refreshRoom = function(roomId) {
        var room = getActiveRoom(roomId);
        getUsersAndMessagesForRoom(room);
    };

    this.refreshWithCallback = function(callback) {
        refreshLoop();
        roomCallback = callback;
    };

    this.getUserForMessage = getUserForMessage;

    this.getFileForMessages = getFileForMessages;

    this.executor = function() {
        return executor;
    };

    this.refreshPage = function() {
        location.reload(true);
    };

    this.refreshSettings = function() {
        happycamper.settings = happycamper.util.loadJson("settings");
    };

    // initialize
    function initializeStateAndSettings() {
        var state = happycamper.util.loadJson("state");
        var notifiedRooms = happycamper.util.loadJson("notifiedRooms");
        happycamper.settings = happycamper.util.loadJson("settings");

        if (state === null) {
            saveState();
        } else {
            happycamper.state = state;
        }

        if (notifiedRooms === null) {
            happycamper.util.saveJson("notifiedRooms", happycamper.notifiedRooms);
        } else {
            happycamper.notifiedRooms = notifiedRooms;
        }
    }

    function initializeExecutor() {
        var settings = happycamper.settings;

        executor = new Camper.Executor({
            url: settings.account.name + ".campfirenow.com",
            apikey: settings.account.apiToken
        });
    }

    // options
    function openOptionsOnFirstLoad() {
        if (happycamper.util.loadJson("firstLoaded") === null) {
            chrome.tabs.create({
                url: "options.html"
            });

            happycamper.util.saveJson("firstLoaded", true);
        }
    }

    // refresh
    function refreshLoop() {
        loadState();

        if (happycamper.settings.me === null) {
            // user hasn't filled in account info yet
            console.log("no fill");
            return;
        }

        // deep copy
        var newState = $.extend(true, {}, happycamper.state);
        setVisibleActiveRooms(newState);
        setActiveRoomStates();

        refreshCount++;
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
            var tryCount = 0;

            // not all users and files have been set
            var checkUnnamedInterval = setInterval(function() {
                if (!missingInfo(messages, uploads) || tryCount === 5) {
                    clearInterval(checkUnnamedInterval);
                    saveStateAndRefresh(room, callRefresh);
                }

                tryCount++;
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
        if (room.id === 386540) {
            console.log("room");
        }

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
            var messages = messagesData.messages;

            // this is an async call, must wait for all users to come back
            setAllUsersForMessages(messages);

            var tryCount = 0;
            var checkUsersInterval = setInterval(function() {
                if (newUserIdsForMessages(messages).length === 0 || tryCount === 20) {
                    clearInterval(checkUsersInterval);
                    setPropertiesForMessages(messages, room, roomState, fullRefresh);
                }

                tryCount++;
            }, 200);
        });
    }

    function setPropertiesForMessages(messages, room, roomState, fullRefresh) {
        messages = getMessagesWithUser(messages);
        messages = getMessagesWithTimestamp(messages);

        getFileForMessages(room.id, messages);

        if (fullRefresh) {
            roomState.messages = messages;
            saveStateOnLoadComplete(room, false);
        } else {
            roomState.messages = roomState.messages.concat(messages);

            if (messages.length > 0) {
                showMessageNotifications(messages, room);
                saveStateOnLoadComplete(room, true);
            }
        }
    }

    function setAllUsersForMessages(messages) {
        var newUserIds = newUserIdsForMessages(messages);

        $.each(uniqueOfArray(newUserIds), function(index, userId) {
            executor.users.show(userId, function(userData) {
                setUser(userData.user);
                saveState();
            });
        });
    }

    function getMessagesWithUser(messages) {
        return jLinq.from(messages)
            .select(function(message) {
                message.user = getUserForMessage(message);
                return message;
            });
    }

    function getUserForMessage(message) {
        var userId = message.user_id;

        // user not present, find within allUsers
        var user = getUser(userId);

        if (user !== undefined) {
            return user;
        }

        return null;
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

        var user = getUser(userId);

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
    function showMessageNotifications(newMessages, room) {
        var settings = happycamper.settings;

        if (!settings.notifications.enabled)
            return;

        $.each(newMessages, function(index, message) {
            if (!messageHasBody(message) || isPopupOpen())
                return true;

            var notification = webkitNotifications.createNotification(
                "../images/icon48.png",
                message.user.name + " - " + room.name,
                message.body
            );

            notification.show();
            setRoomNotifyIcon(room.id);
            setActionNotifyIcon();

            if (settings.notifications.showFor > 0) {
                setTimeout(function() {
                    notification.cancel();
                }, settings.notifications.showFor * 1000);
            }
        });
    }

    function setRoomNotifyIcon(roomId) {
        happycamper.notifiedRooms = happycamper.util.loadJson("notifiedRooms");
        happycamper.notifiedRooms.roomIds.push(roomId);
        happycamper.util.saveJson("notifiedRooms", happycamper.notifiedRooms);
    }

    function setActionNotifyIcon() {
        chrome.browserAction.setIcon({
            path: "../images/action-icon-notify.png"
        })
    }

    // utilities
    function callPopupFunction(callback) {
        var popup = chrome.extension.getViews({type: "popup"});

        if (popup.length > 0) {
            callback(popup[0]);
        }
    }

    function isPopupOpen() {
        return chrome.extension.getViews({type: "popup"}).length > 0;
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
             .equals("id", userId).first();
    }

    function setUser(user) {
        if (getUser(user.id) === undefined) {
            happycamper.state.allUsers.push(user);
        }
    }

    function newUserIdsForMessages(messages) {
        return jLinq.from(messages)
            .where(function(message) {
                return (message.user_id !== null && getUser(message.user_id) === undefined);
            }).select(function(message) {
                return message.user_id;
            });
    }

    function messageHasBody(message) {
        var TYPES = happycamper.util.MESSAGE_TYPES;

        return (message.type === TYPES.TEXT ||
                message.type === TYPES.PASTE ||
                message.type === TYPES.UPLOAD);
    }

    // from: http://www.devcurry.com/2010/04/remove-duplicate-elements-from-array.html
    function uniqueOfArray (arrVal) {
        var uniqueArr = [];
        
        for (var i = arrVal.length; i--; ) {
            var val = arrVal[i];
            if ($.inArray(val, uniqueArr) === -1) {
                uniqueArr.unshift(val);
            }
        }

        return uniqueArr;
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