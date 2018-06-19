var express = require('express');
var app = express();
var fs = require('fs');
var open = require('open');
var options = {
  key: fs.readFileSync('./fake-keys/privatekey.pem'),
  cert: fs.readFileSync('./fake-keys/certificate.pem')
};
var serverPort = (process.env.PORT  || 4443);
var https = require('https');
var http = require('http');
var server;
if (process.env.LOCAL) {
  server = https.createServer(options, app);
} else {
  server = http.createServer(app);
}
var io = require('socket.io')(server);

var roomList = {};

function sendTo(connection, message) {
  connection.send(message);
}

app.get('/', function(req, res){
  console.log('get /');
  res.sendFile(__dirname + '/index.html');
});
server.listen(serverPort, function(){
  console.log('server up and running at %s port', serverPort);
  if (process.env.LOCAL) {
    open('https://localhost:' + serverPort)
  }
});

function socketIdsInRoom(name) {
  var socketIds = io.nsps['/'].adapter.rooms[name];
  if (socketIds) {
    var collection = [];
    for (var key in socketIds) {
      collection.push(key);
    }
    return collection;
  } else {
    return [];
  }
}

io.on('connection', function(socket){

  console.log('connection');
  console.log(socket.id);

  socket.on('disconnect', function(){
    console.log('disconnect');
    if (socket.room) {
      var room = socket.room;
      io.to(room).emit('leave', socket.id);
      socket.leave(room);
    }
  });

  socket.on('join', function(name, callback){
    console.log('join', name);
    var socketIds = socketIdsInRoom(name);
    callback(socketIds);
    socket.join(name);
    socket.room = name;
  });

  socket.on('leave', function(name, callback){
    if (socket.room) {
      var room = socket.room;
      io.to(room).emit('leave', socket.id);
      console.log('leave', room);
      console.log('id:', socket.id);
      socket.leave(room);
    }
  });

  socket.on('exchange', function(data){
    console.log('exchange', data);
    data.from = socket.id;
    var to = io.sockets.connected[data.to];
    to.emit('exchange', data);
  });

  socket.on('message', function(message){
    var data = message;
    switch (data.type) {
      // -----------------------------------------------------------
    case "login":
      console.log("User logged", data.name);
         sendTo(socket, {
            type: "login",
            success: true,
            username: data.name,
            socketid: socket.id
            // userlist: templist
         });
      break;
      // -----------------------------------------------------------      
      case "call_user":
      // chek if user exist
        if(sockets[data.name]){
          console.log("user called");
          console.log(data.name);
          console.log(data.callername);
        sendTo(sockets[data.name], {
           type: "answer",
           callername: data.callername
        });
      }else{
        sendTo(socket, {
           type: "call_response",
           response: "offline"
        });
      }
      break;
      // -----------------------------------------------------------
      case "call_accepted":
      sendTo(sockets[data.callername], {
         type: "call_response",
         response: "accepted",
         responsefrom : data.from

      });
      break;
      // -----------------------------------------------------------
      case "call_rejected":
      sendTo(sockets[data.callername], {
         type: "call_response",
         response: "rejected",
         responsefrom : data.from
      });
      break;
      // -----------------------------------------------------------
      case "call_busy":
      sendTo(sockets[data.callername], {
         type: "call_response",
         response: "busy",
         responsefrom : data.from
      });
      default:
      sendTo(socket, {
         type: "error",
         message: "Command not found: " + data.type
      });
      break;
    }
  });

});
