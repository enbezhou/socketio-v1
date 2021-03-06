var userDB = require('./userDB');
var schedule = require('node-schedule');
var activeUserList = new Map();


const bindSocketIoEvent = (io) => {
    schedule.scheduleJob('0 * * * * *', function(){
        var curCheckList = userDB.userSocketList;
        userDB.userSocketList.forEach(function(value, key){
            io.to(value).emit('client-health-check', key);
        });
        setTimeout(function () {
            if (!!curCheckList) {
                var removeUuidList = [];
                curCheckList.forEach(function (value, key) {
                    if (!activeUserList.get(key)) {
                        removeUuidList.push(key);
                        userDB.userSocketList.delete(key);
                    }
                })
                userDB.userList = userDB.userList.filter(function (userinfo) {
                    return !removeUuidList.includes(userinfo.uuid);
                })
                activeUserList = new Map();
                curCheckList = new Map();
            }
        }, 2000);
    });

    io.on('connection', function(socket) {
        console.log("test connect");
        // convenience function to log server messages on the client
        function log() {
            var array = ['Message from server:'];
            array.push.apply(array, arguments);
            // socket.emit('log', array);
        }

        socket.on('registerUserSocket', function(uuid) {
            userDB.userSocketList.set(uuid, socket.id);
            console.log(userDB.userSocketList);
            log('Client said: registerUserSocket:', uuid);
        });

        socket.on('inviteFriend', function(inviteInfo) {
            console.log(inviteInfo);
            var friendSocketId = userDB.userSocketList.get(inviteInfo.friendUuid);
            var mySocketId = userDB.userSocketList.get(inviteInfo.currentUuid);
            socket.to(friendSocketId).emit('confirmInvite', inviteInfo.currentUuid);
            // io.sockets.connected[mySocketId].emit('friendNotOnline', inviteInfo.friendUuid);
            // userDB.userSocketList.set(uuid, socket.id);
        });

        socket.on('confirmInviteReject', function(inviteInfo, roomId) {
            var friendSocketId = userDB.userSocketList.get(inviteInfo.friendUuid);

            socket.to(friendSocketId).emit('receiveReject', roomId);
        });

        socket.on('leave-room', function(roomId) {
            console.log(io.sockets.adapter.rooms);
            if (!!io.sockets.adapter.rooms.get(roomId)) {
                io.sockets.adapter.rooms.get(roomId).clear();
            }
        });

        socket.on('confirm-health-check', function(uuid) {
            activeUserList.set(uuid, socket.id);
        });

        socket.on('apply-destroy-room', function(uuid, roomId) {
            console.log(io.sockets.adapter.rooms.get('6accd0d76f-5765152f56'));
            if(!!uuid && !!userDB.userSocketList.get(uuid)) {
                io.to(userDB.userSocketList.get(uuid)).emit("destroy-second-chat", uuid, roomId);
                io.sockets.adapter.rooms.get(roomId).clear();

            }
        });

        // socket.on('leave-room', function(roomId) {
        //     socket.leave(roomId);
        // });

        socket.on('message', function(message) {
            log('Client said: ', message);
            // for a real app, would be room-only (not broadcast)
            socket.broadcast.emit('message', message);
        });

        socket.on('create or join', function(room) {
            log('Received request to create or join room ' + room);
            log("onlineUserList:" + userDB.userList);
            var clientsInRoom = io.sockets.adapter.rooms.get(room);
            var numClients = clientsInRoom ? clientsInRoom.size : 0;
            log('Room ' + room + ' now has ' + numClients + ' client(s)');

            if (numClients === 0) {
                socket.join(room);
                log('Client ID ' + socket.id + ' created room ' + room);
                socket.emit('created', room, socket.id);

            } else if (numClients === 1) {
                log('Client ID ' + socket.id + ' joined room ' + room);
                io.sockets.in(room).emit('join', room);
                socket.join(room);
                socket.emit('joined', room, socket.id);
                io.sockets.in(room).emit('ready');
            } else { // max two clients
                socket.emit('full', room);
            }
        });

        socket.on('ipaddr', function() {
            var ifaces = os.networkInterfaces();
            for (var dev in ifaces) {
                ifaces[dev].forEach(function(details) {
                    if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
                        socket.emit('ipaddr', details.address);
                    }
                });
            }
        });

        socket.on('bye', function(){
            console.log('received bye');
        });
    })
}

module.exports = bindSocketIoEvent;
