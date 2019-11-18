const socket = io();
const rtcPeerConnections = [];
const ROOM_NUMBER = 1111;
let localStream;
let localVideo;

const mediaConstraints = {
  video: true,
  audio: false,
};

const peerConnectionConfig = {
  iceServers: [
    { urls: 'stun:stun.services.mozilla.com' },
    { urls: 'stun:stun.l.google.com:19302' },
    {
      url: 'turn:numb.viagenie.ca',
      credential: 'muazkh',
      username: 'webrtc@live.com',
    },
  ],
};

const setLocalStream = async () => {
  if (!navigator.mediaDevices.getUserMedia) {
    alert('Your browser does not support getUserMedia API');
    return;
  }
  localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
  // console.log(localStream);
  // socket.emit('registerStream', {
  //   stream: localStream.id,
  //   roomNumber: ROOM_NUMBER,
  // });
};

const createRTCPeerConnections = async user => {
  rtcPeerConnections[user] = {
    peerConnection: new RTCPeerConnection(peerConnectionConfig),
    stream: null,
  };

  rtcPeerConnections[user].peerConnection.onicecandidate = event => {
    if (!event.candidate) return;
    socket.emit('sendCandidate', {
      target: user,
      candidate: event.candidate,
    });
  };

  rtcPeerConnections[user].peerConnection.ontrack = event => {
    [rtcPeerConnections[user].stream] = event.streams;
    console.log('onTrack', rtcPeerConnections[user].stream);
  };

  rtcPeerConnections[user].peerConnection.addTrack(
    localStream.getTracks()[0],
    localStream,
  );
};

const createOffersOrAnswers = async (offerOrAnswer, user) => {
  console.log('offerOrAnswer', offerOrAnswer);
  const description =
    offerOrAnswer === 'offer'
      ? await rtcPeerConnections[user].peerConnection.createOffer()
      : await rtcPeerConnections[user].peerConnection.createAnswer();

  await rtcPeerConnections[user].peerConnection.setLocalDescription(
    description,
  );

  socket.emit('sendDescription', {
    target: user,
    description,
  });
};

const joinCompleteHandler = async ({ existingUsers }) => {
  console.log('existingUsers', existingUsers);
  await setLocalStream();
  existingUsers.forEach(createRTCPeerConnections);
  existingUsers.forEach(createOffersOrAnswers.bind(this, 'offer'));
};

const joinNewUserHandler = async ({ newUser }) => {
  await createRTCPeerConnections(newUser);
};

const sendDescriptionHandler = async ({ target, description }) => {
  console.log(`${target} ${description.type} 등록`);
  await rtcPeerConnections[target].peerConnection.setRemoteDescription(
    new RTCSessionDescription(description),
  );
  if (description.type === 'answer') return;
  await createOffersOrAnswers('answer', target);
};

const sendCandidateHandler = async ({ target, candidate }) => {
  console.log(`${target} candidate`);
  const rtcIceCandidate = new RTCIceCandidate(candidate);
  await rtcPeerConnections[target].peerConnection.addIceCandidate(
    rtcIceCandidate,
  );
};

const whoIsStreamrHandler = ({ streamer }) => {
  localVideo = document.querySelector('video');
  localVideo.srcObject = rtcPeerConnections[streamer]
    ? rtcPeerConnections[streamer].stream
    : localStream;
};

const leaveUserHandler = ({ leaveUser }) => {
  delete rtcPeerConnections[leaveUser];
  socket.emit('whoIsStreamr');
};

const initSocketEvents = () => {
  socket.emit('join', {
    roomNumber: ROOM_NUMBER,
  });

  // register events
  socket.on('joinComplete', joinCompleteHandler);
  socket.on('joinNewUser', joinNewUserHandler);
  socket.on('sendDescription', sendDescriptionHandler);
  socket.on('sendCandidate', sendCandidateHandler);
  socket.on('whoIsStreamr', whoIsStreamrHandler);
  socket.on('leave', leaveUserHandler);
};

const registerChangeStreamerButtonEvent = () => {
  const changeStreamerButton = document.querySelector(
    '.change-streamer-button',
  );
  changeStreamerButton.addEventListener('click', () => {
    socket.emit('whoIsStreamr');
  });
};

initSocketEvents();
registerChangeStreamerButtonEvent();
