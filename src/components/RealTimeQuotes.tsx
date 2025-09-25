'use client';
import { useEffect, useState } from 'react';
import { Stack, Card, Text, Badge, Group, Title, Paper, ActionIcon, Tooltip, Grid } from '@mantine/core';
import { IconRefresh, IconTrendingUp, IconTrendingDown, IconClock } from '@tabler/icons-react';

interface Quote {
  symbol: string;
  companyName: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  volume: number;
  marketCap: string;
  pe: number | null;
  eps: number | null;
  dividend: number | null;
  yield: number | null;
  beta: number | null;
  week52High: number;
  week52Low: number;
  sharesOutstanding: string;
  exchange: string;
  lastUpdate: string;
  
  // Extended QuoteMedia fields
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  lastSize: number;
  averageVolume: number;
  marketStatus: string;
  premarketPrice: number;
  afterHoursPrice: number;
  premarketChange: number;
  afterHoursChange: number;
  premarketChangePercent: number;
  afterHoursChangePercent: number;
  lastTradeTime: string;
  exchangeTimestamp: string;
  quoteTimestamp: string;
  exchangeLong: string;
  dollarVolume: number;
  
  // Market identification codes
  lastMarketId: string;
  bidMarketId: string;
  askMarketId: string;
}

interface RealTimeQuotesProps {
  symbol?: string;
}

export default function RealTimeQuotes({ symbol = 'AAPL' }: RealTimeQuotesProps) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(30);

  const fetchQuotes = async () => {
    setLoading(true);
    setError(null);
    try {
      // Add timeout and abort controller for better error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(`/api/quotes?symbols=${symbol}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      if (data.success && Array.isArray(data.quotes)) {
        setQuotes(data.quotes);
        setLastUpdate(new Date().toISOString());
      } else {
        throw new Error(data.error || 'Failed to fetch quotes');
      }
    } catch (error) {
      console.error('Error fetching quotes:', error);
      if (error instanceof Error) {
        // Handle different types of errors
        if (error.name === 'AbortError') {
          setError('Request timed out - please try again');
        } else if (error.message.includes('Failed to fetch')) {
          setError('Network error - please check your connection and try again');
        } else if (error.message.includes('authenticate')) {
          setError('Authentication failed - please refresh the page');
        } else {
          setError(`Data error: ${error.message}`);
        }
      } else {
        setError('An unexpected error occurred while fetching quotes');
      }
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    // Initial fetch
    fetchQuotes();
    
    const refreshInterval = setInterval(() => {
      fetchQuotes();
      setCountdown(30); // Reset countdown
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(refreshInterval);
  }, []);

  // Countdown effect
  useEffect(() => {
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return 30; // Reset to 30 when it reaches 0
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, []);

  const formatPrice = (price: number) => {
    if (typeof price !== 'number' || isNaN(price)) return 'N/A';
    return `$${price.toFixed(2)}`;
  };

  const formatChange = (change: number) => {
    if (typeof change !== 'number' || isNaN(change)) return 'N/A';
    return `${change >= 0 ? '+' : ''}${change.toFixed(2)}`;
  };

  const formatPercent = (percent: number) => {
    if (typeof percent !== 'number' || isNaN(percent)) return 'N/A';
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  const formatVolume = (volume: number) => {
    if (typeof volume !== 'number' || isNaN(volume)) return 'N/A';
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(1)}M`;
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}K`;
    }
    return volume.toString();
  };

  const formatDollarVolume = (dollarVolume: number) => {
    if (typeof dollarVolume !== 'number' || isNaN(dollarVolume)) return 'N/A';
    if (dollarVolume >= 1000000000) {
      return `$${(dollarVolume / 1000000000).toFixed(1)}B`;
    } else if (dollarVolume >= 1000000) {
      return `$${(dollarVolume / 1000000).toFixed(1)}M`;
    } else if (dollarVolume >= 1000) {
      return `$${(dollarVolume / 1000).toFixed(1)}K`;
    }
    return `$${dollarVolume.toFixed(0)}`;
  };

  const formatTime = (timestamp: string) => {
    if (!timestamp) return 'N/A';
    try {
      return new Date(timestamp).toLocaleTimeString();
    } catch {
      return timestamp;
    }
  };

  const getMarketStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'open': return 'green';
      case 'closed': return 'red';
      case 'premarket': return 'blue';
      case 'afterhours': return 'orange';
      default: return 'gray';
    }
  };

  const getMarketStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'open': return '🟢';
      case 'closed': return '🔴';
      case 'premarket': return '🔵';
      case 'afterhours': return '🟠';
      default: return '⚫';
    }
  };

  if (error) {
    return (
      <Paper p="xl" withBorder style={{ borderColor: '#ff6b6b', backgroundColor: '#fff5f5' }}>
        <Stack gap="md" align="center">
          <Text c="red" fw={500} size="lg" ta="center">
            ❌ Error loading quotes
          </Text>
          <Text c="dimmed" size="sm" ta="center">
            {error}
          </Text>
          <ActionIcon
            variant="filled"
            size="lg"
            color="red"
            onClick={fetchQuotes}
            loading={loading}
            radius="md"
          >
            <IconRefresh size={20} />
          </ActionIcon>
          <Text size="xs" c="dimmed">
            Click to retry
          </Text>
        </Stack>
      </Paper>
    );
  }

  if (loading && quotes.length === 0) {
    return (
      <Paper p="md" withBorder>
        <Text>🔄 Loading quotes...</Text>
      </Paper>
    );
  }

  if (quotes.length === 0) {
    return (
      <Paper p="md" withBorder>
        <Text>📋 No quotes available</Text>
      </Paper>
    );
  }

  return (
    <Stack gap="lg">
      {/* Enhanced Header with Full Width */}
      <Paper p="xl" withBorder style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        borderRadius: '12px'
      }}>
        <Group justify="space-between" align="center">
          <Group gap="md">
            <IconTrendingUp size={32} />
            <div>
              <Title order={2} style={{ margin: 0, color: 'white' }}>
                Nasdaq Data from QuoteMedia
              </Title>
              <Text size="md" style={{ opacity: 0.9, margin: 0, marginTop: '4px' }}>
                Real-time market data • Updates every 30 seconds
              </Text>
            </div>
          </Group>
          
          <Group gap="md">
            <Tooltip label={`Next refresh in ${countdown}s`}>
              <Group gap="xs" style={{ 
                backgroundColor: 'rgba(255,255,255,0.2)', 
                padding: '12px 16px', 
                borderRadius: '10px' 
              }}>
                <IconClock size={18} />
                <Text size="md" fw={600}>{countdown}s</Text>
              </Group>
            </Tooltip>
            <ActionIcon
              variant="filled"
              size="lg"
              color="rgba(255,255,255,0.2)"
              onClick={fetchQuotes}
              loading={loading}
              style={{ borderRadius: '10px' }}
            >
              <IconRefresh size={20} />
            </ActionIcon>
          </Group>
        </Group>

        {lastUpdate && (
          <Text size="sm" style={{ opacity: 0.8, marginTop: '12px' }}>
            Last updated: {new Date(lastUpdate).toLocaleString()}
          </Text>
        )}
      </Paper>

      {/* Main Quote Cards - Full Width Layout */}
      {quotes.map((quote, index) => (
        <Paper key={`${quote.symbol}-${index}`} p="xl" withBorder radius="lg" style={{ 
          background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
          border: '2px solid #e1e5e9',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}>
          {/* Company Header Section */}
          <Group justify="space-between" align="flex-start" mb="xl">
            <div>
              <Group gap="lg" align="baseline">
                <Title order={1} c="dark" style={{ margin: 0, fontSize: '2.2rem' }}>
                  {quote.symbol}
                </Title>
                <Badge size="xl" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }} radius="md">
                  {quote.exchange}
                </Badge>
              </Group>
              <Text size="xl" fw={500} c="dimmed" mt="sm">
                {quote.companyName}
              </Text>
            </div>
            
            {/* Price Display Section */}
            <div style={{ textAlign: 'right' }}>
              <Title order={1} c="dark" style={{ margin: 0, fontSize: '3rem', fontWeight: 700 }}>
                {formatPrice(quote.price)}
              </Title>
              <Group gap="md" justify="flex-end" mt="sm">
                <Group gap="xs">
                  {quote.change >= 0 ? 
                    <IconTrendingUp size={24} color="green" /> : 
                    <IconTrendingDown size={24} color="red" />
                  }
                  <Text size="xl" fw={700} c={quote.change >= 0 ? 'green' : 'red'}>
                    {formatChange(quote.change)} ({formatPercent(quote.changePercent)})
                  </Text>
                </Group>
              </Group>
            </div>
          </Group>

          {/* Comprehensive Data Grid */}
          <Grid gutter="xl">
            {/* Current Price & Market Status */}
            <Grid.Col span={4}>
              <Card p="lg" withBorder radius="md" style={{ backgroundColor: 'white', height: '100%', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                <Stack gap="md">
                  <Group justify="space-between">
                    <Text size="sm" tt="uppercase" fw={700} c="blue">Market Status</Text>
                    <Badge color={getMarketStatusColor(quote.marketStatus)} variant="filled" size="lg">
                      {getMarketStatusIcon(quote.marketStatus)} {quote.marketStatus || 'Unknown'}
                    </Badge>
                  </Group>
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Bid:</Text>
                      <Text size="lg" fw={600} c="blue">{formatPrice(quote.bid)} × {formatVolume(quote.bidSize)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Ask:</Text>
                      <Text size="lg" fw={600} c="red">{formatPrice(quote.ask)} × {formatVolume(quote.askSize)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Last Size:</Text>
                      <Text size="lg" fw={600}>{formatVolume(quote.lastSize)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Last Trade:</Text>
                      <Text size="sm" fw={500}>{formatTime(quote.lastTradeTime)}</Text>
                    </Group>
                  </Stack>
                </Stack>
              </Card>
            </Grid.Col>

            {/* Daily Trading Range */}
            <Grid.Col span={4}>
              <Card p="lg" withBorder radius="md" style={{ backgroundColor: 'white', height: '100%', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                <Stack gap="md">
                  <Text size="sm" tt="uppercase" fw={700} c="teal">Daily Trading Range</Text>
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Low:</Text>
                      <Text size="lg" fw={600} c="red">{formatPrice(quote.low)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">High:</Text>
                      <Text size="lg" fw={600} c="green">{formatPrice(quote.high)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Open:</Text>
                      <Text size="lg" fw={600}>{formatPrice(quote.open)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Prev Close:</Text>
                      <Text size="lg" fw={600}>{formatPrice(quote.previousClose)}</Text>
                    </Group>
                  </Stack>
                </Stack>
              </Card>
            </Grid.Col>

            {/* Extended Hours Trading */}
            <Grid.Col span={4}>
              <Card p="lg" withBorder radius="md" style={{ backgroundColor: 'white', height: '100%', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                <Stack gap="md">
                  <Text size="sm" tt="uppercase" fw={700} c="purple">Extended Hours</Text>
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Premarket:</Text>
                      <div style={{ textAlign: 'right' }}>
                        <Text size="lg" fw={600}>{formatPrice(quote.premarketPrice)}</Text>
                        <Text size="xs" c={quote.premarketChange >= 0 ? 'green' : 'red'}>
                          {formatChange(quote.premarketChange)} ({formatPercent(quote.premarketChangePercent)})
                        </Text>
                      </div>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">After Hours:</Text>
                      <div style={{ textAlign: 'right' }}>
                        <Text size="lg" fw={600}>{formatPrice(quote.afterHoursPrice)}</Text>
                        <Text size="xs" c={quote.afterHoursChange >= 0 ? 'green' : 'red'}>
                          {formatChange(quote.afterHoursChange)} ({formatPercent(quote.afterHoursChangePercent)})
                        </Text>
                      </div>
                    </Group>
                  </Stack>
                </Stack>
              </Card>
            </Grid.Col>

            {/* Volume & Trading Activity */}
            <Grid.Col span={4}>
              <Card p="lg" withBorder radius="md" style={{ backgroundColor: 'white', height: '100%', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                <Stack gap="md">
                  <Text size="sm" tt="uppercase" fw={700} c="orange">Volume & Trading</Text>
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Volume:</Text>
                      <Text size="lg" fw={600} c="orange">{formatVolume(quote.volume)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Avg Volume:</Text>
                      <Text size="lg" fw={600}>{formatVolume(quote.averageVolume)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Dollar Vol:</Text>
                      <Text size="lg" fw={600} c="green">{formatDollarVolume(quote.dollarVolume)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Market Cap:</Text>
                      <Text size="lg" fw={600}>{quote.marketCap || 'N/A'}</Text>
                    </Group>
                  </Stack>
                </Stack>
              </Card>
            </Grid.Col>

            {/* Financial Metrics */}
            <Grid.Col span={4}>
              <Card p="lg" withBorder radius="md" style={{ backgroundColor: 'white', height: '100%', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                <Stack gap="md">
                  <Text size="sm" tt="uppercase" fw={700} c="indigo">Financial Metrics</Text>
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">P/E Ratio:</Text>
                      <Text size="lg" fw={600}>{quote.pe !== null ? quote.pe.toFixed(2) : 'N/A'}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">EPS:</Text>
                      <Text size="lg" fw={600}>{quote.eps !== null ? `$${quote.eps.toFixed(2)}` : 'N/A'}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Beta:</Text>
                      <Text size="lg" fw={600}>{quote.beta !== null ? quote.beta.toFixed(2) : 'N/A'}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Shares Out:</Text>
                      <Text size="lg" fw={600}>{quote.sharesOutstanding || 'N/A'}</Text>
                    </Group>
                  </Stack>
                </Stack>
              </Card>
            </Grid.Col>

            {/* Dividends & 52-Week Range */}
            <Grid.Col span={4}>
              <Card p="lg" withBorder radius="md" style={{ backgroundColor: 'white', height: '100%', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                <Stack gap="md">
                  <Text size="sm" tt="uppercase" fw={700} c="green">Dividends & 52-Week</Text>
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Dividend:</Text>
                      <Text size="lg" fw={600}>{quote.dividend !== null ? `$${quote.dividend.toFixed(2)}` : 'N/A'}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Yield:</Text>
                      <Text size="lg" fw={600}>{quote.yield !== null ? `${quote.yield.toFixed(2)}%` : 'N/A'}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">52W Range:</Text>
                      <div style={{ textAlign: 'right' }}>
                        <Text size="md" fw={600}>
                          {quote.week52Low > 0 && quote.week52High > 0 
                            ? `${formatPrice(quote.week52Low)}` 
                            : 'N/A'
                          }
                        </Text>
                        <Text size="sm" c="dimmed">to</Text>
                        <Text size="md" fw={600}>
                          {quote.week52Low > 0 && quote.week52High > 0 
                            ? `${formatPrice(quote.week52High)}` 
                            : 'N/A'
                          }
                        </Text>
                      </div>
                    </Group>
                  </Stack>
                </Stack>
              </Card>
            </Grid.Col>
          </Grid>

          {/* Market Identification & Timestamp Details */}
          <Paper p="md" mt="lg" style={{ backgroundColor: 'rgba(240,240,240,0.5)', borderRadius: '8px' }}>
            <Grid>
              <Grid.Col span={6}>
                <Stack gap="xs">
                  <Text size="sm" fw={600} c="dark">Exchange Details</Text>
                  <Group gap="md">
                    <Text size="sm" c="dimmed">Exchange: <strong>{quote.exchangeLong || quote.exchange}</strong></Text>
                    <Text size="sm" c="dimmed">Last Market ID: <strong>{quote.lastMarketId}</strong></Text>
                  </Group>
                  <Group gap="md">
                    <Text size="sm" c="dimmed">Bid Market: <strong>{quote.bidMarketId}</strong></Text>
                    <Text size="sm" c="dimmed">Ask Market: <strong>{quote.askMarketId}</strong></Text>
                  </Group>
                </Stack>
              </Grid.Col>
              <Grid.Col span={6}>
                <Stack gap="xs">
                  <Text size="sm" fw={600} c="dark">Timing Information</Text>
                  <Group gap="md">
                    <Text size="sm" c="dimmed">Last Trade: <strong>{formatTime(quote.lastTradeTime)}</strong></Text>
                  </Group>
                  <Group gap="md">
                    <Text size="sm" c="dimmed">Exchange Time: <strong>{formatTime(quote.exchangeTimestamp)}</strong></Text>
                    <Text size="sm" c="dimmed">Quote Time: <strong>{formatTime(quote.quoteTimestamp)}</strong></Text>
                  </Group>
                </Stack>
              </Grid.Col>
            </Grid>
          </Paper>

          {/* Footer with Last Update */}
          <Group justify="center" mt="xl">
            <Paper p="md" style={{ backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: '8px' }}>
              <Text size="sm" c="dimmed" ta="center">
                <strong>Last trade:</strong> {new Date(quote.lastUpdate).toLocaleString()} • 
                <strong>Exchange:</strong> {quote.exchange}
              </Text>
            </Paper>
          </Group>
        </Paper>
      ))}
    </Stack>
  );
}
