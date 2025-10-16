'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Group,
  Text,
  Button,
  Stack,
  Badge,
  Alert,
  Loader,
  Table,
  ActionIcon,
  Tooltip,
  NumberFormatter,
  Box,
  Switch,
  Select,
  TextInput,
  Code,
  Progress
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { 
  IconPlayerPlay, 
  IconPlayerStop, 
  IconRefresh, 
  IconTrendingUp, 
  IconTrendingDown,
  IconSettings,
  IconPlus,
  IconMinus,
  IconActivity
} from '@tabler/icons-react';

interface TMXStreamData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  bid: number;
  ask: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  lastUpdate: string;
  exchange: string;
  marketCap?: number;
  pe?: number;
}

interface TMXRealtimeStreamProps {
  sessionId?: string;
  defaultSymbols?: string[];
  refreshInterval?: number;
  autoStart?: boolean;
}

export default function TMXRealtimeStream({ 
  sessionId,
  defaultSymbols = ['AAPL', 'TSLA', 'GOOGL', 'MSFT', 'NVDA'],
  refreshInterval = 2000,
  autoStart = false
}: TMXRealtimeStreamProps) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamData, setStreamData] = useState<TMXStreamData[]>([]);
  const [symbols, setSymbols] = useState<string[]>(defaultSymbols);
  const [newSymbol, setNewSymbol] = useState('');
  const [streamType, setStreamType] = useState<'quotes' | 'level1' | 'level2' | 'trades'>('quotes');
  const [interval, setInterval] = useState(refreshInterval);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [updateCount, setUpdateCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-start streaming if enabled
  useEffect(() => {
    if (autoStart && symbols.length > 0) {
      startStreaming();
    }
    
    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoStart, symbols]);

  const fetchStreamData = async () => {
    if (symbols.length === 0) return;
    
    try {
      const params = new URLSearchParams({
        symbols: symbols.join(','),
        streamType,
        ...(sessionId && { sessionId })
      });

      const response = await fetch(`/api/tmx-realtime-stream?${params}`);
      const result = await response.json();

      if (result.success && result.data) {
        setStreamData(result.data);
        setLastUpdate(new Date());
        setUpdateCount(prev => prev + 1);
        setError(null);

        // Show notification for first successful connection
        if (updateCount === 0) {
          notifications.show({
            title: 'TMX Stream Connected',
            message: `Successfully connected to ${result.source}`,
            color: 'green',
            autoClose: 3000,
          });
        }
      } else {
        throw new Error(result.error || 'Failed to fetch stream data');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      
      if (updateCount === 0) {
        notifications.show({
          title: 'Stream Error',
          message: errorMessage,
          color: 'red',
          autoClose: 5000,
        });
      }
    }
  };

  const startStreaming = async () => {
    if (symbols.length === 0) {
      notifications.show({
        title: 'No Symbols',
        message: 'Please add at least one symbol to start streaming',
        color: 'orange',
      });
      return;
    }

    setLoading(true);
    setIsStreaming(true);
    setUpdateCount(0);
    setError(null);

    console.log('🚀 Starting TMX real-time stream...');
    console.log('📊 Symbols:', symbols);
    console.log('🔗 Stream Type:', streamType);
    console.log('⏱️ Interval:', interval, 'ms');

    // Initial fetch
    await fetchStreamData();
    
    // Set up interval for continuous updates
    intervalRef.current = setInterval(fetchStreamData, interval);
    
    setLoading(false);
  };

  const stopStreaming = () => {
    console.log('⏹️ Stopping TMX real-time stream...');
    
    setIsStreaming(false);
    setLoading(false);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    notifications.show({
      title: 'Stream Stopped',
      message: 'Real-time data streaming has been stopped',
      color: 'blue',
      autoClose: 2000,
    });
  };

  const addSymbol = () => {
    if (newSymbol && !symbols.includes(newSymbol.toUpperCase())) {
      setSymbols(prev => [...prev, newSymbol.toUpperCase()]);
      setNewSymbol('');
    }
  };

  const removeSymbol = (symbolToRemove: string) => {
    setSymbols(prev => prev.filter(s => s !== symbolToRemove));
  };

  const refreshData = () => {
    if (!isStreaming) {
      fetchStreamData();
    }
  };

  const formatPrice = (price: number) => {
    return price.toFixed(2);
  };

  const formatChange = (change: number, changePercent: number) => {
    const color = change >= 0 ? 'green' : 'red';
    const icon = change >= 0 ? <IconTrendingUp size={14} /> : <IconTrendingDown size={14} />;
    
    return (
      <Group gap={4}>
        {icon}
        <Text c={color} fw={500}>
          <NumberFormatter value={change} thousandSeparator decimalScale={2} prefix={change >= 0 ? '+' : ''} />
          {' '}
          (<NumberFormatter value={changePercent} decimalScale={2} suffix="%" />)
        </Text>
      </Group>
    );
  };

  const formatVolume = (volume: number) => (
    <NumberFormatter value={volume} thousandSeparator />
  );

  return (
    <Stack gap="md">
      <Card withBorder>
        <Group justify="space-between" mb="md">
          <Group>
            <Text size="lg" fw={600}>TMX Real-time Market Data</Text>
            {sessionId && (
              <Badge color="green" variant="light">
                TMX Connected
              </Badge>
            )}
            {!sessionId && (
              <Badge color="orange" variant="light">
                Simulated Data
              </Badge>
            )}
          </Group>
          
          <Group>
            <ActionIcon
              variant="light"
              onClick={refreshData}
              disabled={isStreaming}
              loading={loading && !isStreaming}
            >
              <IconRefresh size={16} />
            </ActionIcon>
            
            <Button
              leftSection={isStreaming ? <IconPlayerStop size={16} /> : <IconPlayerPlay size={16} />}
              onClick={isStreaming ? stopStreaming : startStreaming}
              loading={loading}
              color={isStreaming ? 'red' : 'green'}
            >
              {isStreaming ? 'Stop Stream' : 'Start Stream'}
            </Button>
          </Group>
        </Group>

        {/* Stream Configuration */}
        <Group mb="md">
          <Select
            label="Stream Type"
            value={streamType}
            onChange={(value) => setStreamType(value as typeof streamType)}
            data={[
              { value: 'quotes', label: 'Level 1 Quotes' },
              { value: 'level1', label: 'Level 1 Data' },
              { value: 'level2', label: 'Level 2 Data' },
              { value: 'trades', label: 'Trade Data' }
            ]}
            disabled={isStreaming}
          />
          
          <Select
            label="Refresh Interval"
            value={interval.toString()}
            onChange={(value) => setInterval(parseInt(value || '2000'))}
            data={[
              { value: '1000', label: '1 second' },
              { value: '2000', label: '2 seconds' },
              { value: '5000', label: '5 seconds' },
              { value: '10000', label: '10 seconds' }
            ]}
            disabled={isStreaming}
          />
          
          <Group>
            <TextInput
              label="Add Symbol"
              placeholder="e.g., SHOP.TO"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
              onKeyPress={(e) => e.key === 'Enter' && addSymbol()}
              disabled={isStreaming}
            />
            <ActionIcon
              variant="light"
              color="green"
              onClick={addSymbol}
              disabled={isStreaming || !newSymbol}
              mt={25}
            >
              <IconPlus size={16} />
            </ActionIcon>
          </Group>
        </Group>

        {/* Symbol Management */}
        <Group mb="md">
          <Text size="sm" fw={500}>Symbols:</Text>
          {symbols.map(symbol => (
            <Badge
              key={symbol}
              variant="outline"
              rightSection={
                <ActionIcon
                  size="xs"
                  color="red"
                  variant="transparent"
                  onClick={() => removeSymbol(symbol)}
                  disabled={isStreaming}
                >
                  <IconMinus size={10} />
                </ActionIcon>
              }
            >
              {symbol}
            </Badge>
          ))}
        </Group>

        {/* Stream Status */}
        {isStreaming && (
          <Group mb="md">
            <Badge color="green" variant="dot">
              <IconActivity size={14} /> Live Stream Active
            </Badge>
            {lastUpdate && (
              <Text size="sm" c="dimmed">
                Last Update: {lastUpdate.toLocaleTimeString()}
              </Text>
            )}
            <Text size="sm" c="dimmed">
              Updates: {updateCount}
            </Text>
          </Group>
        )}

        {error && (
          <Alert color="red" mb="md" title="Stream Error">
            {error}
          </Alert>
        )}
      </Card>

      {/* Market Data Table */}
      {streamData.length > 0 && (
        <Card withBorder>
          <Text size="lg" fw={600} mb="md">Live Market Data</Text>
          
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Symbol</Table.Th>
                <Table.Th>Price</Table.Th>
                <Table.Th>Change</Table.Th>
                <Table.Th>Volume</Table.Th>
                <Table.Th>Bid/Ask</Table.Th>
                <Table.Th>High/Low</Table.Th>
                <Table.Th>Market Cap</Table.Th>
                <Table.Th>P/E</Table.Th>
                <Table.Th>Exchange</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {streamData.map((stock) => (
                <Table.Tr key={stock.symbol}>
                  <Table.Td>
                    <Text fw={600}>{stock.symbol}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="lg" fw={500}>
                      ${formatPrice(stock.price)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {formatChange(stock.change, stock.changePercent)}
                  </Table.Td>
                  <Table.Td>
                    {formatVolume(stock.volume)}
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={2}>
                      <Text size="sm">Bid: ${formatPrice(stock.bid)}</Text>
                      <Text size="sm">Ask: ${formatPrice(stock.ask)}</Text>
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={2}>
                      <Text size="sm" c="green">H: ${formatPrice(stock.high)}</Text>
                      <Text size="sm" c="red">L: ${formatPrice(stock.low)}</Text>
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    {stock.marketCap && (
                      <NumberFormatter 
                        value={stock.marketCap / 1e9} 
                        thousandSeparator 
                        decimalScale={1} 
                        suffix="B" 
                      />
                    )}
                  </Table.Td>
                  <Table.Td>
                    {stock.pe && (
                      <NumberFormatter 
                        value={stock.pe} 
                        decimalScale={1} 
                      />
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm" variant="light">
                      {stock.exchange}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      {/* Stream Statistics */}
      {streamData.length > 0 && (
        <Card withBorder>
          <Text size="md" fw={500} mb="sm">Stream Statistics</Text>
          <Group>
            <Text size="sm">
              <Text span fw={500}>Symbols:</Text> {streamData.length}
            </Text>
            <Text size="sm">
              <Text span fw={500}>Updates:</Text> {updateCount}
            </Text>
            <Text size="sm">
              <Text span fw={500}>Interval:</Text> {interval}ms
            </Text>
            {sessionId ? (
              <Text size="sm" c="green">
                <Text span fw={500}>Source:</Text> TMX PowerStream
              </Text>
            ) : (
              <Text size="sm" c="orange">
                <Text span fw={500}>Source:</Text> Simulated Data
              </Text>
            )}
          </Group>
        </Card>
      )}
    </Stack>
  );
}