'use client';

import { useState, useEffect, useCallback } from 'react';
import { Table, Title, Button, Text, Badge, Stack, Group, ActionIcon, Anchor, Progress } from '@mantine/core';
import { IconRefresh, IconExternalLink, IconPlayerPlay, IconPlayerPause } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface HaltData {
  symbol: string;
  haltDate: string;
  haltTime: string;
  issueName: string;
  market: string;
  reasonCodes: string;
  pauseThresholdPrice: string;
  resumptionDate: string;
  resumptionQuoteTime: string;
}

interface HaltsTableProps {
  onSymbolClick?: (symbol: string) => void;
}

export function HaltsTable({ onSymbolClick }: HaltsTableProps) {
  const [halts, setHalts] = useState<HaltData[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(30);

  const fetchHalts = useCallback(async (showNotification = true) => {
    setLoading(true);
    try {
      console.log('Fetching halts from API...');
      const response = await fetch('/api/halts', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      const data = await response.json();

      console.log('API Response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch halts');
      }

      setHalts(data.halts || []);
      setLastUpdated(new Date());
      setCountdown(30); // Reset countdown
      
      if (showNotification) {
        notifications.show({
          title: 'Halts Updated',
          message: `Found ${data.halts?.length || 0} halts for today`,
          color: 'blue',
          autoClose: 3000,
        });
      }

    } catch (error) {
      console.error('Error fetching halts:', error);
      
      if (showNotification) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        const isTimeoutError = errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('503');
        
        notifications.show({
          title: isTimeoutError ? 'Service Timeout' : 'Error',
          message: isTimeoutError ? 
            'NASDAQ service is experiencing delays. Retrying automatically in 30 seconds.' : 
            `Failed to fetch halt data: ${errorMessage}`,
          color: isTimeoutError ? 'yellow' : 'red',
          autoClose: isTimeoutError ? 5000 : 4000,
        });
      }
      
      // On error, keep existing data but update the countdown
      setCountdown(30);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh functionality
  useEffect(() => {
    // Initial fetch
    fetchHalts(false);

    const interval = setInterval(() => {
      if (autoRefresh) {
        setCountdown((prev) => {
          if (prev <= 1) {
            fetchHalts(false);
            return 30;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchHalts]);

  const handleManualRefresh = () => {
    fetchHalts(true);
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
    if (!autoRefresh) {
      setCountdown(30);
    }
  };

  const handleSymbolClick = async (symbol: string) => {
    // Use the onSymbolClick prop to open tab within the app
    if (onSymbolClick) {
      onSymbolClick(symbol);
    } else {
      // Fallback: Create a sheet for the clicked symbol (like in your original code)
      try {
        const response = await fetch('/api/symbols', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ symbol }),
        });

        if (response.ok) {
          // Navigate to symbol page in new window as fallback
          window.open(`/symbol/${symbol}`, '_blank');
        } else {
          notifications.show({
            title: 'Error',
            message: `Failed to process symbol ${symbol}`,
            color: 'red',
          });
        }
      } catch (error) {
        console.error('Error processing symbol:', error);
      }
    }
  };

  const rows = halts.map((halt, index) => (
    <Table.Tr key={index}>
      <Table.Td>
        <Group gap="xs">
          <Badge 
            variant="light" 
            color="blue" 
            style={{ cursor: 'pointer' }}
            onClick={() => handleSymbolClick(halt.symbol)}
            title="Click to analyze this symbol"
          >
            📈 {halt.symbol}
          </Badge>
          <ActionIcon
            variant="subtle"
            size="sm"
            component="a"
            href={`https://finance.yahoo.com/quote/${halt.symbol}`}
            target="_blank"
            title="View on Yahoo Finance"
          >
            <IconExternalLink size={14} />
          </ActionIcon>
        </Group>
      </Table.Td>
      <Table.Td>{halt.haltDate}</Table.Td>
      <Table.Td>
        <Badge variant="outline" color="orange" size="sm">
          {halt.haltTime}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Text size="sm" lineClamp={2} title={halt.issueName}>
          {halt.issueName}
        </Text>
      </Table.Td>
      <Table.Td>
        <Badge variant="filled" color="gray" size="sm">
          {halt.market}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Badge variant="outline" size="sm" color="red">
          {halt.reasonCodes}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Text c={halt.pauseThresholdPrice !== 'N/A' ? 'blue' : 'dimmed'}>
          {halt.pauseThresholdPrice}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text c={halt.resumptionDate !== 'N/A' ? 'green' : 'dimmed'}>
          {halt.resumptionDate}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text c={halt.resumptionQuoteTime !== 'N/A' ? 'green' : 'dimmed'}>
          {halt.resumptionQuoteTime}
        </Text>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Title order={2} c="red">🛑 NASDAQ Trading Halts - Today</Title>
        <Group gap="md">
          {lastUpdated && (
            <Text size="sm" c="dimmed">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </Text>
          )}
          
          {autoRefresh && (
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                Next refresh: {countdown}s
              </Text>
              <Progress value={(30 - countdown) / 30 * 100} size="sm" w={60} />
            </Group>
          )}

          <Button
            variant="light"
            color={autoRefresh ? 'orange' : 'gray'}
            leftSection={autoRefresh ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} />}
            onClick={toggleAutoRefresh}
            size="sm"
          >
            {autoRefresh ? 'Auto ON' : 'Auto OFF'}
          </Button>

          <Button
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={handleManualRefresh}
            loading={loading}
            size="sm"
          >
            Refresh Now
          </Button>
        </Group>
      </Group>

      {halts.length === 0 && !loading ? (
        <Text ta="center" c="dimmed" py="xl" size="lg">
          🎉 No trading halts found for today - Market running smoothly!
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={1000}>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>📈 Symbol</Table.Th>
                <Table.Th>📅 Halt Date</Table.Th>
                <Table.Th>⏰ Halt Time</Table.Th>
                <Table.Th>🏢 Issue Name</Table.Th>
                <Table.Th>🏪 Market</Table.Th>
                <Table.Th>❓ Reason Code</Table.Th>
                <Table.Th>💰 Price</Table.Th>
                <Table.Th>🔄 Resume Date</Table.Th>
                <Table.Th>⏰ Resume Time</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      <Text size="xs" c="dimmed" ta="center">
        📊 Data from NASDAQ Trading Halts API • Click on symbols to analyze • Links to Yahoo Finance
      </Text>
    </Stack>
  );
}
