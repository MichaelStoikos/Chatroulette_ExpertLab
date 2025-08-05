import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Login from './Login';
import './App.css';

function App() {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [partnerId, setPartnerId] = useState(null);
  const [partnerUsername, setPartnerUsername] = useState('Partner');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [sessionId, setSessionId] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);

  useEffect(() => {
    const savedSessionId = localStorage.getItem('sessionId');
    const savedUser = localStorage.getItem('user');

    if (savedSessionId && savedUser) {
      setSessionId(savedSessionId);
      setUser(JSON.parse(savedUser));
      setIsAuthenticated(true);
    }
  }, []);

  // Initialize local video when component mounts
  useEffect(() => {
    const initializeLocalVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          console.log('Local video initialized:', stream);
        }
      } catch (error) {
        console.error('Error initializing local video:', error);
      }
    };

    if (isAuthenticated) {
      initializeLocalVideo();
    }

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !sessionId) return;

    // Use Railway URL directly
    const serverUrl = 'https://chatrouletteexpertlab-production.up.railway.app';
    const newSocket = io(serverUrl);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
      newSocket.emit('authenticate', sessionId);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected');
      cleanupWebRTC();
      setIsConnected(false);
      setIsInCall(false);
      setIsSearching(false);
    });

    newSocket.on('authenticated', (data) => {
      console.log('Authenticated as:', data.user.username);
      setUser(data.user);
    });

    newSocket.on('authError', (data) => {
      console.error('Auth error:', data.message);
      handleLogout();
    });

    newSocket.on('matchFound', async (data) => {
      console.log('Match found:', data);
      setRoomId(data.roomId);
      setIsSearching(false);
      setIsInCall(true);
    
      const partnerIndex = data.users.findIndex(id => id !== newSocket.id);
      setPartnerId(data.users[partnerIndex] || 'unknown');
      setPartnerUsername(data.usernames?.[partnerIndex] || 'Partner');
    
      // 🔥 Always initialize WebRTC on both peers here!
      await initializeWebRTC(newSocket, data.roomId);
    
      if (data.isCaller) {
        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);
        newSocket.emit('offer', { roomId: data.roomId, offer });
      }
    });

    newSocket.on('offer', async (data) => {
      // Always initialize media BEFORE setting remote description
      await initializeWebRTC(newSocket, data.roomId);
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
    
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
    
      newSocket.emit('answer', { roomId: data.roomId, answer });
    });

    newSocket.on('answer', async (data) => {
      await peerConnectionRef.current.setRemoteDescription(data.answer);
    });

    newSocket.on('iceCandidate', async (data) => {
      console.log('Received ICE candidate:', data.candidate);
      try {
        await peerConnectionRef.current?.addIceCandidate(data.candidate);
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    });
    

    newSocket.on('partnerLeft', () => {
      console.log('Partner disconnected');
      setIsInCall(false);
      setRoomId(null);
      setPartnerId(null);
      setPartnerUsername('Partner');
      cleanupWebRTC();
    });

    return () => newSocket.close();
  }, [isAuthenticated, sessionId]);

  const initializeWebRTC = async (sock = socket, room = roomId) => {
    if (peerConnectionRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      
      // Set local video stream immediately
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        console.log('Local stream set to video element:', stream);
      }

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      peerConnectionRef.current = pc;

      // ✅ Add tracks to peer connection
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (event) => {
        console.log('ICE candidate:', event.candidate);
        if (event.candidate) {
          sock.emit('iceCandidate', { roomId: room, candidate: event.candidate });
        }
      };
      
      pc.ontrack = (event) => {
        console.log('Received remote track:', event.streams);
        console.log('Remote stream:', event.streams[0]);
        console.log('Remote video element:', remoteVideoRef.current);
        
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          console.log('Remote stream set to video element');
          
          // Force play the video
          remoteVideoRef.current.play()
            .then(() => console.log('Remote video playing successfully'))
            .catch(e => {
              console.warn('Autoplay failed for remote video:', e);
              // Try muted play as fallback
              remoteVideoRef.current.muted = true;
              remoteVideoRef.current.play()
                .then(() => console.log('Remote video playing muted'))
                .catch(e2 => console.error('Muted play also failed:', e2));
            });
        } else {
          console.error('Remote video element or stream not available');
        }
      };
      
      pc.onconnectionstatechange = () => {
        console.log('PeerConnection state:', pc.connectionState);
      };

      pc.oniceconnectionstatechange = () => {
        console.log('ICE state:', pc.iceConnectionState);
      };
      
    } catch (error) {
      console.error('Error initializing WebRTC:', error);
    }
  };

  const cleanupWebRTC = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
  };

  const handleLogin = (newSessionId, newUser) => {
    setSessionId(newSessionId);
    setUser(newUser);
    setIsAuthenticated(true);
    localStorage.setItem('sessionId', newSessionId);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  

  const handleLogout = () => {
    localStorage.clear();
    cleanupWebRTC();
    if (socket) socket.close();
    setSocket(null);
    setUser(null);
    setSessionId(null);
    setIsAuthenticated(false);
    setIsConnected(false);
    setIsInCall(false);
    setIsSearching(false);
  };

  const startSearching = () => {
    if (socket && isConnected) {
      socket.emit('findMatch');
      setIsSearching(true);
    }
  };

  const endCall = () => {
    if (socket) socket.emit('nextUser');
    setIsInCall(false);
    cleanupWebRTC();
  };

  if (!isAuthenticated) return <Login onLogin={handleLogin} />;

  return (
    <div className="app">
      <header className="header">
        <h1>🎥 Chatroulette</h1>
        <div>
          <span>👤 {user?.username}</span>
          {isConnected ? <span>🟢 Connected</span> : <span>🔴 Disconnected</span>}
          <button onClick={handleLogout}>🚪 Logout</button>
        </div>
      </header>

      <main>
        {!isInCall && !isSearching && (
          <button onClick={startSearching}>🚀 Start Chatting</button>
        )}

        {isSearching && (
          <div>
            <p>Searching for a match...</p>
            <button onClick={() => {
              setIsSearching(false);
              socket.emit('cancelSearch');
            }}>Cancel</button>
          </div>
        )}

        {isInCall && (
          <div className="video-container">
            <div>
              <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline 
                muted={false}
                className="remote-video" 
              />
              <div>{partnerUsername}</div>
            </div>
            <div>
              <video 
                ref={localVideoRef} 
                autoPlay 
                muted 
                playsInline 
                className="local-video" 
              />
              <div>{user?.username}</div>
            </div>
            <div className="controls">
              <button onClick={endCall}>❌ End Call</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
