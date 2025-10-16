# TMX API Analysis from JavaScript Bundles

Based on analysis of the extracted JavaScript bundles from the TMX website, here are the key findings:

## Authentication Systems

### 1. QuoteMedia Authentication
- **Bearer Token System**: Uses `X-Stream-DataTool-Token` header
- **Token Example**: `0df0ac71514c2ffeb9439af381a70e62e090c6c4a5aace74f989c0bfcc75c7a9` (found in our existing code)
- **Session Management**: Uses `sid` (session ID) and `wmid` (workspace/client ID)

### 2. TMX PowerStream (WMID: 101020)
- **WMID**: `101020` identified as TMX PowerStream
- **Authentication URL**: `https://cse.quotemedia.com/login.php`
- **Multi-tenant system** with different WMIDs for different clients

### 3. Login Flow
```javascript
// Session validation endpoint
`https://${domain}/auth/v0/session/${wmid}?sid=${sid}`

// Authentication headers
{
  "X-Stream-Sid": sessionId,
  "X-Stream-Wmid": workspaceId,
  "Authorization": bearerToken,
  "X-Stream-DataTool-Token": dataToolToken
}
```

## Streaming Architecture

### 1. WebSocket Implementation
- **Transport**: WebSocket with fallback to streaming
- **Library**: Atmosphere.js framework for real-time messaging
- **Connection**: Uses STOMP protocol over WebSocket
- **URL Pattern**: `${host}/stream` endpoint

### 2. Streaming Configuration
```javascript
{
  transport: "websocket",
  fallbackTransport: "streaming",
  maxReconnectOnClose: 1,
  reconnectInterval: 1000,
  connectTimeout: 60000,
  trackMessageLength: true,
  enableXDR: true
}
```

### 3. Message Headers
```javascript
{
  "X-Stream-isReconnect": boolean,
  "X-Stream-isAlwaysReopen": boolean,
  "X-Stream-isReceiveAllMissedData": true, // or "LATEST"
  "X-Stream-connectionFrom": connectionId
}
```

## API Endpoints

### 1. Base Domains
- **Production**: `app.quotemedia.com`, `web.quotestream.com`
- **Development**: `webdev.web.quotestream.com`
- **Charts**: `qmci-static.s3.us-west-1.amazonaws.com/qm-html5-chart/`
- **Reports**: `reports.quotemedia.com`, `reports.wdev.quotemedia.com`
- **Tearsheets**: `ts.c1.quotemedia.com/tearsheet/`

### 2. Authentication Endpoints
- **Login**: `/p/authenticate/v0/?legacy=false`
- **Session**: `/auth/v0/session/{wmid}?sid={sid}`

### 3. Streaming Endpoints
- **WebSocket**: `/stream/message`
- **Subscription**: `/user/queue/messages`
- **Version Check**: Server version endpoint available

## Data Format & Protocol

### 1. Message Format
- **Primary**: JSON over WebSocket
- **Alternative**: STOMP messaging protocol
- **Conflation**: Supports data conflation settings

### 2. Connection Management
- **Flow Control**: Tracks message sequences
- **Reconnection**: Automatic with configurable intervals  
- **Heart Beat**: Client/server heartbeat mechanism

### 3. Authentication Methods
```javascript
// Multiple auth methods supported:
authenticationMethod: "sid" | "enterprise" | "wmid" | "datatool"

// Headers based on method:
"X-Stream-Sid": sessionId              // for sid
"X-Stream-Wmid": workspaceId           // for wmid/enterprise  
"Authorization": bearerToken           // for enterprise
"X-Stream-DataTool-Token": dataToken   // for datatool
```

## Key Implementation Patterns

### 1. Connection Factory
```javascript
// Creates WebSocket connection with authentication
const connection = streamingService.createConnection();
connection.on("message", handleMessage);
connection.on("sequence", trackSequence);
connection.on("close", handleClose);
connection.on("error", handleError);
```

### 2. Subscription Management
```javascript
// STOMP-style subscriptions
client.subscribe("/user/queue/messages", messageHandler);
client.send("/stream/message", headers, messageData);
```

### 3. URL Construction
```javascript
// Technical chart URL pattern
`https://qmci-static.s3.us-west-1.amazonaws.com/qm-html5-chart/simple-chart.html?symbol=${symbol}&theme=${theme}&trading=${trading}&sid=${sid}&wmid=${wmid}`
```

## Recommended Implementation Strategy

### 1. Authentication Flow
1. Use the existing `datatool` token method we have
2. Implement session validation via `/auth/v0/session/` endpoint
3. Store session data with `wmid` and `sid`

### 2. WebSocket Connection
1. Establish WebSocket to `/stream` endpoint
2. Use Atmosphere.js compatible headers
3. Implement STOMP-style messaging over WebSocket
4. Add automatic reconnection with exponential backoff

### 3. Data Streaming
1. Subscribe to `/user/queue/messages` for real-time data
2. Send subscription requests to `/stream/message`
3. Handle message sequencing and flow control
4. Implement data conflation for performance

### 4. Error Handling
1. Handle authentication failures gracefully
2. Implement connection timeout and retry logic
3. Add proper cleanup on disconnect
4. Monitor connection health with heartbeats

This analysis reveals that TMX uses a sophisticated WebSocket-based streaming system with multiple authentication methods. The existing QuoteMedia integration can be enhanced to match these patterns exactly.