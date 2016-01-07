// Init socket
var socket = io();

// Init getUserMedia
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
// Init peerConnection
RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
// Init sessionDescription
RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;


// Initialize some config variables
var connection = {iceServers:[{'url':'stun:stun.l.google.com:19302'}, {'url': 'turn:homeo@turn.bistri.com:80', 'credential': 'homeo'}]};
var config = { 'optional': [{'DtlsSrtpKeyAgreement': true}, {'RtpDataChannels': true }] };
var constraints = { video : true, audio : true };
var sdpConstraints = {'mandatory': {
								'OfferToReceiveAudio':true,
								'OfferToReceiveVideo':true }};

// Temporary video var
var video = null;
// All video streams
var vidArr = [];
// Local video
var localStream = null;
// PeerConnection storage
var peers = [];
// Active peerConnection
var peerConnection = null;
// Local id
var myId = 0;
// Number of video elements created - skip the server
var numVids = 0;
// Constraint variable for controlling order of events
var iAmOfferer = false;
// Who I talk to
var myTarget = 0;
// Create a div to hold the active video
var bigDiv = document.createElement('div');
bigDiv.id = 'bigVideo';
// Class and dimensions
bigDiv.setAttribute('class', 'full');
bigDiv.width = screen.width / 2.0;
bigDiv.height = bigDiv.width * 500.0 / 666.0;
// Add to page
document.body.appendChild(bigDiv);

document.getElementById("forms").removeAttribute("hidden");
document.getElementById("login").removeAttribute("hidden");
document.getElementById("login").addEventListener("submit", authenticate);

// Get media
navigator.getUserMedia(constraints, gotMedia, errorHandler);		

// Message callbacks
// Disconnect handler
socket.on('someoneLeft', 
				function(dead)
				{
					// Find video
					var parent = document.getElementById('videos');
					var child = document.getElementById('video' + dead + 'div');
					// Destroy video
					parent.removeChild(child);
					// Remove connection
					for(var i = 0; i < peers.length; i ++)
					{
						if(peers[i].id == dead)
							peers.splice(i, 1);
					}
				});

// New user handler
socket.on('newUser', 
				function(newNumUsers)
				{
					// We begin
					if(myId == 0) // We have just connected, so this must be us
					{
						// Register us
						myId = newNumUsers;
						console.log('Me: ' + myId + '!');
						// Enable signaling
						socket.on('message', gotMessageFromServer);
						// Time to receive calls
						iAmOfferer = false;
						// We are probably talking to 1
						myTarget = 1;
					}
					// Another person, here comes chaos
					else
					{
						console.log('Talking to ', newNumUsers);
						// Target them, and await turn to connect
						myTarget = newNumUsers;
					}						
				});
socket.on('authFailed',
				function()
				{
					authenticate();
				});
socket.on('start',
				function(info)
				{
					console.log(info.caller, ' is calling ', info.callto, '; me: ', myId);
					// Is it my turn?
					if(myId == info.caller)
					{
						console.log('Talking to ', info.callto);
						myTarget = info.callto;
						// Begin
						iAmOfferer = true;
						start();
					}
					else if(myId == info.callto)
					{
						console.log('Call from ', info.caller);
						// Talk to the caller!
						myTarget = info.caller;
					}
				});

// Handles logging in
function authenticate()
{
	// Record data
	var rname = document.getElementsByName("roomName")[0].getAttribute("value");
	var uname = document.getElementsByName("userName")[0].getAttribute("value");
	var pass = document.getElementsByName("password")[0].getAttribute("value");
	// Send it to server

	// Hide form
	document.getElementById("login").setAttribute("hidden", true);
}

// Start function - starts streaming, which in turn starts connection process
function start() 
{
	console.log('Starting');
	// Create a peer connection
	peerConnection = new RTCPeerConnection(connection, config);				
	// Remote stream handler
	peerConnection.onaddstream = gotRemoteStream;
	// Attach stream
	peerConnection.addStream(localStream);
	// Begin if we are offerer
	if(iAmOfferer)
		peerConnection.createOffer(gotDescription, errorHandler, sdpConstraints);

	console.log('New peer: ', myTarget);
	// Keep track of connections
	peers.push({pc: peerConnection, id: myTarget});
	
}

// Creates a video div and button with given video v
function createVideoDiv(v)
{
	// Find the video div
	var place = document.getElementById('videos');

	// Create a new div
	var newDiv = document.createElement('div');
	newDiv.id = v.id + 'div';
	// CSS classes
	newDiv.class = 'active';
	newDiv.class = 'passive';
	// Default class - passive
	newDiv.setAttribute('class','passive');
	// Default size
	newDiv.height = v.height;
	newDiv.width =  v.width;
	console.log('Div size: ', newDiv.width, ' by ', newDiv.height);
	
	// Create button
	var button = document.createElement('button');
	button.id = v.id + 'sound';
	// Button classes
	button.class = 'mute_button_unmuted';
	button.class = 'mute_button_muted';
	// Default class - unmuted
	button.setAttribute('class','mute_button_unmuted');

	// Callback: When the button is clicked, it fires an event for that user to mute my video
	button.onclick = function()
							{
								// Change class and emit event
								if(document.getElementById(button.id).getAttribute('class') === 'mute_button_unmuted')
								{
									// Emit to silence
									socket.send(JSON.stringify({sound: 'off', to: v.id.charAt(5), from: myId}));
									document.getElementById(button.id).setAttribute('class','mute_button_muted');
								}
								else
								{
									// Emit to unsilence
									socket.send(JSON.stringify({sound: 'on', to: v.id.charAt(5), from: myId}));
									document.getElementById(button.id).setAttribute('class','mute_button_unmuted');
								}
							};
	// Move button up
	button.style.zIndex = '1';
	// Add button to the div
	newDiv.appendChild(button);
	// Add video to the div
	newDiv.appendChild(v);
	// Append div to the master div
	place.appendChild(newDiv);
}

// Creates a video element with the given url and id
function createVideo(url, id)
{
	// Create a new video element
	var v = document.createElement('video');
	v.id = id;
	// Set video source
	v.src = url;
	// Set video to play
	v.play();
	// Set height and width
	v.width = screen.width / 5.0;
	v.height = v.width * 500.0 / 666.0;	
	console.log(v.width, ' by ', v.height);		
	
	// Callback: When the video is clicked, it is highlihted and its feed is copied to the big video
	v.onclick = function(){
		// Find the video's div
		var theDiv = document.getElementById(v.parentNode.id);
		// Master div
		var parent = theDiv.parentNode;
		// Set all videos to passive
		for(var i = 1; i < parent.childNodes.length; i++)
		{
			parent.childNodes[i].setAttribute('class', 'passive');
		}
		// Set this one to active
		theDiv.setAttribute('class','active');
		// Remove feed from the big video (including any accidental junk feed)
		while(bigDiv.hasChildNodes()){
			bigDiv.removeChild(bigDiv.lastChild);
		}
		// New video container
		var newV = document.createElement('video');
		// Copy feed
		newV.src = v.src;
		// Set id
		newV.id = v.id + 'active';
		// Set to play
		newV.play();
		// Big video size
		newV.height = bigDiv.height;
		newV.width = bigDiv.width;
		// Add feed to the big video div
		bigDiv.appendChild(newV);
	}

	// Create a new video div and append video to it	
	createVideoDiv(v);
}

// Server message handler
function gotMessageFromServer(m) 
{
	// Parse message			
	var signal = JSON.parse(m);
	
	console.log('Pulling up pc with ', signal.from);				
	
	// Find the correct peerConnection
	peerConnection = null;
	for(var i = 0; i < peers.length; i ++)
		if(peers[i].id == signal.from)
			peerConnection = peers[i].pc;
	
	// If we aren't connect, become connect
	if(!peerConnection)
		start();
	

	// Check if we are being sent a remote SDP (answer)
	if(signal.sdp) 	
	{
		console.log('Got remote SDP!');
		// Set remote SDP
		peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp), 
														function() 
														{
																// Create answer if I am not offerer
																if(!iAmOfferer)
																{
																	peerConnection.createAnswer(gotDescription, errorHandler, sdpConstraints);
																}
																// We are ready to begin adding candidates
																peerConnection.onicecandidate = gotIceCandidate;
																console.log('Set remote SDP, procceed with ICE gathering!');
																// Can probably let other people start (no other reliable checkpoint)
																socket.emit('doneConnecting', myId);
														}, errorHandler);

	} 
	// Check if we are being sent a candidate
	else if(signal.candidate) 
	{
		// Create a candidate from the info
		var candidate = new RTCIceCandidate(signal.candidate, signal.sdpMLineIndex);
		// Add the candidate
		peerConnection.addIceCandidate(candidate, function()
																{
																	console.log('Successfully added ICE candidate!');
																}, errorHandler);
	}
	// Check if someone pressed the silence button
	else if(signal.sound)
	{
		video = null;
		// Find video
		for(var i = 0; i < vidArr.length; i ++)
		{
			if(vidArr[i].id == signal.from)
				video = vidArr[i];
		}
		// Check the button state and make sure we do't have null video
		// Take out sound
		if(signal.sound === 'off' && video)
		{
			console.log('Ripping sound');
			// Rip sound
			var arr = video.stream.getAudioTracks();
			while(video.stream.getAudioTracks().length > 0)
				video.stream.removeTrack(arr[0]);
		}
		// Return sound
		else if(video)
		{
			console.log('Returning sound');
			// Return sound
			for(var i = 0; i < video.sound.length; i ++)
				video.stream.addTrack(video.sound[i]);
		}

		// Reset stream
		document.getElementById('video' + signal.from).src = window.URL.createObjectURL(video.stream);
		document.getElementById('video' + signal.from).play();
	}
}

// ICE candidate handler
function gotIceCandidate(event) 
{
	console.log('Got ICE candidate!');
	// Separate the candidate
	var candidate = event.candidate;
	if(event.candidate != null) 
	{
		// Pass it on
		socket.send(JSON.stringify({candidate: candidate, to: myTarget, from: myId}));
	}
}

// Description handler
function gotDescription(description) 
{
	console.log('Setting local and forwarding SDP!');
	// Set local description, and pass it to the server
	peerConnection.setLocalDescription(description, function ()
																	{
	  																	socket.send(JSON.stringify({sdp: description, to: myTarget, from: myId}));
																	}, errorHandler);
}

// Remote stream handler
function gotRemoteStream(event)
{
	console.log('Got stream, creating vid!');
	// Pull URL
	var src = window.URL.createObjectURL(event.stream);
	// Update number of videos
	numVids ++;
	// Create a new video element
	createVideo(src, 'video' + myTarget);
	// Add stream
	vidArr.push({id: myTarget, stream: event.stream, sound: event.stream.getAudioTracks()});
}

// Error handler
function errorHandler(error)
{
	 console.log('Error: ', error);
}

// getUserMedia stream handler
function gotMedia(stream)
{
	console.log('Got local stream');
	// Capture local stream
	localStream = stream;

	// Create local video
	createVideo(window.URL.createObjectURL(localStream), 'localVideo');
}