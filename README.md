# 🎥 Chatroulette Web Application

A modern Chatroulette-style web application built with Node.js, React, and WebRTC for real-time video chat with random users.

## Features

- 🎥 Real-time video chat using WebRTC
- 🔄 Random user matching
- 📱 Responsive design for mobile and desktop
- ⚡ Fast and modern UI with smooth animations
- 🔒 Secure peer-to-peer connections
- 🎨 Beautiful gradient design with glassmorphism effects

## Tech Stack

- **Frontend**: React 19, Vite
- **Backend**: Node.js, Express
- **Real-time Communication**: Socket.IO
- **Video/Audio**: WebRTC
- **Styling**: Modern CSS with gradients and animations

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Modern web browser with WebRTC support
- Camera and microphone access

## Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd Chatroulette_ExpertLab
```

### 2. Install server dependencies
```bash
cd server
npm install
```

### 3. Install client dependencies
```bash
cd ../client/chatroulette
npm install
```

## Running the Application

### 1. Start the server
```bash
cd server
npm start
```
The server will run on `http://localhost:3001`

### 2. Start the client (in a new terminal)
```bash
cd client/chatroulette
npm run dev
```
The client will run on `http://localhost:5173`

### 3. Open your browser
Navigate to `http://localhost:5173` and allow camera/microphone permissions when prompted.

## How to Use

1. **Connect**: The app will automatically connect to the server
2. **Start Chatting**: Click the "Start Chatting" button to find a random partner
3. **Video Chat**: Once matched, you'll see both your video and your partner's video
4. **Next User**: Click "Next" to skip to another random user
5. **End Call**: Click "End Call" to stop the current session

## Project Structure

```
Chatroulette_ExpertLab/
├── server/
│   ├── app.js              # Express server with Socket.IO
│   └── package.json        # Server dependencies
├── client/
│   └── chatroulette/
│       ├── src/
│       │   ├── App.jsx     # Main React component
│       │   ├── App.css     # Styles
│       │   └── main.jsx    # React entry point
│       ├── package.json    # Client dependencies
│       └── vite.config.js  # Vite configuration
└── README.md
```

## WebRTC Implementation

The application uses WebRTC for peer-to-peer video communication:

- **STUN Servers**: Google's public STUN servers for NAT traversal
- **Signaling**: Socket.IO handles WebRTC signaling (offer/answer/ICE candidates)
- **Media Streams**: Camera and microphone access via `getUserMedia()`
- **Peer Connections**: Direct peer-to-peer video/audio streaming

## Security Features

- CORS configuration for secure cross-origin requests
- WebRTC peer-to-peer encryption
- No video data stored on the server
- Secure signaling through Socket.IO

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## Troubleshooting

### Camera/Microphone Access Issues
- Ensure your browser has permission to access camera and microphone
- Check that no other applications are using your camera
- Try refreshing the page and allowing permissions again

### Connection Issues
- Check that both server and client are running
- Ensure firewall isn't blocking the connections
- Verify you're using HTTPS in production (required for WebRTC)

### Video Quality Issues
- Check your internet connection
- Ensure good lighting for better video quality
- Close other bandwidth-intensive applications

## Development

### Adding Features
- **Text Chat**: Add Socket.IO events for text messaging
- **Screen Sharing**: Implement WebRTC screen sharing
- **Filters**: Add video filters using Canvas API
- **Recording**: Implement call recording functionality

### Deployment
1. Build the React app: `npm run build`
2. Deploy the server to your hosting platform
3. Update the Socket.IO connection URL in the client
4. Ensure HTTPS is enabled (required for WebRTC)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use this project for educational or commercial purposes.

## Support

If you encounter any issues or have questions, please open an issue on the repository.
