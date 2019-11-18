const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const io = require('socket.io')();

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(
  express.urlencoded({
    extended: false,
  }),
);

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', socket => {
  socket.on('join', ({ roomNumber }) => {
    const room = io.sockets.adapter.rooms[roomNumber] || {
      sockets: {},
      length: 0,
    };
    const existingUsers = Object.keys(room.sockets);

    socket.join(roomNumber);
    socket.emit('joinComplete', {
      existingUsers,
    });
    if (room.length > 0) {
      socket.broadcast.to(roomNumber).emit('joinNewUser', {
        newUser: socket.id,
      });
    }
  });

  socket.on('sendDescription', ({ target, description }) => {
    io.to(target).emit('sendDescription', {
      target: socket.id,
      description,
    });
  });

  socket.on('sendCandidate', ({ target, candidate }) => {
    io.to(target).emit('sendCandidate', {
      target: socket.id,
      candidate,
    });
  });

  socket.on('whoIsStreamr', () => {
    const roomNumber = Object.keys(socket.rooms)[0];
    const sockets = Object.keys(io.sockets.adapter.rooms[roomNumber].sockets);
    const randomNumber = Math.floor(Math.random() * sockets.length);
    io.in(roomNumber).emit('whoIsStreamr', { streamer: sockets[randomNumber] });
  });

  socket.on('disconnecting', () => {
    const roomNumber = Object.keys(socket.rooms)[0];
    socket.leave(roomNumber);
    socket.broadcast.to(roomNumber).emit('leave', {
      leaveUser: socket.id,
    });
  });
});
app.io = io;

module.exports = app;
