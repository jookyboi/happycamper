happycamper.settings = {};
happycamper.state = {};

happycamper.rooms = function() {
    var visibleRooms;
    var activeRooms;

    var $options;
    var $rooms;
    var $roomsList;
    var $scrollbox;

    var $joinRoom;
    var $joining;
    var $main;
    var $usersFilter;
    var $typesFilter;

    // constants
    var ROOM_HEIGHT = 29;
    var HINTBOX_MESSAGE = "Start typing to search messages";

    // used to prevent roomList from refreshing when joining room
    var roomListRefreshEnabled = true;

    // prevent double scrolling
    var upScrolling = false;
    var downScrolling = false;

    function initialize() {
        if (noApiState()) {
            return;
        }

        visibleRooms = happycamper.state.visibleRooms;
        activeRooms = happycamper.state.activeRooms;

        if (noRooms(visibleRooms)) {
            return;
        }

        $options = $("div.options");
        $rooms = $("div.rooms");
        $roomsList = $("div.rooms div.list");
        $scrollbox = $roomsList.find("div.scrollbox");

        $joinRoom = $("div.content.join-room");
        $joining = $("div.content.joining");
        $main = $("div.content.main");
        $usersFilter = $main.find("div.filters select.users-filter");
        $typesFilter = $main.find("div.filters select.types-filter");

        wireOptionsButton();
        
        templateRooms();
        wireUpDownButtons();
        wireMouseWheel();

        clearActionNotifyIcon();
        addNotifyIconsToRooms();
    }

    // new messages notifications
    function clearActionNotifyIcon() {
        chrome.browserAction.setIcon({
            path: "../images/action-icon.png"
        })
    }

    function addNotifyIconsToRooms() {
        var notifiedRooms = happycamper.util.loadJson("notifiedRooms");

        if (notifiedRooms === undefined)
            return;

        $.each(notifiedRooms.roomIds, function(index, roomId) {
            addNotifyIconToRoomButton(roomId);
        });
    }

    // options
    function wireOptionsButton() {
        $options.unbind("click").click(function() {
            chrome.tabs.create({
                url: "options.html"
            });
        });
    }

    // blank states
    function noApiState() {
        if (happycamper.settings.me === null) {
            $("div.viewer").hide();
            
            $("div.blank-slate.no-api").show()
                .find("button").click(function() {
                    chrome.tabs.create({
                        url: "options.html"
                    });
                });

            return true;
        }

        return false;
    }

    function noRooms(visibleRooms) {
        if (visibleRooms.length === 0) {
            $("div.viewer").hide();

            $("div.blank-slate.no-rooms").show()
                .find("button").click(function() {
                    chrome.tabs.create({
                        url: "https://" + happycamper.settings.account.name + ".campfirenow.com"
                    });
                });

            return true;
        }

        return false;
    }

    // templating
    function templateRooms() {
        $scrollbox.html("");

        templateActiveRooms();
        templateInactiveRooms();
        templateLockedRooms();

        wireMainTabs();
        wireOpenRoom();
        openDefaultRoom();
    }

    function templateActiveRooms() {
        $("#room-template").tmpl(activeRooms).appendTo($scrollbox);
    }

    function templateInactiveRooms() {
        $("#room-template").tmpl(getInactiveRooms()).appendTo($scrollbox);
    }

    function templateLockedRooms() {
        $("#room-template").tmpl(getLockedRooms()).appendTo($scrollbox);
    }

    // switch tabs
    function wireMainTabs() {
        $main.find("ul.tabs li").unbind("click").click(function() {
            $main.find("ul.tabs li.selected").removeClass("selected");
            $(this).addClass("selected");

            $main.find("div.tab-content").hide();
            $main.find("div.tab-content." + $(this).attr("tab")).show();

            if ($(this).hasClass("chat"))
                scrollToConversationBottom();

            if ($(this).hasClass("search")) {
                wireSearch(happycamper.state.openRoomId);
                clearResults();
            }

            return false;
        });
    }

    // rooms navigation
    function wireUpDownButtons() {
        if (!buttonsNecessary()) {
            return;
        }

        var scrollUp = $rooms.find("div.scroll-up");
        var scrollDown = $rooms.find("div.scroll-down");

        activateUpDownButtons();

        scrollUp.unbind("click").click(scrollRoomsUp);
        scrollDown.unbind("click").click(scrollRoomsDown);
    }

    function scrollRoomsUp() {
        if ($(this).hasClass("room") && !$(this).hasClass("active"))
            return;

        // prevent scrolling past the top
        var distanceToScroll = Math.min(-(scrollboxMarginTop()), (2* ROOM_HEIGHT));

        if (!upScrolling) {
            upScrolling = true;

            $scrollbox.animate({
                marginTop: '+=' + distanceToScroll
            }, 300, function() {
                upScrolling = false;
                activateUpDownButtons();
            });
        }
    }

    function scrollRoomsDown() {
        if ($(this).hasClass("room") && !$(this).hasClass("active"))
            return;

        // prevent scrolling past the end
        var distanceToBottom = -(scrollableDifference() - scrollboxMarginTop());
        var distanceToScroll = Math.min(distanceToBottom, 2 * ROOM_HEIGHT);

        if (!downScrolling) {
            downScrolling = true;

            $scrollbox.animate({
                marginTop: '-=' + distanceToScroll
            }, 300, function() {
                downScrolling = false;
                activateUpDownButtons();
            });
        }
    }

    function wireMouseWheel() {
        $scrollbox.mousewheel(function(event, delta) {
            if (delta > 0) {
                scrollRoomsUp();
            } else {
                scrollRoomsDown();
            }
        });
    }

    function activateUpDownButtons() {
        var scrollUp = $rooms.find("div.scroll-up");
        var scrollDown = $rooms.find("div.scroll-down");

        if (topScrollable()) {
            scrollUp.addClass("active");
        } else {
            scrollUp.removeClass("active");
        }

        if (bottomScrollable()) {
            scrollDown.addClass("active");
        } else {
            scrollDown.removeClass("active");
        }
    }

    function topScrollable() {
        var marginTop = scrollboxMarginTop();
        return marginTop < 0;
    }

    function bottomScrollable() {
        return scrollboxMarginTop() > scrollableDifference();
    }

    // open room
    function wireOpenRoom() {
        $roomsList.find("div.room").unbind("click").click(function() {
            // don't allow clicks when another is trying to open
            if (!roomListRefreshEnabled)
                return false;

            // can't enter a room locked by somebody else
            if ($(this).hasClass("locked"))
                return false;

            var $room = $(this);
            var roomId = parseInt($room.attr("roomid"));
            var roomState = getRoomState(roomId);

            if ($room.hasClass("active") && roomState !== undefined) {
                openRoom(roomId);
            } else {
                joinRoom(roomId);
            }

            return false;
        });
    }

    function openDefaultRoom() {
        var state = happycamper.state;

        // user already has room open
        if (state.openRoomId !== -1 && isRoomActive(state.openRoomId)) {
            joinOrOpenRoom(state.openRoomId);
            return;
        }

        // open first active
        var firstActiveRoom = jLinq.from(activeRooms).first();

        if (firstActiveRoom !== undefined) {
            joinOrOpenRoom(firstActiveRoom.id);
            return;
        }

        // nothing active
        showOpenRoomMessage();
    }

    function joinOrOpenRoom(roomId) {
        var roomState = getRoomState(roomId);

        if (roomState === undefined) {
            joinRoom(roomId);
        } else {
            openRoom(roomId);
        }
    }

    function openRoom(roomId) {
        try {
            $joining.fadeOut();
            $main.show();

            removeNotifyIconFromRoomButton(roomId);
            removeFromNotifiedRooms(roomId);

            loadState();
            happycamper.state.openRoomId = roomId;
            saveState();

            wireLeaveRoom();

            makeRoomButtonSelected(roomId);
            templateMessages(roomId);
            wireSendTextMessage();

            templateFilters();
            wireFilters();

            templateUsers(roomId);
            templateFiles();
            wireFileLinks();

            gotoChatTab();

            // only do this on room open, not on refresh
            scrollToConversationBottom();
        } catch (error) {
            // allow execution to continue
        }

    }

    function joinRoom(roomId) {
        $joinRoom.hide();
        $joining.fadeIn();

        var executor = getExecutor();
        roomListRefreshEnabled = false;

        executor.rooms.join(roomId, function() {
            getBackground().happycamper.background.refreshWithCallback(function() {
                makeRoomButtonActive(roomId);
                openRoom(roomId);
                roomListRefreshEnabled = true;
            });
        });
    }

    function showOpenRoomMessage() {
        $main.hide();
        $joining.hide();
        $joinRoom.show();
    }

    function gotoChatTab() {
        $main.find("ul.tabs li.chat").trigger("click");
    }

    // leave room
    function wireLeaveRoom() {
        var roomId = happycamper.state.openRoomId;

        $main.find("a.leave-room").unbind("click").click(function() {
            leaveRoom(roomId);
        });
    }

    function leaveRoom(roomId) {
        var executor = getBackground().happycamper.background.executor();
        $joining.fadeIn();

        executor.rooms.leave(roomId, function() {
            // rooms list will change when rooms list change gets handled
            getBackground().happycamper.background.refresh();
        });
    }

    // messages
    function templateMessages(roomId) {
        var roomState = getRoomState(roomId);

        if (roomState === undefined)
            return;

        var messages = filteredMessages(roomState.messages);

        var $conversationBox = $main.find("div.conversation");
        $conversationBox.html("");

        formatTimestampMessages(messages);

        var TYPES = happycamper.util.MESSAGE_TYPES;
        var chatSettings = happycamper.settings.chat;

        $.each(messages, function(index, message) {
            fillInForEmptyUser(message, roomState);

            if (message.type === TYPES.ENTER) {
                if (chatSettings.showEnterLeave) {
                    $("#enter-message-template").tmpl(message).appendTo($conversationBox);
                }
            } else if (message.type === TYPES.LEAVE || message.type === TYPES.KICK) {
                if (chatSettings.showEnterLeave) {
                    $("#leave-message-template").tmpl(message).appendTo($conversationBox);
                }
            } else if (message.type === TYPES.TIMESTAMP) {
                if (chatSettings.showTimestamps) {
                    $("#timestamp-message-template").tmpl(message).appendTo($conversationBox);
                }
            } else if (message.type === TYPES.TEXT) {
                insertWhoMessage(messages, message, index, $conversationBox);
                $("#text-message-template").tmpl(replaceURLWithHTMLLinks(message)).appendTo($conversationBox);
            } else if (message.type === TYPES.UPLOAD) {
                insertWhoMessage(messages, message, index, $conversationBox);
                $("#upload-message-template").tmpl(message).appendTo($conversationBox);
            } else if (message.type === TYPES.PASTE) {
                insertWhoMessage(messages, message, index, $conversationBox);
                $("#paste-message-template").tmpl(message).appendTo($conversationBox);
            } else if (message.type === TYPES.LOCK) {
                $("#lock-message-template").tmpl(message).appendTo($conversationBox);
            } else if (message.type === TYPES.UNLOCK) {
                $("#unlock-message-template").tmpl(message).appendTo($conversationBox);
            }
        });

        wireMessageLinks();
    }

    function fillInForEmptyUser(message, roomState) {
        // if for any reason user doesn't get populated (this is rare)
        if (messageContainsUser(message) && message.user === null) {
            message.user = getBackground().happycamper.background.getUserForMessage(message, roomState);
            saveState();
        }
    }
    
    function formatTimestampMessages(messages) {
        var timestampMessages = jLinq.from(messages)
            .where(function(message) {
                return message.type === happycamper.util.MESSAGE_TYPES.TIMESTAMP;
            }).select();

        $.each(timestampMessages, function(index, message) {
            if (index === 0) {
                message.date = formatTimestampWithDate(message.created_at);
            } else {
                var lastTimeStamp = timestampMessages[index - 1].created_at;

                if (dateFormat(lastTimeStamp, "shortDate") !== dateFormat(message.created_at, "shortDate")) {
                    message.date = formatTimestampWithDate(message.created_at);
                }
            }
        });
    }

    function insertWhoMessage(messages, message, index, $box) {
        // add who message if text/paste is the firt of the block
        if (index === 0) {
            $("#who-message-template").tmpl(whoMessage(message.user)).appendTo($box);
        } else {
            var lastMessage = messages[index - 1];
            var TYPES = happycamper.util.MESSAGE_TYPES;

            if ((lastMessage.type !== TYPES.TEXT &&
                 lastMessage.type !== TYPES.PASTE &&
                 lastMessage.type !== TYPES.UPLOAD) ||
                (lastMessage.user_id !== message.user_id)) {
                $("#who-message-template").tmpl(whoMessage(message.user)).appendTo($box);
            }
        }
    }

    function whoMessage(user) {
        return {
            type: "WhoMessage",
            user_id: user.id,
            user: user
        };
    }

    // send message
    function wireSendTextMessage() {
        var $sendBox = $main.find("div.send textarea");

        $sendBox.unbind("keydown").keydown(function(event) {
            // pressed enter
            if (event.keyCode == "13") {
                sendMessage();
                return false;
            }
        });

        $main.find("div.send button").unbind("click").click(function() {
            sendMessage();
            return false;
        });
    }

    function sendMessage() {
        var $sendBox = $main.find("div.send textarea");
        
        var message = $.trim($sendBox.val());
        if (message !== "") {
            var executor = getExecutor();
            var openRoomId = happycamper.state.openRoomId;

            // we're deliberate omitting the message type
            // according to the api, if the type is omitted,
            // messages with \n will be considered a paste
            executor.rooms.speak(openRoomId, {
                message: {
                    body: message
                }
            }, function() {
               // upon callback, refresh the data. background will auto-refresh the chat
                getBackground().happycamper.background.refreshRoom(openRoomId);
            });

            $sendBox.val("").focus();
        }
    }

    // chat filters
    function templateFilters() {
        var state = happycamper.state;
        var roomState = getRoomState(state.openRoomId);

        templateUsersFilter(roomState);
        templateTypesFilter(roomState);
    }

    function templateUsersFilter(roomState) {
         var messageUsers = jLinq.from(roomState.messages)
            .where(function(message) {
                // only these message types have users
                return messageContainsUser(message);
            }).select(function(message) {
                return message.user;
            });

        messageUsers = uniqueOfJsonArray(messageUsers);

        $usersFilter.html("");

        // default option
        var filterOptionTemplate = $("#filter-option-template");

        filterOptionTemplate.tmpl({
            id: "all",
            name: "All users"
        }).appendTo($usersFilter);

        filterOptionTemplate.tmpl(messageUsers).appendTo($usersFilter);
    }

    function templateTypesFilter(roomState) {
        var messageTypes = jLinq.from(roomState.messages)
            .where(function(message) {
                return messageHasBody(message);
            }).select(function(message) {
                return {
                    id: message.type,
                    name: nameForType(message.type)
                };
            });

        messageTypes = uniqueOfJsonArray(messageTypes);

        $typesFilter.html("");

        // default option
        var filterOptionTemplate = $("#filter-option-template");

        filterOptionTemplate.tmpl({
            id: "all",
            name: "All types"
        }).appendTo($typesFilter);

        filterOptionTemplate.tmpl(messageTypes).appendTo($typesFilter);
    }

    function nameForType(type) {
        var TYPES = happycamper.util.MESSAGE_TYPES;

        if (type === TYPES.TEXT) return "Text";
        if (type === TYPES.PASTE) return "Paste";
        if (type === TYPES.UPLOAD) return "Upload";
    }

    function wireFilters() {
        wireUsersFilter();
        wireTypesFilter();
    }

    function wireUsersFilter() {
        var state = happycamper.state;

        $usersFilter.unbind("change").change(function() {
            templateMessages(state.openRoomId);
        });
    }

    function wireTypesFilter() {
        var state = happycamper.state;

        $typesFilter.unbind("change").change(function() {
            templateMessages(state.openRoomId);
        });

        $main.find("div.filters a.reset-filters").unbind("click").click(resetFilters);
    }

    function resetFilters() {
        $usersFilter.val("all").trigger("change");
        $typesFilter.val("all").trigger("change");
        scrollToConversationBottom();
    }

    function filteredMessages(messages) {
        var usersFilter = $usersFilter.val();
        var typesFilter = $typesFilter.val();

        // hasn't been templated yet
        if (isNotFiltered())
            return messages;

        var userFilteredMessages = jLinq.from(messages)
            .where(function(message) {
                if (usersFilter === "all")
                    return true;

                if (!messageContainsUser(message))
                    return false;

                return message.user.id === parseInt(usersFilter);
            }).select();

        return jLinq.from(userFilteredMessages)
            .where(function(message) {
                if (typesFilter === "all")
                    return true;

                if (!messageHasBody(message))
                    return false;

                return message.type === typesFilter;
                
            }).select();
    }

    function isNotFiltered() {
        var usersFilter = $usersFilter.val();
        var typesFilter = $typesFilter.val();

        return (usersFilter === null || typesFilter === null);
    }

    // users
    function templateUsers(roomId) {
        var roomState = getRoomState(roomId);

        if (roomState === undefined)
            return;

        var $users = $main.find("div.tab-content.users div.list");
        $users.html("");

        var users = jLinq.from(roomState.users)
            .select(function(user) {
                user.gravatar = $.gravatar(user.email_address, {
                    size: "32",
                    rating: "pg",
                    image: "identicon"
                });

                return user;
            });

        $("#user-template").tmpl(users).appendTo($users);
    }

    // files
    function templateFiles() {
        var roomState = getRoomState(happycamper.state.openRoomId);

        if (roomState === undefined)
            return;

        var $files = $main.find("div.tab-content.files div.list");
        $files.html("");

        $("#file-template").tmpl(roomState.recentUploads).appendTo($files);
    }

    function wireFileLinks() {
        var $files = $main.find("div.tab-content.files div.list");

        $files.find("a").unbind("click").click(function() {
            chrome.tabs.create({
                url: $(this).attr("href")
            });

            return false;
        });
    }

    // search
    function wireSearch(roomId) {
        var $searchbox = $main.find("input.search-messages");

        $searchbox.hintbox({
            activeClass: "active",
            filledClass: "active",
            hintText: HINTBOX_MESSAGE
        }).delayedsearch({
            call: function(value) {
                searchTerm(roomId, value);
            }
        });
    }

    function searchTerm(roomId, value) {
        value = $.trim(value);

        if (value === "") {
            clearResults();
            return;
        }

        preSearchTerm();

        var executor = getExecutor();
        executor.search(value, function(searchData) {
            getResultsForRoom(roomId, getResultsWithTimestamp(searchData.messages));
        });
    }

    function clearResults() {
        $main.find("div.tab-content.search div.results").html("").hide();
        $main.find("div.no-results").hide();
        $main.find("div.loading").hide();
    }

    function preSearchTerm() {
        $main.find("div.no-results").hide();
        $main.find("div.tab-content.search div.results").hide();
        $main.find("div.loading").show();
    }

    function getResultsWithTimestamp(messages) {
        return jLinq.from(messages)
            .select(function(message) {
                message.timestamp = dateFormat(message.created_at, "mmmm d");
                return message;
            });
    }

    function getResultsForRoom(roomId, messages) {
        var results = jLinq.from(messages)
            .equals("room_id", roomId)
            .select();

        if (results.length === 0) {
            showNoResults();
            return;
        }

        var TYPES = happycamper.util.MESSAGE_TYPES;
        var background = getBackground().happycamper.background;

        // uploads
        background.getFileForMessages(roomId, results);
        
        $.each(results, function(index, message) {
            // could get user from local, could get from server
            message.user = background.getUserForMessage(message, getRoomState(roomId));
        });

        var tryCount = 0;

        var checkUnfinished = setInterval(function() {
            var unnamedMessages = jLinq.from(results)
                .equals("user", null)
                .count();

            var noUploadMessages = jLinq.from(results)
                .where(function(result) {
                    return (result.type === TYPES.UPLOAD &&
                            result.upload === undefined);
                }).count();

            if (++tryCount === 15) {
                // give up
                showNoResults();
                clearInterval(checkUnfinished);
            }

            // waiting for response to come back
            if (unnamedMessages === 0 && noUploadMessages === 0) {
                clearInterval(checkUnfinished);
                showSearchResults(results);
            }
        }, 200);
    }

    function showSearchResults(results) {
        $main.find("div.loading").hide();
        $main.find("div.no-results").hide();

        // reverse chronological order
        results.reverse();

        var TYPES = happycamper.util.MESSAGE_TYPES;

        $resultsBox = $main.find("div.tab-content.search div.results");
        $resultsBox.html("").show();

        $.each(results, function(index, message) {
            if (message.type === TYPES.TEXT) {
                insertWhoMessage(results, message, index, $resultsBox);
                $("#text-message-template").tmpl(replaceURLWithHTMLLinks(message)).appendTo($resultsBox);
            } else if (message.type === TYPES.UPLOAD) {
                insertWhoMessage(results, message, index, $resultsBox);
                $("#upload-message-template").tmpl(message).appendTo($resultsBox);
            } else if (message.type === TYPES.PASTE) {
                insertWhoMessage(results, message, index, $resultsBox);
                $("#paste-message-template").tmpl(message).appendTo($resultsBox);
            }
        });

        wireResultLinks();
    }
    
    function wireResultLinks() {
        $resultsBox = $main.find("div.tab-content.search div.results");
        $resultsBox.find("div.activity a").unbind("click").click(function() {
            chrome.tabs.create({
                url: $(this).attr("href")
            });

            return false;
        });
    }

    function showNoResults() {
        $main.find("div.loading").hide();
        $main.find("div.no-results").show();
    }

    // utilities
    function makeRoomButtonActive(roomId) {
        $roomsList.find("div.room[roomid='" + roomId + "']")
                  .removeClass("inactive")
                  .removeClass("locked")
                  .addClass("active");
    }

    function makeRoomButtonSelected(roomId) {
        $roomsList.find("div.room.selected").removeClass("selected");
        $roomsList.find("div.room[roomid='" + roomId + "']").addClass("selected");
    }

    function addNotifyIconToRoomButton(roomId) {
        $roomsList.find("div.room[roomid='" + roomId + "']")
                  .addClass("new-messages");
    }

    function removeNotifyIconFromRoomButton(roomId) {
        $roomsList.find("div.room[roomid='" + roomId + "']")
                  .removeClass("new-messages");
    }

    function removeFromNotifiedRooms(roomId) {
        var notifiedRooms = happycamper.util.loadJson("notifiedRooms");
        if (notifiedRooms === undefined)
            return;

        notifiedRooms.roomIds = jLinq.from(notifiedRooms.roomIds)
            .where(function(thisRoomId) {
                return thisRoomId !== roomId;
            }).select();

        happycamper.util.saveJson("notifiedRooms", notifiedRooms);
    }

    function scrollboxMarginTop() {
        return parseInt($scrollbox.css("marginTop").replace("px"));
    }

    function scrollableDifference() {
        return $roomsList.height() - $scrollbox.height();
    }

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
                // user could still enter a locked room
                return (room.locked &&
                        jLinq.from(activeRooms)
                            .where(function(activeRoom) {
                                return activeRoom.id === room.id;
                            }).count() === 0
                        );
            }).select(function(room) {
                room.state = "locked";
                return room;
            });
    }

    function isRoomActive(roomId) {
        return jLinq.from(activeRooms)
            .equals("id", roomId)
            .any();
    }

    function getRoomState(roomId) {
        return jLinq.from(happycamper.state.activeRoomStates)
            .equals("id", roomId)
            .first();
    }

    function messageContainsUser(message) {
        var TYPES = happycamper.util.MESSAGE_TYPES;

        return (message.type === TYPES.ENTER ||
                message.type === TYPES.LEAVE ||
                message.type === TYPES.KICK ||
                message.type === TYPES.TEXT ||
                message.type === TYPES.PASTE ||
                message.type === TYPES.UPLOAD ||
                message.type === TYPES.LOCK ||
                message.type === TYPES.UNLOCK);
    }

    function messageHasBody(message) {
        var TYPES = happycamper.util.MESSAGE_TYPES;

        return (message.type === TYPES.TEXT ||
                message.type === TYPES.PASTE ||
                message.type === TYPES.UPLOAD);
    }

    function wireMessageLinks() {
        var $conversationBox = $main.find("div.conversation");
        $conversationBox.find("div.activity a").unbind("click").click(function() {
            chrome.tabs.create({
                url: $(this).attr("href")
            });

            return false;
        });
    }

    function scrollToConversationBottom() {
        var $conversationBox = $main.find("div.conversation");
        $conversationBox.scrollTop($conversationBox[0].scrollHeight);
    }

    function formatTimestampWithDate(time) {
        return dateFormat(time, "mmmm d");
    }

    function replaceURLWithHTMLLinks(message) {
        var formattedMessage = $.extend(true, {}, message);
        var expression = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;

        formattedMessage.hasLink = expression.test(formattedMessage.body);
        formattedMessage.body = formattedMessage.body.replace(expression, '<a href="$1">$1</a>');
        return formattedMessage;
    }

    function getExecutor() {
        return getBackground().happycamper.background.executor();
    }

    function getBackground() {
        return chrome.extension.getBackgroundPage();
    }

    function loadState() {
        happycamper.state = happycamper.util.loadJson("state");
    }

    function saveState() {
        happycamper.util.saveJson("state", happycamper.state);
    }

    function uniqueOfJsonArray(array) {
        var map = {}, index, length = array.length, unique = [];

        for (index = 0; index < length; index++) {
            map[JSON.stringify(array[index])] = array[index];
        }
        
        for (index in map) unique.push(map[index]);
        return unique;
    }

    // public
    return {
        initialize: initialize,
        refreshRoomChat: function(roomId) {
            if (happycamper.state.openRoomId === roomId) {
                // don't attempt to template for non-open room
                templateMessages(roomId);
                scrollToConversationBottom();
            }
        },
        refreshRoomUsers: function(roomId) {
            if (happycamper.state.openRoomId === roomId) {
                templateUsers(roomId);
            }
        },
        refreshRoomFiles: function(roomId) {
            if (happycamper.state.openRoomId === roomId) {
                templateFiles(roomId);
            }
        },
        roomListRefreshEnabled: function() {
            return roomListRefreshEnabled;
        }
    };
}();

happycamper.refresh = function() {
    function getStateAndSettings() {
        happycamper.state = happycamper.util.loadJson("state");
        happycamper.settings = happycamper.util.loadJson("settings");
    }

    return {
        roomsList: function() {
            if (happycamper.rooms.roomListRefreshEnabled()) {
                getStateAndSettings();
                happycamper.rooms.initialize();
            }
        },
        roomChat: function(roomId) {
            getStateAndSettings();
            happycamper.rooms.refreshRoomChat(roomId);
        },
        roomUsers: function(roomId) {
            getStateAndSettings();
            happycamper.rooms.refreshRoomUsers(roomId);
        },
        roomFiles: function(roomId) {
            getStateAndSettings();
            happycamper.rooms.refreshRoomFiles(roomId);
        }
    }
}();

$(function() {
    // use whatever is in the latest localStorage
    happycamper.state = happycamper.util.loadJson("state");
    happycamper.settings = happycamper.util.loadJson("settings");
    happycamper.rooms.initialize();
});