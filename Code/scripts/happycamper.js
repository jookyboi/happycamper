var happycamper = {};

happycamper.settings = {};
happycamper.state = {};

happycamper.rooms = function() {
    var visibleRooms = happycamper.state.visibleRooms;
    var activeRooms = happycamper.state.activeRooms;

    var $rooms = $("div.rooms");
    var $roomsList = $("div.rooms div.list");
    var $scrollbox = $roomsList.find("div.scrollbox");

    var $joinRoom = $("div.content.join-room");
    var $joining = $("div.content.joining");
    var $main = $("div.content.main");

    var ROOM_HEIGHT = 29;

    // used to prevent roomList from refreshing when joining room
    var roomListRefreshEnabled = true;

    // on initialize
    templateRooms();
    wireUpDownButtons();

    // templating
    function templateRooms() {
        $scrollbox.html("");

        templateActiveRooms();
        templateLockedRooms();
        templateInactiveRooms();

        wireOpenRoom();
        openDefaultRoom();
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

        // prevent double scrolling
        var upScrolling = false;
        var downScrolling = false;

        scrollUp.unbind("click").click(function() {
            if (!$(this).hasClass("active"))
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
        });

        scrollDown.unbind("click").click(function() {
            if (!$(this).hasClass("active"))
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

            var $room = $(this);
            var roomId = parseInt($room.attr("roomid"));

            if (!$room.hasClass("active")) {
                joinRoom(roomId);
            } else {
                openRoom(roomId);
            }

            return false;
        });
    }

    function openDefaultRoom() {
        var state = happycamper.state;

        // user already has room open
        if (state.openRoomId !== -1 && isRoomActive(state.openRoomId)) {
            openRoom(state.openRoomId);
            return;
        }

        // open first active
        var firstActiveRoom = jLinq.from(activeRooms).first();

        if (firstActiveRoom !== undefined) {
            openRoom(firstActiveRoom.id);
            return;
        }

        // nothing active
        showOpenRoomMessage();
    }

    function openRoom(roomId) {
        $joining.fadeOut();
        $main.show();

        loadState();
        happycamper.state.openRoomId = roomId;
        saveState();

        makeRoomButtonSelected(roomId);
        templateMessages(roomId);
        wireSendTextMessage();
    }

    function joinRoom(roomId) {
        $joinRoom.hide();
        $joining.fadeIn();

        var executor = getExecutor();
        var background = getBackground();
        roomListRefreshEnabled = false;

        executor.rooms.join(roomId, function() {
            background.happycamper.background.refreshWithCallback(roomId, function() {
                makeRoomButtonActive(roomId);
                openRoom(roomId);
                roomListRefreshEnabled = true;
            });
        });
    }

    function showOpenRoomMessage() {
        $joinRoom.show();
    }

    // messages
    function templateMessages(roomId) {
        var roomState = getRoomState(roomId);

        if (roomState === undefined)
            return;

        var messages = roomState.messages;

        var $conversationBox = $main.find("div.conversation");
        $conversationBox.html("");

        formatTimestampMessages(messages);

        var TYPES = happycamper.util.MESSAGE_TYPES;

        $.each(messages, function(index, message) {
            if (message.type === TYPES.ENTER) {
                $("#enter-message-template").tmpl(message).appendTo($conversationBox);
            } else if (message.type === TYPES.LEAVE || message.type === TYPES.KICK) {
                $("#leave-message-template").tmpl(message).appendTo($conversationBox);
            } else if (message.type === TYPES.TIMESTAMP) {
                $("#timestamp-message-template").tmpl(message).appendTo($conversationBox);
            } else if (message.type === TYPES.TEXT) {
                insertWhoMessage(messages, message, index);
                $("#text-message-template").tmpl(replaceURLWithHTMLLinks(message)).appendTo($conversationBox);
            } else if (message.type === TYPES.UPLOAD) {
                insertWhoMessage(messages, message, index);
                $("#upload-message-template").tmpl(message).appendTo($conversationBox);
            } else if (message.type === TYPES.PASTE) {
                $("#paste-message-template").tmpl(message).appendTo($conversationBox);
            } else if (message.type === TYPES.LOCK) {
                $("#lock-message-template").tmpl(message).appendTo($conversationBox);
            } else if (message.type === TYPES.UNLOCK) {
                $("#unlock-message-template").tmpl(message).appendTo($conversationBox);
            }
        });

        scrollToConversationBottom();
        wireLinks();
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

    function insertWhoMessage(messages, message, index) {
        var $conversationBox = $main.find("div.conversation");

        // add who message if text/paste is the firt of the block
        if (index === 0) {
            $("#who-message-template").tmpl(whoMessage(message.user)).appendTo($conversationBox);
        } else {
            var lastMessage = messages[index - 1];
            var TYPES = happycamper.util.MESSAGE_TYPES;

            if ((lastMessage.type !== TYPES.TEXT &&
                 lastMessage.type !== TYPES.PASTE &&
                 lastMessage.type !== TYPES.UPLOAD) ||
                (lastMessage.user_id !== message.user_id)) {
                $("#who-message-template").tmpl(whoMessage(message.user)).appendTo($conversationBox);
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

        $sendBox.keydown(function(event) {
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
            var background = getBackground();
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
                background.happycamper.background.refreshRoom(openRoomId);
            });

            $sendBox.val("").focus();
        }
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

    function wireLinks() {
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

    // public
    this.refreshRoom = function(roomId) {
        if (happycamper.state.openRoomId === roomId) {
            // don't attempt to template for non-open room
            templateMessages(roomId);
        }
    };

    this.roomListRefreshEnabled = function() {
        return roomListRefreshEnabled;  
    };

    return this;
};

var happyCamperRooms;

happycamper.refresh = function() {
    function getStateAndSettings() {
        happycamper.state = happycamper.util.loadJson("state");
        happycamper.settings = happycamper.util.loadJson("settings");
    }

    return {
        roomsList: function() {
            if (happyCamperRooms.roomListRefreshEnabled()) {
                getStateAndSettings();
                happycamper.rooms();
            }
        },
        room: function(roomId) {
            getStateAndSettings();
            happyCamperRooms.refreshRoom(roomId);
        }
    }
}();

$(function() {
    // use whatever is in the latest localStorage
    happycamper.state = happycamper.util.loadJson("state");
    happycamper.settings = happycamper.util.loadJson("settings");
    happyCamperRooms = happycamper.rooms();

    // todo: handle getting kicked out of deleted room
});