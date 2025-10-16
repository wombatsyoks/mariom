'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Stack, Text, Badge, Group, Title, Paper, ActionIcon, Tooltip, Table, ScrollArea, Select, Grid } from '@mantine/core';
import { IconRefresh, IconTrendingUp, IconTrendingDown, IconClock, IconFilter } from '@tabler/icons-react';

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
  
  // Extended QuoteMedia pricedata fields
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  rawBidSize: number;
  rawAskSize: number;
  tradevolume: number;
  sharevolume: number;
  vwap: number;
  vwapvolume: number;
  tick: number;
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
  const [countdown, setCountdown] = useState(10);
  const [isVisible, setIsVisible] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  // Filter states
  const [marketSession, setMarketSession] = useState('NORMAL');
  const [statType, setStatType] = useState('dv');
  const [exchange, setExchange] = useState('US');
  const [statTop, setStatTop] = useState('100');
  const [marketCategory, setMarketCategory] = useState('Market Movers');

  // Refs for intervals and lifecycle to ensure proper cleanup and to avoid
  // including volatile state in callback dependency arrays which can cause
  // frequent re-creations and effect churn (leading to memory/CPU spikes).
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false); // Guard against concurrent fetches
  const loadingRef = useRef(loading);
  const debounceTimeoutRef = useRef<number | null>(null);

  // Filter options based on QuoteMedia interface
  const marketSessionOptions = [
    { value: 'NORMAL', label: 'Normal Hours' },
    { value: 'PRE', label: 'Pre-Market' },
    { value: 'POST', label: 'Post-Market' }
  ];

  const statTypeOptions = [
    { value: 'va', label: 'Dollar Value (va)' },
    { value: 'dv', label: 'Dollar Volume (dv)' },
    { value: 'dg', label: 'Dollar Gainers (dg)' },
    { value: 'dl', label: 'Dollar Losers (dl)' },
    { value: 'pg', label: 'Percent Gainers (pg)' },
    { value: 'pl', label: 'Percent Losers (pl)' },
    { value: 'ah', label: 'After Hours Gainers (ah)' },
    { value: 'al', label: 'After Hours Losers (al)' }
  ];

  const exchangeOptions = [
    { value: 'US', label: 'US Markets' },
    { value: 'NSD', label: 'NASDAQ' },
    { value: 'NYE', label: 'NYSE' },
    { value: 'AMX', label: 'AMEX' },
    { value: 'OTO', label: 'OTC' },
    { value: 'TSX', label: 'TSX' },
    { value: 'TSXV', label: 'TSX Venture' },
    { value: 'CNQ', label: 'Canadian NSX' },
    { value: 'LSE', label: 'London Stock Exchange' }
  ];

  const statTopOptions = [
    { value: '25', label: 'Top 25' },
    { value: '50', label: 'Top 50' },
    { value: '100', label: 'Top 100' },
    { value: '250', label: 'Top 250' },
    { value: '500', label: 'Top 500' }
  ];

  const marketCategoryOptions = [
    { value: 'Market Overview', label: 'Market Overview' },
    { value: 'Market Indices', label: 'Market Indices' },
    { value: 'Market Movers', label: 'Market Movers' },
    { value: 'Market Performers', label: 'Market Performers' },
    { value: 'Market Heatmaps', label: 'Market Heatmaps' },
    { value: 'Market Forex', label: 'Market Forex' },
    { value: 'Market Rates', label: 'Market Rates' },
    { value: 'Market Calendars', label: 'Market Calendars' },
    { value: 'Market Options', label: 'Market Options' },
    { value: 'Market Industries', label: 'Market Industries' },
    { value: 'Market Constituents', label: 'Market Constituents' },
    { value: 'Market Filings', label: 'Market Filings' }
  ];

  // Memory management: limit the number of quotes stored
  const MAX_QUOTES = 100; // Limit to prevent memory accumulation (UI cap)

  const fetchQuotes = useCallback(async () => {
    // Guard: don't fetch if hidden/paused or if a fetch is already in-flight
    if (!isVisible || isPaused || isFetchingRef.current) return;

    // Mark fetching
    isFetchingRef.current = true;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    // Abort previous request if still pending
    if (abortControllerRef.current) {
      try { abortControllerRef.current.abort(); } catch {}
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const url = `/api/tmx-quotemedia-proxy?marketSession=${marketSession}&stat=${statType}&statTop=${statTop}&exchange=${exchange}&category=${encodeURIComponent(marketCategory)}`;
      const response = await fetch(url, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      if (data.success && Array.isArray(data.quotes)) {
        // Memory optimization: limit and clean data based on statTop filter
        const maxQuotes = Math.min(Number(statTop) || MAX_QUOTES, 500); // Cap at 500 for safety
        // Only keep essential fields to reduce memory footprint
        const cleanedQuotes = data.quotes.slice(0, maxQuotes).map((quote: any) => ({
          symbol: quote.symbol || 'N/A',
          companyName: quote.companyName || 'N/A',
          price: Number(quote.price) || 0,
          change: Number(quote.change) || 0,
          changePercent: Number(quote.changePercent) || 0,
          open: Number(quote.open) || 0,
          high: Number(quote.high) || 0,
          low: Number(quote.low) || 0,
          previousClose: Number(quote.previousClose) || 0,
          bid: Number(quote.bid) || 0,
          ask: Number(quote.ask) || 0,
          bidSize: Number(quote.bidSize) || 0,
          askSize: Number(quote.askSize) || 0,
          rawBidSize: Number(quote.rawBidSize) || 0,
          rawAskSize: Number(quote.rawAskSize) || 0,
          tradevolume: Number(quote.tradevolume) || 0,
          sharevolume: Number(quote.sharevolume) || Number(quote.volume) || 0,
          volume: Number(quote.sharevolume) || Number(quote.volume) || 0,
          vwap: Number(quote.vwap) || 0,
          vwapvolume: Number(quote.vwapvolume) || 0,
          tick: Number(quote.tick) || 0,
          exchange: quote.exchange || 'US',
          lastTradeTime: quote.lastTradeTime || new Date().toISOString()
        }));
        // Replace state in one update - keep array reference small
        if (isMountedRef.current) {
          setQuotes(cleanedQuotes);
          setLastUpdate(new Date().toISOString());
        }
      } else {
        throw new Error(data.error || 'Failed to fetch quotes');
      }
    } catch (error) {
      // Only set error if the request wasn't aborted
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error fetching quotes:', error);
        if (error.message.includes('Failed to fetch')) {
          setError('Network error - please check your connection and try again');
        } else if (error.message.includes('authenticate')) {
          setError('Authentication failed - please refresh the page');
        } else {
          setError(`Data error: ${error.message}`);
        }
      }
    } finally {
      isFetchingRef.current = false;
      loadingRef.current = false;
      if (isMountedRef.current) setLoading(false);
      abortControllerRef.current = null;
    }
  // NOTE: loading intentionally omitted from deps to avoid re-creating callback on each setLoading
  }, [isVisible, isPaused, marketSession, statType, statTop, exchange, marketCategory]);

  // Visibility API to pause updates when tab is not visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Auto-refresh effect with memory management. Use a slightly longer interval
  // and ensure only one interval exists. fetchQuotes is stable (no loading in deps).
  useEffect(() => {
    // Clear any existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    // Initial fetch
    fetchQuotes();

    const REFRESH_MS = 15000; // 15s - reduce frequency to ease memory/CPU
    if (isVisible && !isPaused) {
      refreshIntervalRef.current = setInterval(() => {
        fetchQuotes();
        setCountdown(Math.floor(REFRESH_MS / 1000));
      }, REFRESH_MS);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [fetchQuotes, isVisible, isPaused]);

  // Countdown effect with cleanup (driven by REFRESH_MS used above)
  useEffect(() => {
    // Clean up previous countdown
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    // Only run countdown if visible and not paused
    if (isVisible && !isPaused) {
      // Start countdown at 15 (matching REFRESH_MS)
      setCountdown(15);
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => (prev <= 1 ? 15 : prev - 1));
      }, 1000);
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [isVisible, isPaused]);

  // Debounced refetch when filters change to avoid rapid-fire requests and
  // excessive re-renders when user is interacting with the filter controls.
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      window.clearTimeout(debounceTimeoutRef.current as number);
      debounceTimeoutRef.current = null;
    }
    // Debounce 600ms
    debounceTimeoutRef.current = window.setTimeout(() => {
      if (!isPaused && isVisible) fetchQuotes();
    }, 600);

    return () => {
      if (debounceTimeoutRef.current) {
        window.clearTimeout(debounceTimeoutRef.current as number);
        debounceTimeoutRef.current = null;
      }
    };
  }, [marketSession, statType, exchange, statTop, marketCategory, isVisible, isPaused, fetchQuotes]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Mark unmounted to avoid state updates from inflight requests
      isMountedRef.current = false;
      // Abort any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Clear all intervals
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      
      // Clear state to free memory
      setQuotes([]);
      setError(null);
      setLastUpdate(null);
    };
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
      {/* Enhanced Header */}
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
                Real-Time Market Data
              </Title>
              <Text size="md" style={{ opacity: 0.9, margin: 0, marginTop: '4px' }}>
                {isPaused ? 'Updates paused - click ▶️ to resume' : `Live quotes • Updates every ${countdown}s • Memory: ${quotes.length}/${statTop} quotes`}
              </Text>
            </div>
          </Group>
          
          <Group gap="md">
            <Tooltip label={isPaused ? 'Resume updates' : 'Pause updates'}>
              <ActionIcon
                variant="filled"
                size="lg"
                color={isPaused ? 'green' : 'orange'}
                onClick={() => setIsPaused(!isPaused)}
                style={{ borderRadius: '10px' }}
              >
                {isPaused ? '▶️' : '⏸️'}
              </ActionIcon>
            </Tooltip>
            <Tooltip label={`Next refresh in ${countdown}s`}>
              <Group gap="xs" style={{ 
                backgroundColor: isPaused ? 'rgba(255,165,0,0.2)' : 'rgba(255,255,255,0.2)', 
                padding: '12px 16px', 
                borderRadius: '10px' 
              }}>
                <IconClock size={18} />
                <Text size="md" fw={600}>{isPaused ? 'PAUSED' : `${countdown}s`}</Text>
              </Group>
            </Tooltip>
            <ActionIcon
              variant="filled"
              size="lg"
              color="rgba(255,255,255,0.2)"
              onClick={fetchQuotes}
              loading={loading}
              style={{ borderRadius: '10px' }}
              disabled={isPaused}
            >
              <IconRefresh size={20} />
            </ActionIcon>
          </Group>
        </Group>

        {lastUpdate && (
          <Text size="sm" style={{ opacity: 0.8, marginTop: '12px' }}>
            Last updated: {new Date(lastUpdate).toLocaleString()} • Showing {quotes.length} symbols 
            {isPaused && ' • UPDATES PAUSED'}
            {!isVisible && ' • TAB INACTIVE'}
          </Text>
        )}
      </Paper>

      {/* Filter Controls */}
      <Paper p="md" withBorder radius="md">
        <Grid>
          <Grid.Col span={12}>
            <Group gap="md" align="center">
              <IconFilter size={20} />
              <Text fw={500} size="sm">Filters:</Text>
            </Group>
          </Grid.Col>
          <Grid.Col span={12}>
            <Group gap="md" align="flex-end" wrap="wrap">
              <Select
                label="Market Category"
                placeholder="Select category"
                value={marketCategory}
                onChange={(value) => setMarketCategory(value || 'Market Movers')}
                data={marketCategoryOptions}
                size="sm"
                style={{ minWidth: 160 }}
              />
              
              <Select
                label="Market Session"
                placeholder="Select session"
                value={marketSession}
                onChange={(value) => setMarketSession(value || 'NORMAL')}
                data={marketSessionOptions}
                size="sm"
                style={{ minWidth: 150 }}
              />
              
              <Select
                label="Data Type"
                placeholder="Select data type"
                value={statType}
                onChange={(value) => setStatType(value || 'dv')}
                data={statTypeOptions}
                size="sm"
                style={{ minWidth: 180 }}
              />
              
              <Select
                label="Exchange"
                placeholder="Select exchange"
                value={exchange}
                onChange={(value) => setExchange(value || 'US')}
                data={exchangeOptions}
                size="sm"
                style={{ minWidth: 160 }}
              />
              
              <Select
                label="Number of Results"
                placeholder="Select count"
                value={statTop}
                onChange={(value) => setStatTop(value || '100')}
                data={statTopOptions}
                size="sm"
                style={{ minWidth: 140 }}
              />
            </Group>
          </Grid.Col>
        </Grid>
      </Paper>

      {/* Real-Time Data Table */}
      <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
        <ScrollArea>
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead style={{ backgroundColor: '#f8f9fa' }}>
              <Table.Tr>
                <Table.Th style={{ fontWeight: 700, color: '#495057' }}>Symbol</Table.Th>
                <Table.Th style={{ fontWeight: 700, color: '#495057' }}>Company</Table.Th>
                <Table.Th style={{ fontWeight: 700, color: '#495057', textAlign: 'right' }}>Price</Table.Th>
                <Table.Th style={{ fontWeight: 700, color: '#495057', textAlign: 'right' }}>Change</Table.Th>
                <Table.Th style={{ fontWeight: 700, color: '#495057', textAlign: 'right' }}>Change %</Table.Th>
                <Table.Th style={{ fontWeight: 700, color: '#495057', textAlign: 'right' }}>Open</Table.Th>
                <Table.Th style={{ fontWeight: 700, color: '#495057', textAlign: 'right' }}>High</Table.Th>
                <Table.Th style={{ fontWeight: 700, color: '#495057', textAlign: 'right' }}>Low</Table.Th>
                <Table.Th style={{ fontWeight: 700, color: '#495057', textAlign: 'right' }}>Prev Close</Table.Th>
                <Table.Th style={{ fontWeight: 700, color: '#495057', textAlign: 'right' }}>Bid</Table.Th>
                <Table.Th style={{ fontWeight: 700, color: '#495057', textAlign: 'right' }}>Ask</Table.Th>
                <Table.Th style={{ fontWeight: 700, color: '#495057', textAlign: 'right' }}>Bid Size</Table.Th>
                <Table.Th style={{ fontWeight: 700, color: '#495057', textAlign: 'right' }}>Ask Size</Table.Th>
                <Table.Th style={{ fontWeight: 700, color: '#495057', textAlign: 'right' }}>Trade Vol</Table.Th>
                <Table.Th style={{ fontWeight: 700, color: '#495057', textAlign: 'right' }}>Share Vol</Table.Th>
                <Table.Th style={{ fontWeight: 700, color: '#495057', textAlign: 'right' }}>VWAP</Table.Th>
                <Table.Th style={{ fontWeight: 700, color: '#495057', textAlign: 'right' }}>VWAP Vol</Table.Th>
                <Table.Th style={{ fontWeight: 700, color: '#495057', textAlign: 'right' }}>Tick</Table.Th>
                <Table.Th style={{ fontWeight: 700, color: '#495057' }}>Exchange</Table.Th>
                <Table.Th style={{ fontWeight: 700, color: '#495057', textAlign: 'right' }}>Last Update</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {quotes.map((quote, index) => (
                <Table.Tr 
                  key={`${quote.symbol}-${index}`} 
                  style={{
                    backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <Table.Td style={{ fontWeight: 700, fontSize: '14px' }}>
                    <Group gap="xs">
                      <Text fw={700} c="dark">{quote.symbol}</Text>
                      {quote.change >= 0 ? 
                        <IconTrendingUp size={16} color="green" /> : 
                        <IconTrendingDown size={16} color="red" />
                      }
                    </Group>
                  </Table.Td>
                  <Table.Td style={{ maxWidth: '150px' }}>
                    <Text size="sm" truncate title={quote.companyName}>
                      {quote.companyName || 'N/A'}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right', fontWeight: 600, fontSize: '14px' }}>
                    {formatPrice(quote.price)}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right', fontWeight: 600 }}>
                    <Text c={quote.change >= 0 ? 'green' : 'red'} fw={600} size="sm">
                      {formatChange(quote.change)}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right', fontWeight: 600 }}>
                    <Text c={quote.changePercent >= 0 ? 'green' : 'red'} fw={600} size="sm">
                      {formatPercent(quote.changePercent)}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text size="sm">{formatPrice(quote.open)}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text size="sm" c="green">{formatPrice(quote.high)}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text size="sm" c="red">{formatPrice(quote.low)}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text size="sm">{formatPrice(quote.previousClose)}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text size="sm" c="blue">{formatPrice(quote.bid)}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text size="sm" c="red">{formatPrice(quote.ask)}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text size="sm" c="dimmed">{formatVolume(quote.bidSize || 0)}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text size="sm" c="dimmed">{formatVolume(quote.askSize || 0)}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text size="sm" fw={500}>{formatVolume(quote.tradevolume || 0)}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text size="sm" fw={500}>{formatVolume(quote.sharevolume || quote.volume || 0)}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text size="sm">{quote.vwap ? formatPrice(quote.vwap) : 'N/A'}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text size="sm">{formatVolume(quote.vwapvolume || 0)}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Badge 
                      variant="light" 
                      color={quote.tick > 0 ? 'green' : quote.tick < 0 ? 'red' : 'gray'} 
                      size="sm"
                    >
                      {quote.tick > 0 ? '+' : quote.tick < 0 ? '-' : '0'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="filled" size="sm" color="blue">
                      {quote.exchange}
                    </Badge>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text size="xs" c="dimmed">
                      {formatTime(quote.lastTradeTime)}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>

      {/* Statistics Footer */}
      <Paper p="md" withBorder radius="md" style={{ backgroundColor: '#f8f9fa' }}>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            📊 Showing {quotes.length} symbols • Real-time data from QuoteMedia
          </Text>
          <Group gap="md">
            <Text size="sm" c="dimmed">
              🕐 Auto-refresh: {countdown}s
            </Text>
            <Badge variant="light" color={quotes.length > 0 ? 'green' : 'gray'}>
              {quotes.length > 0 ? 'Live Data' : 'No Data'}
            </Badge>
          </Group>
        </Group>
      </Paper>
    </Stack>
  );
}
