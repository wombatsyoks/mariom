# TMX PowerStream Integration Guide

## Overview
This integration provides access to TMX PowerStream's real-time market data through a modern web interface. The system includes authentication, web streaming analysis, and real-time data extraction capabilities.

## Features

### 1. TMX PowerStream Authentication
- **Location**: `/tmx-streamer`
- **Functionality**: Secure login to TMX PowerStream with session management
- **Environment Variables**: 
  - `TMX_USERNAME=MoltoMario`
  - `TMX_PASSWORD=kYWGf8sJP76nz8k`
  - `TMX_WMID=101020`

### 2. Web Streaming Interface
- **PowerStream Web**: Access to `https://tmxpowerstream.com/powerStreamWeb.php`
- **QuoteStream Analysis**: Automatic detection of iframe URLs and API endpoints
- **Real-time Data**: WebSocket and API endpoint discovery for live market data

### 3. Data Streaming Components
- **Live Data Display**: Real-time market data in tabular format
- **WebSocket Support**: Automatic connection to discovered streaming endpoints
- **API Polling**: Fallback mechanism for REST API data sources
- **Stream Management**: Start/stop controls with automatic reconnection

## Usage Instructions

### Step 1: Authentication
1. Navigate to `/tmx-streamer`
2. Click "Login to TMX PowerStream" (credentials are auto-filled from environment)
3. Wait for successful authentication and session establishment
4. Verify session details are displayed

### Step 2: Access Web Streaming
1. After successful login, the "TMX Web Streaming Interface" section will appear
2. Click "Analyze Stream" to access the PowerStream web interface
3. The system will:
   - Access `powerStreamWeb.php` with your authenticated session
   - Parse the HTML to find QuoteStream iframe URLs
   - Extract WebSocket URLs and API endpoints
   - Display discovered streaming sources

### Step 3: Start Real-time Streaming
1. After analysis is complete, click "Start Streaming"
2. The system will attempt to connect to discovered data sources:
   - **Primary**: WebSocket connections for real-time data
   - **Fallback**: API polling every 2 seconds
3. Live data will appear in the "Live Stream Data" table
4. Use "Stop Streaming" to halt data collection

### Step 4: Open Direct Interface (Optional)
1. Click "Open Web Streamer" to open the QuoteStream interface in a new window
2. This provides direct access to the TMX PowerStream web interface
3. Useful for manual verification and additional functionality

## API Endpoints

### Authentication API
- **Endpoint**: `POST /api/tmx-auth`
- **Purpose**: Authenticate with TMX PowerStream
- **Request**: `{ username, password, wmid }`
- **Response**: Session data with cookies

### Web Streaming API  
- **Endpoint**: `POST /api/tmx-webstream`
- **Purpose**: Access PowerStream web interface and analyze streaming sources
- **Request**: `{ streamType: "analyze" | "all" }`
- **Response**: QuoteStream iframe URL, WebSocket URLs, API endpoints

## Technical Details

### Session Management
- Sessions are managed through HTTP cookies
- Automatic session validation before web streaming access
- Session data includes: sessionId, userId, wmid, forwardURL, expiration

### Data Discovery
The web streaming system automatically discovers:
- **QuoteStream iframe URLs**: Direct access to streaming interface
- **WebSocket endpoints**: For real-time bidirectional communication
- **REST API endpoints**: For polling-based data retrieval
- **Stream configuration**: JavaScript variables and initialization data

### Error Handling
- **Authentication failures**: Clear error messages with retry options
- **Network issues**: Automatic reconnection attempts
- **Session expiration**: Redirect to re-authentication
- **Streaming errors**: Graceful fallback to alternative data sources

## Troubleshooting

### Common Issues

1. **401 Authentication Required**
   - Ensure TMX credentials are set in `.env.local`
   - Log in through the `/tmx-streamer` interface first
   - Check session hasn't expired

2. **No Streaming Sources Found**
   - Verify successful authentication
   - Check if PowerStream web interface has changed
   - Review browser network logs for blocked requests

3. **WebSocket Connection Failed**
   - System will automatically fall back to API polling
   - Check firewall settings for WebSocket connections
   - Verify TMX PowerStream supports WebSocket streaming

4. **No Real-time Data**
   - Ensure market is open (TMX operates during market hours)
   - Check if specific symbols need to be subscribed
   - Verify data permissions with TMX PowerStream account

## Development Notes

### File Structure
```
src/
├── app/
│   ├── tmx-streamer/
│   │   └── page.tsx              # Main TMX interface
│   └── api/
│       ├── tmx-auth/
│       │   └── route.ts          # Authentication endpoint
│       └── tmx-webstream/
│           └── route.ts          # Web streaming analysis
└── components/
    ├── TMXDataExtractor.tsx      # Data extraction utilities
    └── TMXWebStreamer.tsx        # Real-time streaming component
```

### Environment Configuration
Create `.env.local` in project root:
```
TMX_USERNAME=MoltoMario
TMX_PASSWORD=kYWGf8sJP76nz8k
TMX_WMID=101020
```

### Next Steps
- [ ] Implement symbol subscription management
- [ ] Add data filtering and search capabilities
- [ ] Integrate with existing stock dashboard
- [ ] Add historical data retrieval
- [ ] Implement market hours detection
- [ ] Add notification system for significant market events

## Security Considerations

- TMX credentials are stored as environment variables (not in source code)
- Session cookies are HTTP-only and secure
- All TMX communication uses HTTPS
- No sensitive data is logged or exposed in client-side code

For additional support or feature requests, please refer to the project documentation or contact the development team.