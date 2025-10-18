'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  Text,
  Button,
  Group,
  Stack,
  Badge,
  Table,
  ScrollArea,
  Alert,
  LoadingOverlay,
  JsonInput,
  Divider,
  ActionIcon,
  Tooltip,
  Code,
  Select,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconActivity,
  IconRefresh,
  IconPlayerPlay,
  IconPlayerStop,
  IconEye,
  IconCode,
  IconChartLine,
  IconAlertCircle,
} from '@tabler/icons-react';

interface StreamingData {
  symbol?: string;
  price?: number;
  volume?: number;
  change?: number;
  timestamp?: string;
  [key: string]: any;
}

interface TMXStreamData {
  iframe_url?: string;
  websocket_urls?: string[];
  api_endpoints?: string[];
  stream_config?: any;
  raw_html?: string;
  iframe_analysis?: {
    websocket_endpoints?: string[];
    rest_endpoints?: string[];
    streaming_config?: any;
    javascript_vars?: string[];
  };
}

interface TMXWebStreamerProps {
  sessionId?: string;
}

export function TMXWebStreamer({ sessionId }: TMXWebStreamerProps) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamData, setStreamData] = useState<StreamingData[]>([]);
  const [tmxData, setTmxData] = useState<TMXStreamData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRawData, setShowRawData] = useState(false);
  const [dataToolToken, setDataToolToken] = useState<string | null>(null);
  
  // Market session controls
  const [marketSession, setMarketSession] = useState<string>('NORMAL');
  const [statExchange, setStatExchange] = useState<string>('NYE');
  const [stat, setStat] = useState<string>('dv');
  
  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function to fetch fresh datatool token
  const fetchFreshToken = async (): Promise<string> => {
    try {
      const response = await fetch('/api/get-token');
      if (!response.ok) {
        throw new Error(`Token fetch failed: ${response.status}`);
      }
      const data = await response.json();
      if (!data.success || !data.token) {
        throw new Error('Invalid token response');
      }
      setDataToolToken(data.token);
      console.log('✅ Fresh datatool token obtained for client');
      return data.token;
    } catch (error) {
      console.error('❌ Failed to fetch fresh token:', error);
      throw error;
    }
  };

  const accessTMXWebStream = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/tmx-webstream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId || 'demo-session' }),
      });
      
      const data = await response.json();
      
      if (data.success && data.data) {
        setTmxData(data.data);
        
        notifications.show({
          title: 'TMX PowerStream Analyzed',
          message: `Found ${data.data.websocket_urls?.length || 0} WebSocket URLs and ${data.data.api_endpoints?.length || 0} API endpoints`,
          color: 'green',
        });

        // Automatically start streaming if we found any data sources
        if (data.data.websocket_urls?.length || data.data.api_endpoints?.length || data.data.iframe_analysis?.websocket_endpoints?.length || data.data.iframe_analysis?.rest_endpoints?.length) {
          setTimeout(() => {
            startStreaming();
          }, 2000); // Small delay to show the analysis results first
        }
      } else {
        setError(data.error || 'Failed to access TMX PowerStream');
        notifications.show({
          title: 'Access Failed',
          message: data.error || 'Unable to access TMX PowerStream web interface',
          color: 'red',
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      notifications.show({
        title: 'Error',
        message: 'Failed to access TMX web streaming interface',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const startStreaming = async () => {
    // Collect all available streaming sources
    const websocketUrls = [
      ...(tmxData?.websocket_urls || []),
      ...(tmxData?.iframe_analysis?.websocket_endpoints || [])
    ];
    const apiEndpoints = [
      ...(tmxData?.api_endpoints || []),
      ...(tmxData?.iframe_analysis?.rest_endpoints || [])
    ];

    if (!websocketUrls.length && !apiEndpoints.length) {
      notifications.show({
        title: 'No Streaming Sources',
        message: 'Please analyze TMX PowerStream first to find data sources',
        color: 'orange',
      });
      return;
    }

    // Fetch fresh token before starting streaming
    let freshToken: string;
    try {
      freshToken = await fetchFreshToken();
    } catch (error) {
      notifications.show({
        title: 'Token Error',
        message: 'Failed to obtain fresh authentication token',
        color: 'red',
      });
      return;
    }

    setIsStreaming(true);
    
    notifications.show({
      title: 'Starting Real-time Stream',
      message: `Connecting to QuoteMedia API and ${websocketUrls.length} WebSocket(s)`,
      color: 'blue',
      autoClose: 3000,
    });
    
    // Start QuoteMedia streaming first (most reliable)
    startQuoteMediaStream(freshToken);
    
    // Try TMX-style WebSocket connections using patterns from JavaScript analysis
    if (websocketUrls.length) {
      const wsUrl = websocketUrls[0];
      try {
        // Create WebSocket with TMX-compatible subprotocols
        wsRef.current = new WebSocket(wsUrl, ['atmosphere-websocket', 'stomp']);
        
        wsRef.current.onopen = () => {
          notifications.show({
            title: 'TMX WebSocket Connected',
            message: `Connected to TMX real-time stream with STOMP protocol`,
            color: 'green',
          });
          
          // Send TMX-style subscription message using STOMP format
          if (wsRef.current && sessionId) {
            const subscriptionMessage = JSON.stringify({
              command: 'CONNECT',
              headers: {
                'X-Stream-Sid': sessionId,
                'X-Stream-Wmid': '101020',
                'X-Stream-DataTool-Token': freshToken,
                'authenticationMethod': 'datatool',
                'conflation': 'LATEST',
                'rejectExcessiveConnection': 'false'
              }
            });
            
            wsRef.current.send(subscriptionMessage);
            
            // Subscribe to user queue (TMX pattern)
            setTimeout(() => {
              if (wsRef.current) {
                const queueSubscription = JSON.stringify({
                  command: 'SUBSCRIBE',
                  headers: {
                    destination: '/user/queue/messages',
                    id: `sub-${Date.now()}`
                  }
                });
                wsRef.current.send(queueSubscription);
              }
            }, 1000);
          }
        };
        
        wsRef.current.onmessage = (event) => {
          try {
            // Handle TMX STOMP-style messages
            const data = JSON.parse(event.data);
            
            if (data.command === 'CONNECTED') {
              notifications.show({
                title: 'TMX Session Established',
                message: 'STOMP session connected successfully',
                color: 'green',
              });
              return;
            }
            
            if (data.command === 'MESSAGE') {
              // Process TMX market data message
              const marketData = data.body ? JSON.parse(data.body) : data;
              setStreamData(prev => [
                { 
                  ...marketData, 
                  timestamp: new Date().toLocaleTimeString(), 
                  source: 'tmx-websocket',
                  protocol: 'stomp' 
                },
                ...prev.slice(0, 99)
              ]);
            }
          } catch {
            // Handle raw messages
            setStreamData(prev => [
              { 
                raw: event.data, 
                timestamp: new Date().toLocaleTimeString(), 
                source: 'tmx-websocket',
                protocol: 'raw' 
              },
              ...prev.slice(0, 99)
            ]);
          }
        };
        
        wsRef.current.onerror = () => {
          notifications.show({
            title: 'TMX WebSocket Error',
            message: 'TMX WebSocket connection failed, switching to API polling',
            color: 'orange',
          });
          startAPIPolling(apiEndpoints);
        };
        
        wsRef.current.onclose = () => {
          if (isStreaming) {
            notifications.show({
              title: 'TMX WebSocket Closed',
              message: 'TMX connection lost, attempting reconnect in 5s',
              color: 'yellow',
            });
            setTimeout(() => {
              if (isStreaming) startStreaming();
            }, 5000);
          }
        };
      } catch (error) {
        console.error('TMX WebSocket creation failed:', error);
        startAPIPolling(apiEndpoints);
      }
    } else {
      startAPIPolling(apiEndpoints);
    }
  };

  const startQuoteMediaStream = (token?: string) => {
    if (!sessionId) {
      notifications.show({
        title: 'Session Required',
        message: 'Please login to TMX PowerStream first',
        color: 'orange',
      });
      return;
    }

    intervalRef.current = setInterval(async () => {
      try {
        // Use our QuoteMedia proxy API with session credentials and market session parameters
        const symbols = 'SHOP.TO,TD.TO,RY.TO,CNR.TO,SU.TO,NVDA,AAPL,MSFT,GOOGL,TSLA'; // Canadian and US symbols
        const apiUrl = `/api/tmx-quotemedia-proxy?` + new URLSearchParams({
          sessionId: sessionId,
          symbols: symbols,
          marketSession: marketSession,
          statExchange: statExchange,
          stat: stat,
          statTop: '100'
        });
        
        const response = await fetch(apiUrl, {
          credentials: 'include', // Include cookies for TMX session
          headers: {
            'Content-Type': 'application/json'
          }
        });
        const data = await response.json();
        
        // Handle new NASDAQ results structure - only real data
        const quotes = data.results?.quote || data.quotes || [];
        
        if (data.success && quotes.length > 0 && data.source !== 'mock-fallback') {
          // Process the comprehensive NASDAQ QuoteMedia format data with all data points
          quotes.forEach((quote: any, index: number) => {
            setTimeout(() => {
              setStreamData(prev => [
                {
                  // Basic identification (from real QuoteMedia structure)
                  symbol: quote.key?.symbol,
                  symbolid: index + 1, // Generate since not in real data
                  exchange: quote.key?.exchange,
                  exLgName: quote.key?.exLgName,
                  exShName: quote.key?.exShName,
                  timezone: quote.key?.timezone,
                  
                  // Company information (from real QuoteMedia structure)
                  longname: quote.equityinfo?.longname,
                  shortname: quote.equityinfo?.shortname,
                  industry: 'N/A', // Not provided in real API
                  sector: quote.datatype || 'equity',
                  
                  // Market cap and shares from fundamental section
                  marketcap: quote.fundamental?.marketcap,
                  sharesoutstanding: quote.fundamental?.sharesoutstanding,
                  
                  // Price data (from real QuoteMedia structure)
                  price: quote.pricedata?.last,
                  change: quote.pricedata?.change,
                  changepercent: quote.pricedata?.changepercent,
                  tick: quote.pricedata?.tick,
                  open: quote.pricedata?.open,
                  high: quote.pricedata?.high,
                  low: quote.pricedata?.low,
                  prevclose: quote.pricedata?.prevclose,
                  bid: quote.pricedata?.bid,
                  ask: quote.pricedata?.ask,
                  bidsize: quote.pricedata?.bidsize,
                  asksize: quote.pricedata?.asksize,
                  
                  // Volume data (from real QuoteMedia structure)
                  volume: quote.pricedata?.tradevolume,
                  sharevolume: quote.pricedata?.sharevolume,
                  avgvolume: quote.pricedata?.vwapvolume, // Use VWAP volume as proxy
                  vwap: quote.pricedata?.vwap,
                  totalvalue: quote.pricedata?.totalvalue,
                  
                  // Financial metrics from fundamental section
                  pbratio: quote.fundamental?.pbratio,
                  week52high: quote.fundamental?.week52high?.content,
                  week52low: quote.fundamental?.week52low?.content,
                  week52high_date: quote.fundamental?.week52high?.date,
                  week52low_date: quote.fundamental?.week52low?.date,
                  
                  // Status and regulatory info
                  regsho: quote.status?.regsho,
                  effectivedate: quote.status?.effectivedate,
                  
                  // Technical indicators (not available in real API, set to null)
                  rsi: null,
                  macd: null,
                  sma20: null,
                  sma50: null,
                  sma200: null,
                  volatility: null,
                  
                  // Additional real API fields
                  symbolstring: quote.symbolstring,
                  datatype: quote.datatype,
                  entitlement: quote.entitlement,
                  delaymin: quote.delaymin,
                  
                  // Meta data
                  timestamp: new Date().toLocaleTimeString(),
                  tradetime: quote.pricedata?.tradetime,
                  source: data.source || 'TMX PowerStream',
                  raw_quote: quote
                },
                ...prev.slice(0, 99) // Keep last 100 items for memory optimization
              ]);
            }, index * 50); // Stagger updates for smooth animation
          });
          
          notifications.show({
            title: 'Market Data Updated',
            message: `Received ${quotes.length} real-time quotes`,
            color: 'green',
            autoClose: 2000,
          });
        }
      } catch (err) {
        console.error('NASDAQ QuoteMedia streaming error:', err);
        setError(`Failed to fetch NASDAQ market data: ${err instanceof Error ? err.message : 'Unknown error'}`);
        
        notifications.show({
          title: 'Market Data Error',
          message: 'Failed to retrieve real-time market data.',
          color: 'red',
        });
        
        // Stop streaming on error - no mock data fallback
        setIsStreaming(false);
      }
    }, 5000); // Poll every 5 seconds for memory-efficient real-time updates

    notifications.show({
      title: 'Market Stream Started',
      message: 'Connected to real-time market data from multiple exchanges',
      color: 'green',
    });
  };

  const startAPIPolling = (endpoints?: string[]) => {
    const availableEndpoints = endpoints || tmxData?.api_endpoints || [];
    if (!availableEndpoints.length) {
      notifications.show({
        title: 'No API Endpoints',
        message: 'No TMX API endpoints found to poll',
        color: 'orange',
      });
      return;
    }
    
    notifications.show({
      title: 'TMX API Polling Started',
      message: `Polling ${availableEndpoints.length} TMX endpoint(s) with authentication`,
      color: 'blue',
    });
    
    intervalRef.current = setInterval(async () => {
      try {
        // Poll all available TMX API endpoints with proper authentication
        for (const endpoint of availableEndpoints) {
          const response = await fetch(endpoint, {
            headers: {
              'X-Stream-Sid': sessionId || '',
              'X-Stream-Wmid': '101020', // TMX PowerStream WMID
              'X-Stream-DataTool-Token': dataToolToken || '0df0ac71514c2ffeb9439af381a70e62e090c6c4a5aace74f989c0bfcc75c7a9',
              'Authorization': `Bearer ${sessionId || ''}`,
              'accept': 'application/json',
              'user-agent': 'TMX-PowerStream-Client/1.0'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            
            // Process TMX-style data if it's real and not empty
            if (data && data.success && (data.results?.quote?.length > 0 || data.quotes?.length > 0)) {
              setStreamData(prev => [
                { 
                  ...data, 
                  timestamp: new Date().toLocaleTimeString(), 
                  source: 'tmx-api',
                  endpoint: endpoint,
                  authenticated: true 
                },
                ...prev.slice(0, 99)
              ]);
            }
          } else {
            console.warn('TMX API polling failed for endpoint:', endpoint, response.status);
          }
        }
      } catch (err) {
        console.error('TMX API polling error:', err);
      }
    }, 3000); // Poll every 3 seconds for better performance
  };



  const stopStreaming = () => {
    setIsStreaming(false);
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    notifications.show({
      title: 'Streaming Stopped',
      message: 'Data streaming has been stopped',
      color: 'blue',
    });
  };

  const clearData = () => {
    setStreamData([]);
    setTmxData(null);
    setError(null);
    
    // Force garbage collection hint for browsers that support it
    if (typeof window !== 'undefined' && (window as any).gc) {
      (window as any).gc();
    }
  };

  // Memory optimization: Periodic cleanup to prevent memory leaks
  useEffect(() => {
    if (!isStreaming) return;
    
    const memoryCleanup = setInterval(() => {
      setStreamData(prev => {
        // Keep only the most recent data and clean up old entries
        const recentData = prev.slice(0, 50); // Even more aggressive cleanup
        
        // Clear references in old data to help GC
        prev.slice(50).forEach(item => {
          if (item.raw_quote) {
            delete item.raw_quote;
          }
        });
        
        return recentData;
      });
    }, 30000); // Clean up every 30 seconds
    
    return () => clearInterval(memoryCleanup);
  }, [isStreaming]);

  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, []);

  // Auto-start QuoteMedia streaming when sessionId is provided
  useEffect(() => {
    if (sessionId && !isStreaming) {
      console.log('🚀 Auto-starting QuoteMedia streaming with sessionId:', sessionId);
      
      // Small delay to let the component mount properly
      setTimeout(() => {
        setIsStreaming(true);
        startQuoteMediaStream();
        
        notifications.show({
          title: 'Auto-Stream Started',
          message: 'Multi-exchange real-time streaming initiated automatically',
          color: 'green',
          autoClose: 3000,
        });
      }, 1500);
    }
  }, [sessionId, isStreaming]);

  return (
    <Stack gap="md">
      <Card withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Text size="lg" fw={700}>TMX PowerStream Web Interface</Text>
            <Group>
              <Button
                leftSection={<IconEye size={16} />}
                variant="light"
                onClick={accessTMXWebStream}
                loading={loading}
              >
                Analyze Stream
              </Button>
              
              {!isStreaming ? (
                <Button
                  leftSection={<IconPlayerPlay size={16} />}
                  color="green"
                  onClick={startStreaming}
                  disabled={!tmxData}
                >
                  Start Streaming
                </Button>
              ) : (
                <Button
                  leftSection={<IconPlayerStop size={16} />}
                  color="red"
                  onClick={stopStreaming}
                >
                  Stop Streaming
                </Button>
              )}
              
              <ActionIcon
                variant="light"
                onClick={clearData}
                disabled={loading || isStreaming}
              >
                <IconRefresh size={16} />
              </ActionIcon>
            </Group>
          </Group>

          {/* Market Session Controls */}
          <Group>
            <Select
              label="Market Session"
              value={marketSession}
              onChange={(value) => setMarketSession(value || 'NORMAL')}
              data={[
                { value: 'PRE', label: 'Pre-Market' },
                { value: 'NORMAL', label: 'Normal Trading' },
                { value: 'POST', label: 'After-Hours' },
              ]}
              w={150}
            />
            
            <Select
              label="Exchange"
              value={statExchange}
              onChange={(value) => setStatExchange(value || 'NYE')}
              data={[
                { value: 'NYE', label: 'NYSE' },
                { value: 'NSD', label: 'NASDAQ' },
                { value: 'NGS', label: 'NASDAQ GS' },
                { value: 'AMX', label: 'AMEX' },
                { value: 'TSX', label: 'TSX' },
              ]}
              w={150}
            />
            
            <Select
              label="Market Stat"
              value={stat}
              onChange={(value) => setStat(value || 'dv')}
              data={[
                { value: 'dv', label: 'Daily Volume' },
                { value: 'pct', label: 'Percent Change' },
                { value: 'vol', label: 'Volume' },
                { value: 'price', label: 'Price' },
              ]}
              w={150}
            />
          </Group>

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red">
              {error}
            </Alert>
          )}

          <LoadingOverlay visible={loading} />
        </Stack>
      </Card>

      {tmxData && (
        <Card withBorder>
          <Stack gap="sm">
            <Group justify="space-between">
              <Text size="md" fw={600}>Stream Analysis Results</Text>
              <Group>
                <Badge color="blue" variant="light">
                  {tmxData.websocket_urls?.length || 0} WebSockets
                </Badge>
                <Badge color="green" variant="light">
                  {tmxData.api_endpoints?.length || 0} API Endpoints
                </Badge>
                <ActionIcon
                  variant="light"
                  onClick={() => setShowRawData(!showRawData)}
                >
                  <IconCode size={16} />
                </ActionIcon>
              </Group>
            </Group>

            {tmxData.iframe_url && (
              <Group>
                <Text size="sm" c="dimmed">QuoteStream URL:</Text>
                <Code>{tmxData.iframe_url}</Code>
              </Group>
            )}

            {tmxData.websocket_urls && tmxData.websocket_urls.length > 0 && (
              <Box>
                <Text size="sm" fw={500} mb="xs">WebSocket URLs:</Text>
                <Stack gap="xs">
                  {tmxData.websocket_urls.map((url, idx) => (
                    <Code key={idx} block>{url}</Code>
                  ))}
                </Stack>
              </Box>
            )}

            {tmxData.api_endpoints && tmxData.api_endpoints.length > 0 && (
              <Box>
                <Text size="sm" fw={500} mb="xs">API Endpoints:</Text>
                <Stack gap="xs">
                  {tmxData.api_endpoints.map((endpoint, idx) => (
                    <Code key={idx} block>{endpoint}</Code>
                  ))}
                </Stack>
              </Box>
            )}

            {showRawData && tmxData.stream_config && (
              <Box>
                <Divider my="sm" />
                <JsonInput
                  label="Stream Configuration"
                  value={JSON.stringify(tmxData.stream_config, null, 2)}
                  readOnly
                  autosize
                  minRows={4}
                />
              </Box>
            )}
          </Stack>
        </Card>
      )}

      {streamData.length > 0 && (
        <Card withBorder>
          <Stack gap="sm">
            <Group justify="space-between">
              <Group>
                <Text size="md" fw={600}>Real Market Data</Text>
                <Badge color="green" variant="filled" size="sm">
                  NYSE • NASDAQ • NGS
                </Badge>
              </Group>
              <Group>
                <Badge 
                  color={isStreaming ? "green" : "gray"}
                  variant={isStreaming ? "filled" : "light"}
                  leftSection={<IconActivity size={12} />}
                >
                  {isStreaming ? "Live Stream" : "Stopped"}
                </Badge>
                <Text size="sm" c="dimmed">
                  {streamData.length} companies • No mock data
                </Text>
              </Group>
            </Group>

            <ScrollArea h={500}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Time</Table.Th>
                    <Table.Th>Symbol</Table.Th>
                    <Table.Th>Company</Table.Th>
                    <Table.Th>Price</Table.Th>
                    <Table.Th>Change</Table.Th>
                    <Table.Th>Volume</Table.Th>
                    <Table.Th>Bid/Ask</Table.Th>
                    <Table.Th>High/Low</Table.Th>
                    <Table.Th>P/B Ratio</Table.Th>
                    <Table.Th>52W Range</Table.Th>
                    <Table.Th>Market Cap</Table.Th>
                    <Table.Th>VWAP</Table.Th>
                    <Table.Th>Exchange</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {streamData.slice(0, 100).map((item, idx) => (
                    <Table.Tr key={idx} style={{ fontSize: '11px' }}>
                      <Table.Td>
                        <Text size="xs" c="dimmed">{item.timestamp}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" fw={600} c="blue">{item.symbol || 'N/A'}</Text>
                        <Text size="xs" c="dimmed">{item.exchange}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" fw={500}>{item.shortname || item.longname || 'N/A'}</Text>
                        <Text size="xs" c="dimmed">{item.datatype || 'equity'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" fw={600}>{item.price ? `$${item.price.toFixed(4)}` : 'N/A'}</Text>
                        <Text size="xs" c="dimmed">Prev: ${item.prevclose?.toFixed(4) || 'N/A'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text 
                          size="xs" 
                          fw={500}
                          c={item.change && item.change > 0 ? 'green' : item.change && item.change < 0 ? 'red' : undefined}
                        >
                          {item.change ? `${item.change > 0 ? '+' : ''}${item.change.toFixed(4)}` : 'N/A'}
                        </Text>
                        <Text 
                          size="xs" 
                          c={item.changepercent && item.changepercent > 0 ? 'green' : item.changepercent && item.changepercent < 0 ? 'red' : 'dimmed'}
                        >
                          {item.changepercent ? `(${item.changepercent.toFixed(2)}%)` : 'N/A'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">{item.volume ? item.volume.toLocaleString() : 'N/A'}</Text>
                        <Text size="xs" c="dimmed">Shares: {item.sharevolume ? item.sharevolume.toLocaleString() : 'N/A'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">{item.bid?.toFixed(2) || 'N/A'} / {item.ask?.toFixed(2) || 'N/A'}</Text>
                        <Text size="xs" c="dimmed">Size: {item.bidsize || 0}/{item.asksize || 0}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="green">H: ${item.high?.toFixed(2) || 'N/A'}</Text>
                        <Text size="xs" c="red">L: ${item.low?.toFixed(2) || 'N/A'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">{item.pbratio?.toFixed(3) || 'N/A'}</Text>
                        <Text size="xs" c="dimmed">P/B Ratio</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="green">${item.week52high?.toFixed(2) || 'N/A'}</Text>
                        <Text size="xs" c="red">${item.week52low?.toFixed(2) || 'N/A'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">{item.marketcap ? `$${(item.marketcap / 1e6).toFixed(1)}M` : 'N/A'}</Text>
                        <Text size="xs" c="dimmed">{item.sharesoutstanding ? `${(item.sharesoutstanding / 1e6).toFixed(1)}M shs` : 'N/A'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">{item.vwap?.toFixed(4) || 'N/A'}</Text>
                        <Text size="xs" c="dimmed">VWAP</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="xs" variant="light" color="blue">
                          {item.exShName || item.exchange || 'N/A'}
                        </Badge>
                        <Text size="xs" c="dimmed">{item.timezone || ''}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}